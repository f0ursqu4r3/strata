import { defineStore } from "pinia";
import { ref, shallowReactive, computed, shallowRef, triggerRef, nextTick } from "vue";
import type { Node, Op, Status, ViewMode, Snapshot, StatusDef } from "@/types";
import { DEFAULT_STATUSES } from "@/types";
import { makeOp, applyOp, rebuildState, setSeq } from "@/lib/ops";
import { rankBetween, rankAfter, initialRank } from "@/lib/rank";
import { useDocNav } from "./doc-nav";
import {
  buildExportJSON,
  downloadExport as doDownloadExport,
  type ExportFormat,
} from "@/lib/doc-export";
import { isFileSystemMode } from "@/lib/platform";
import { useDocView } from "./doc-view";
import { useDocSync } from "./doc-sync";
import { buildCompensatingOp } from "@/lib/undo-ops";
import { parseMarkdown } from "@/lib/markdown-serialize";
import { reconcileParsed } from "@/lib/reconcile";
import {
  SNAPSHOT_INTERVAL,
  TEXT_DEBOUNCE_DELAY,
  MAX_UNDO,
} from "@/lib/constants";
import {
  saveOp,
  saveOps,
  loadOpsAfter,
  loadLatestSnapshot,
  saveSnapshot,
  loadAllOps,
  clearAll,
  flushOpBuffer,
  setCurrentDocId,
  loadStatusConfig,
  saveStatusConfig,
  loadTagColors,
  saveTagColors,
} from "@/lib/idb";

export const useDocStore = defineStore("doc", () => {
  // ── Core state ──
  // Using shallowRef + manual trigger for the Map to avoid deep reactivity overhead
  const nodes = shallowRef<Map<string, Node>>(new Map());
  const rootId = ref<string>("");
  const zoomId = ref<string | null>(null);
  const editing = shallowReactive({
    id: null as string | null,
    trigger: null as "keyboard" | "click" | "dblclick" | null,
    focusBody: false,
    cursorColumn: null as number | null,
  });
  const selection = shallowReactive({
    current: "",
    ids: new Set<string>(),
    anchor: "",
  });
  const filters = shallowReactive({
    search: "",
    tag: null as string | null,
    dueDate: "all" as "all" | "overdue" | "today" | "week",
  });
  const viewMode = ref<ViewMode>("split");
  const ready = ref(false);
  const currentDocId = ref<string>("");
  const suppressTransitions = ref(false);

  // ── Status configuration (per-document) ──
  const statusConfig = ref<StatusDef[]>([...DEFAULT_STATUSES]);

  // ── Per-document tag colors ──
  const tagColors = ref<Record<string, string>>({});

  // ── File sync (extracted) ──
  const sync = useDocSync({
    nodes, rootId, statusConfig, tagColors, currentDocId,
    flushTextDebounce: () => flushTextDebounce(),
  });

  const statusDefs = computed(() => statusConfig.value);

  const statusMap = computed(() => {
    const map = new Map<string, StatusDef>();
    for (const def of statusConfig.value) {
      map.set(def.id, def);
    }
    return map;
  });

  // Op tracking
  const opsSinceSnapshot = ref(0);
  const lastSeq = ref(0);

  // ── Undo / Redo ──
  interface UndoEntry {
    op: Op;
    beforeSnapshots: Node[]; // deep copies of affected nodes before op
    selectedBefore: string;
  }
  const undoStack: UndoEntry[] = [];
  const redoStack: UndoEntry[] = [];

  // Per-document undo/redo history — preserved across document switches
  const _docUndoHistory = new Map<string, { undo: UndoEntry[]; redo: UndoEntry[] }>();

  function clearSavedHistory(docId: string) {
    _docUndoHistory.delete(docId);
  }

  // ── Helpers: children lookup (cached per trigger) ──
  const childrenMap = computed(() => {
    const map = new Map<string | null, Node[]>();
    for (const node of nodes.value.values()) {
      if (node.deleted) continue;
      const pid = node.parentId;
      let arr = map.get(pid);
      if (!arr) {
        arr = [];
        map.set(pid, arr);
      }
      arr.push(node);
    }
    // Sort each group by pos
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0));
    }
    return map;
  });

  function getChildren(parentId: string): Node[] {
    return childrenMap.value.get(parentId) ?? [];
  }

  // ── View computations (extracted to doc-view.ts) ──
  const view = useDocView({ nodes, rootId, zoomId, filters, statusConfig, childrenMap });
  const {
    effectiveZoomId,
    searchMatchIds,
    allTags,
    tagMatchIds,
    dueDateMatchIds,
    visibleRows,
    kanbanNodes,
    kanbanColumns,
    zoomBreadcrumbs,
    trashedNodes,
    subtreeNodes,
  } = view;

  // ── Breadcrumb path for a node ──
  function breadcrumb(nodeId: string): string {
    const parts: string[] = [];
    let cur = nodes.value.get(nodeId);
    while (cur && cur.parentId && cur.parentId !== effectiveZoomId.value) {
      const parent = nodes.value.get(cur.parentId);
      if (parent && !parent.deleted) {
        parts.unshift(parent.text || "(empty)");
      }
      cur = parent;
    }
    return parts.join(" > ");
  }

  // ── Op dispatch ──
  function getAffectedIds(op: Op): string[] {
    const p = op.payload as { id?: string };
    return p.id ? [p.id] : [];
  }

  async function dispatch(op: Op, recordUndo = true) {
    if (recordUndo) {
      // Snapshot affected nodes before mutation
      const ids = getAffectedIds(op);
      const beforeSnapshots: Node[] = [];
      for (const id of ids) {
        const node = nodes.value.get(id);
        if (node) beforeSnapshots.push({ ...node });
      }
      undoStack.push({
        op,
        beforeSnapshots,
        selectedBefore: selection.current,
      });
      if (undoStack.length > MAX_UNDO) undoStack.shift();
      // Clear redo on new action
      redoStack.length = 0;
    }

    applyOp(nodes.value, op);
    // Replace affected nodes with new object references so child components
    // (which receive node as a prop) detect the change and re-render.
    // shallowRef + triggerRef alone won't help because the Map values are
    // the same object references after in-place mutation.
    for (const id of getAffectedIds(op)) {
      const node = nodes.value.get(id);
      if (node) nodes.value.set(id, { ...node });
    }
    triggerRef(nodes);
    lastSeq.value = op.seq;
    opsSinceSnapshot.value++;

    await saveOp(op);

    // Update search index for content-changing ops
    if (
      op.type === "create" ||
      op.type === "updateText" ||
      op.type === "tombstone" ||
      op.type === "restore"
    ) {
      sync.scheduleIndexUpdate();
    }

    sync.scheduleFileSave();

    if (opsSinceSnapshot.value >= SNAPSHOT_INTERVAL) {
      await takeSnapshot();
    }
  }

  function undo() {
    const entry = undoStack.pop();
    if (!entry) return;

    // Restore node snapshots
    for (const snap of entry.beforeSnapshots) {
      nodes.value.set(snap.id, { ...snap });
    }

    // Build and persist compensating ops (also mutates nodes for side-effect ops)
    const compensatingOps = buildCompensatingOp(entry, nodes.value);
    triggerRef(nodes);
    for (const cop of compensatingOps) {
      saveOp(cop);
      lastSeq.value = cop.seq;
    }

    selection.current = entry.selectedBefore;
    redoStack.push(entry);
  }

  function redo() {
    const entry = redoStack.pop();
    if (!entry) return;

    // Re-apply the original op
    const reOp = makeOp(entry.op.type, entry.op.payload);

    // Capture current state for undo
    const ids = getAffectedIds(reOp);
    const beforeSnapshots: Node[] = [];
    for (const id of ids) {
      const node = nodes.value.get(id);
      if (node) beforeSnapshots.push({ ...node });
    }
    undoStack.push({
      op: reOp,
      beforeSnapshots,
      selectedBefore: selection.current,
    });

    applyOp(nodes.value, reOp);
    triggerRef(nodes);
    lastSeq.value = reOp.seq;
    opsSinceSnapshot.value++;
    saveOp(reOp);
  }

  async function takeSnapshot() {
    await flushOpBuffer();
    const snap: Snapshot = {
      id: crypto.randomUUID(),
      nodes: Array.from(nodes.value.values()),
      rootId: rootId.value,
      seqAfter: lastSeq.value,
      ts: Date.now(),
    };
    await saveSnapshot(snap);
    opsSinceSnapshot.value = 0;
  }

  // ── Actions ──

  function createNode(
    parentId: string | null,
    pos: string,
    text: string = "",
    status: Status = statusConfig.value[0]?.id ?? "todo",
  ): Op {
    const id = crypto.randomUUID();
    const op = makeOp("create", {
      type: "create",
      id,
      parentId,
      pos,
      text,
      status,
    });
    dispatch(op);
    return op;
  }

  // ── Debounced text update ──
  // Immediate in-memory mutation for responsive UI; op emitted after 300ms pause
  const _textDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // Snapshots captured on first keystroke per node, used for undo
  const _textBeforeSnapshots = new Map<string, Node>();

  function updateText(id: string, text: string) {
    const node = nodes.value.get(id);
    if (!node) return;

    // Capture before-snapshot on first change for this node
    if (!_textBeforeSnapshots.has(id)) {
      _textBeforeSnapshots.set(id, { ...node });
    }

    // Apply to memory immediately
    node.text = text;
    triggerRef(nodes);

    // Debounce the persistent op
    const existing = _textDebounceTimers.get(id);
    if (existing) clearTimeout(existing);
    _textDebounceTimers.set(
      id,
      setTimeout(() => {
        _commitTextOp(id, text);
      }, TEXT_DEBOUNCE_DELAY),
    );
  }

  function _commitTextOp(id: string, text: string) {
    _textDebounceTimers.delete(id);
    const op = makeOp("updateText", { type: "updateText", id, text });

    // Push undo entry with the before-snapshot
    const beforeSnap = _textBeforeSnapshots.get(id);
    if (beforeSnap) {
      undoStack.push({
        op,
        beforeSnapshots: [beforeSnap],
        selectedBefore: selection.current,
      });
      if (undoStack.length > MAX_UNDO) undoStack.shift();
      redoStack.length = 0;
      _textBeforeSnapshots.delete(id);
    }

    // Persist (don't re-apply to memory, already done)
    lastSeq.value = op.seq;
    opsSinceSnapshot.value++;
    sync.scheduleIndexUpdate();
    sync.scheduleFileSave();
    saveOp(op).then(() => {
      if (opsSinceSnapshot.value >= SNAPSHOT_INTERVAL) {
        takeSnapshot();
      }
    });
  }

  function flushTextDebounce() {
    for (const [id, timer] of _textDebounceTimers) {
      clearTimeout(timer);
      const node = nodes.value.get(id);
      if (node) {
        _commitTextOp(id, node.text);
      }
    }
  }

  function moveNode(id: string, parentId: string | null, pos: string) {
    const op = makeOp("move", { type: "move", id, parentId, pos });
    dispatch(op);
  }

  function setStatus(id: string, status: Status) {
    const op = makeOp("setStatus", { type: "setStatus", id, status });
    dispatch(op);
  }

  function toggleCollapsed(id: string) {
    const op = makeOp("toggleCollapsed", { type: "toggleCollapsed", id });
    dispatch(op);
  }

  function duplicateNode(id: string) {
    const node = nodes.value.get(id);
    if (!node || !node.parentId) return;

    const siblings = getChildren(node.parentId);
    const myIdx = siblings.findIndex((s) => s.id === node.id);
    const nextSibling = siblings[myIdx + 1];

    let pos: string;
    if (nextSibling) {
      pos = rankBetween(node.pos, nextSibling.pos);
    } else {
      pos = rankAfter(node.pos);
    }

    const op = createNode(node.parentId, pos, node.text, node.status);
    const newId = (op.payload as { id: string }).id;
    selection.current = newId;
  }

  function tombstone(id: string) {
    // Also tombstone descendants
    function deleteTree(nid: string) {
      const children = getChildren(nid);
      for (const child of children) {
        deleteTree(child.id);
      }
      const op = makeOp("tombstone", { type: "tombstone", id: nid });
      dispatch(op);
    }
    deleteTree(id);
  }

  function addTag(nodeId: string, tag: string) {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const node = nodes.value.get(nodeId);
    if (!node) return;
    if (node.tags && node.tags.includes(trimmed)) return;
    const op = makeOp("addTag", { type: "addTag", id: nodeId, tag: trimmed });
    dispatch(op);
  }

  function removeTag(nodeId: string, tag: string) {
    const op = makeOp("removeTag", { type: "removeTag", id: nodeId, tag });
    dispatch(op);
  }

  function restoreNode(id: string) {
    const node = nodes.value.get(id);
    if (!node || !node.deleted) return;
    // If parent is also deleted, reparent to root
    const parent = node.parentId ? nodes.value.get(node.parentId) : null;
    if (parent && parent.deleted) {
      const children = getChildren(rootId.value);
      const pos =
        children.length > 0 ? rankAfter(children[children.length - 1]!.pos) : initialRank();
      const moveOp = makeOp("move", { type: "move", id, parentId: rootId.value, pos });
      dispatch(moveOp, false);
    }
    const op = makeOp("restore", { type: "restore", id });
    dispatch(op);
  }

  function setDueDate(id: string, dueDate: number | null) {
    const op = makeOp("setDueDate", { type: "setDueDate", id, dueDate });
    dispatch(op);
  }

  // ── Status config CRUD ──

  async function addStatus(def: StatusDef) {
    statusConfig.value = [...statusConfig.value, def];
    if (!isFileSystemMode()) await saveStatusConfig(statusConfig.value);
    sync.scheduleFileSave();
  }

  async function removeStatus(statusId: string, replacementId: string) {
    // Bulk-reassign nodes with the removed status
    for (const node of nodes.value.values()) {
      if (!node.deleted && node.status === statusId) {
        const op = makeOp("setStatus", { type: "setStatus", id: node.id, status: replacementId });
        dispatch(op, false);
      }
    }
    statusConfig.value = statusConfig.value.filter((s) => s.id !== statusId);
    if (!isFileSystemMode()) await saveStatusConfig(statusConfig.value);
    sync.scheduleFileSave();
  }

  async function updateStatus(statusId: string, updates: Partial<Omit<StatusDef, "id">>) {
    statusConfig.value = statusConfig.value.map((s) =>
      s.id === statusId ? { ...s, ...updates } : s,
    );
    if (!isFileSystemMode()) await saveStatusConfig(statusConfig.value);
    sync.scheduleFileSave();
  }

  async function reorderStatuses(orderedIds: string[]) {
    const byId = new Map(statusConfig.value.map((s) => [s.id, s]));
    statusConfig.value = orderedIds.map((id) => byId.get(id)!).filter(Boolean);
    if (!isFileSystemMode()) await saveStatusConfig(statusConfig.value);
    sync.scheduleFileSave();
  }

  // ── Tag color CRUD ──

  async function setTagColor(tag: string, colorKey: string | null) {
    if (colorKey) {
      tagColors.value = { ...tagColors.value, [tag]: colorKey };
    } else {
      const { [tag]: _, ...rest } = tagColors.value;
      tagColors.value = rest;
    }
    if (!isFileSystemMode()) await saveTagColors(tagColors.value);
    sync.scheduleFileSave();
  }

  // ── Navigation & editing state (extracted to doc-nav.ts) ──
  const nav = useDocNav({
    nodes, rootId, editing, selection, filters, viewMode, zoomId,
    visibleRows,
    childrenMap,
    dispatch, createNode, moveNode, tombstone, toggleCollapsed, flushTextDebounce,
  });

  // ── Init / Load ──

  async function loadDocument(docId: string) {
    flushTextDebounce();
    // Force-flush any pending file save so the current document is written
    // to disk before we reset state and load the new one.
    await sync.flushPendingSave();
    if (!isFileSystemMode()) {
      await flushOpBuffer();
      setCurrentDocId(docId);
    }
    // Save current document's undo/redo history before switching
    if (currentDocId.value) {
      _docUndoHistory.set(currentDocId.value, {
        undo: undoStack.splice(0),
        redo: redoStack.splice(0),
      });
    }

    currentDocId.value = docId;

    // Reset state
    undoStack.length = 0;
    redoStack.length = 0;
    zoomId.value = null;
    filters.search = "";
    filters.tag = null;
    filters.dueDate = "all";
    editing.id = null;
    editing.trigger = null;
    ready.value = false;
    setSeq(0);

    await init();

    // Restore undo/redo history for the loaded document
    const saved = _docUndoHistory.get(docId);
    if (saved) {
      undoStack.push(...saved.undo);
      redoStack.push(...saved.redo);
      _docUndoHistory.delete(docId);
    }
  }

  async function init() {
    if (isFileSystemMode() && currentDocId.value) {
      await initFromFile();
      return;
    }
    await initFromIdb();
  }

  async function initFromFile() {
    const filePath = await sync.getFilePath();
    if (!filePath) return;

    const { readFile } = await import("@/lib/fs");

    let content = "";
    try {
      content = await readFile(filePath);
    } catch (err) {
      console.warn(`[strata] Could not read ${filePath}:`, err);
    }

    if (content.trim()) {
      const parsed = parseMarkdown(content);
      rootId.value = parsed.rootId;
      nodes.value = parsed.nodes;
      statusConfig.value = parsed.statusConfig;
      tagColors.value = parsed.tagColors;
    } else {
      // Brand new document
      const nodeMap = new Map<string, Node>();
      const rId = crypto.randomUUID();
      rootId.value = rId;
      nodeMap.set(rId, {
        id: rId,
        parentId: null,
        pos: initialRank(),
        text: "Root",
        collapsed: false,
        status: statusConfig.value[0]?.id ?? "todo",
        deleted: false,
        tags: [],
      });
      const firstId = crypto.randomUUID();
      nodeMap.set(firstId, {
        id: firstId,
        parentId: rId,
        pos: initialRank(),
        text: "",
        collapsed: false,
        status: statusConfig.value[0]?.id ?? "todo",
        deleted: false,
        tags: [],
      });
      nodes.value = nodeMap;
    }

    // Set selection to first visible
    const firstChild = getChildren(rootId.value);
    if (firstChild.length > 0) {
      selection.current = firstChild[0]!.id;
    }

    ready.value = true;
    sync.scheduleIndexUpdate();
  }

  async function refreshFromFile() {
    const filePath = await sync.getFilePath();
    if (!filePath) return;

    const { readFile } = await import("@/lib/fs");

    let content = "";
    try {
      content = await readFile(filePath);
    } catch {
      return;
    }

    if (!content.trim()) return;

    const parsed = parseMarkdown(content);
    const reconciled = reconcileParsed(nodes.value, rootId.value, parsed);

    suppressTransitions.value = true;
    rootId.value = reconciled.rootId;
    nodes.value = reconciled.nodes;
    statusConfig.value = reconciled.statusConfig;
    tagColors.value = reconciled.tagColors;
    triggerRef(nodes);
    sync.scheduleIndexUpdate();
    nextTick(() => {
      suppressTransitions.value = false;
    });
  }

  async function initFromIdb() {
    const snapshot = await loadLatestSnapshot();

    let nodeMap: Map<string, Node>;
    let baseSeq = 0;

    if (snapshot) {
      nodeMap = new Map(snapshot.nodes.map((n) => [n.id, { ...n }]));
      rootId.value = snapshot.rootId;
      baseSeq = snapshot.seqAfter;
      setSeq(baseSeq);

      const recentOps = await loadOpsAfter(baseSeq);
      for (const op of recentOps) {
        applyOp(nodeMap, op);
        if (op.seq > baseSeq) baseSeq = op.seq;
      }
      setSeq(baseSeq);
      lastSeq.value = baseSeq;
      opsSinceSnapshot.value = recentOps.length;
    } else {
      // Check if there are any ops at all
      const allOps = await loadAllOps();
      if (allOps.length > 0) {
        nodeMap = rebuildState([], allOps);
        // Find root (node with parentId === null)
        for (const [id, node] of nodeMap) {
          if (node.parentId === null && !node.deleted) {
            rootId.value = id;
            break;
          }
        }
        const maxSeq = allOps.reduce((m, o) => Math.max(m, o.seq), 0);
        setSeq(maxSeq);
        lastSeq.value = maxSeq;
        opsSinceSnapshot.value = allOps.length;
      } else {
        // Brand new document
        nodeMap = new Map();
        const rId = crypto.randomUUID();
        rootId.value = rId;
        nodeMap.set(rId, {
          id: rId,
          parentId: null,
          pos: initialRank(),
          text: "Root",
          collapsed: false,
          status: "todo",
          deleted: false,
          tags: [],
        });

        const isFirstLaunch = !localStorage.getItem("strata-launched");
        const firstId = crypto.randomUUID();

        if (isFirstLaunch) {
          // Create starter nodes for onboarding (first launch only)
          localStorage.setItem("strata-launched", "1");
          const starters = [
            { text: "Welcome to Strata", status: "in_progress" as Status },
            { text: "Try pressing Ctrl/Cmd + Enter to create a new item", status: "todo" as Status },
            { text: "Use Tab to indent, Shift+Tab to outdent", status: "todo" as Status },
            { text: "Ctrl+1/2/3/4 to change status", status: "todo" as Status },
            { text: "Right-click for more options", status: "todo" as Status },
            { text: "Drag cards between Kanban columns", status: "done" as Status },
          ];
          let prevPos = "";
          for (let i = 0; i < starters.length; i++) {
            const s = starters[i]!;
            const id = i === 0 ? firstId : crypto.randomUUID();
            const pos = prevPos ? rankAfter(prevPos) : initialRank();
            prevPos = pos;
            nodeMap.set(id, {
              id,
              parentId: rId,
              pos,
              text: s.text,
              collapsed: false,
              status: s.status,
              deleted: false,
              tags: [],
            });
          }
        } else {
          // Blank document with a single empty node
          nodeMap.set(firstId, {
            id: firstId,
            parentId: rId,
            pos: initialRank(),
            text: "",
            collapsed: false,
            status: "todo",
            deleted: false,
            tags: [],
          });
        }

        // Save initial ops
        const ops: Op[] = [];
        for (const node of nodeMap.values()) {
          ops.push(
            makeOp("create", {
              type: "create",
              id: node.id,
              parentId: node.parentId,
              pos: node.pos,
              text: node.text,
              status: node.status,
            }),
          );
        }
        await saveOps(ops);
        lastSeq.value = ops[ops.length - 1]?.seq ?? 0;
        selection.current = firstId;
      }
    }

    // Migrate: ensure all nodes have tags array
    for (const node of nodeMap.values()) {
      if (!node.tags) node.tags = [];
    }

    // Load per-document status config
    const savedStatuses = await loadStatusConfig();
    if (savedStatuses && savedStatuses.length > 0) {
      statusConfig.value = savedStatuses;
    } else {
      statusConfig.value = [...DEFAULT_STATUSES];
    }

    // Load per-document tag colors
    const savedTagColors = await loadTagColors();
    tagColors.value = savedTagColors ?? {};

    nodes.value = nodeMap;

    // Set selection to first visible if not set
    if (!selection.current || !nodeMap.has(selection.current)) {
      const firstChild = getChildren(rootId.value);
      if (firstChild.length > 0) {
        selection.current = firstChild[0]!.id;
      }
    }

    ready.value = true;

    // Update cross-document search index
    sync.scheduleIndexUpdate();
  }

  // ── Export / Import / Reset ──

  function exportJSON(): string {
    flushTextDebounce();
    return buildExportJSON({
      nodes: nodes.value,
      rootId: rootId.value,
      statusConfig: statusConfig.value,
      tagColors: tagColors.value,
    });
  }

  function downloadExport(format: ExportFormat = "json") {
    flushTextDebounce();
    doDownloadExport({
      format,
      nodes: nodes.value,
      rootId: rootId.value,
      statusMap: statusMap.value,
      statusConfig: statusConfig.value,
      tagColors: tagColors.value,
      zoomId: zoomId.value,
    });
  }

  /**
   * Import parsed flat nodes as children of the given parent.
   * Used by drag-and-drop file import.
   */
  async function importNodes(
    flatNodes: Array<{
      id: string;
      parentId: string;
      pos: string;
      text: string;
      status: string;
      tags: string[];
    }>,
  ) {
    for (const fn of flatNodes) {
      const op = makeOp("create", {
        type: "create",
        id: fn.id,
        parentId: fn.parentId,
        pos: fn.pos,
        text: fn.text,
        status: fn.status as Status,
      });
      await dispatch(op);

      for (const tag of fn.tags) {
        const tagOp = makeOp("addTag", {
          type: "addTag",
          id: fn.id,
          tag,
        });
        await dispatch(tagOp);
      }
    }
  }

  async function importJSON(json: string) {
    const doc = JSON.parse(json);
    if (!doc.version || !doc.rootId || !Array.isArray(doc.nodes)) {
      throw new Error("Invalid Strata export file");
    }

    // Clear existing data
    await clearAll();
    undoStack.length = 0;
    redoStack.length = 0;

    // Build new node map
    const nodeMap = new Map<string, Node>();
    for (const n of doc.nodes as Node[]) {
      nodeMap.set(n.id, { ...n });
    }

    // Persist as ops
    setSeq(0);
    const ops: Op[] = [];
    for (const node of nodeMap.values()) {
      ops.push(
        makeOp("create", {
          type: "create",
          id: node.id,
          parentId: node.parentId,
          pos: node.pos,
          text: node.text,
          status: node.status,
        }),
      );
    }
    await saveOps(ops);

    // Import status config
    if (Array.isArray(doc.statusConfig) && doc.statusConfig.length > 0) {
      statusConfig.value = doc.statusConfig as StatusDef[];
    } else {
      statusConfig.value = [...DEFAULT_STATUSES];
    }
    await saveStatusConfig(statusConfig.value);

    // Import tag colors
    if (doc.tagColors && typeof doc.tagColors === 'object') {
      tagColors.value = doc.tagColors as Record<string, string>;
    } else {
      tagColors.value = {};
    }
    await saveTagColors(tagColors.value);

    // Update state
    rootId.value = doc.rootId;
    nodes.value = nodeMap;
    zoomId.value = null;
    lastSeq.value = ops[ops.length - 1]?.seq ?? 0;
    opsSinceSnapshot.value = ops.length;

    // Select first child
    const firstChild = getChildren(rootId.value);
    if (firstChild.length > 0) {
      selection.current = firstChild[0]!.id;
    }
    editing.id = null;
  }

  function clearToEmpty() {
    nodes.value.clear();
    nodes.value.set(rootId.value, {
      id: rootId.value,
      parentId: null,
      pos: "",
      text: "",
      status: "none" as Status,
      collapsed: false,
      deleted: false,
      tags: [],
    });
    triggerRef(nodes);
    undoStack.length = 0;
    redoStack.length = 0;
    selection.current = "";
    editing.id = null;
    editing.trigger = null;
    zoomId.value = null;
    filters.search = "";
    filters.tag = null;
    filters.dueDate = "all";
    currentDocId.value = "";
  }

  async function resetDocument() {
    await clearAll();
    undoStack.length = 0;
    redoStack.length = 0;
    ready.value = false;
    zoomId.value = null;
    filters.search = "";
    setSeq(0);
    await init();
  }

  return {
    // State
    nodes,
    rootId,
    zoomId,
    editing,
    selection,
    filters,
    viewMode,
    ready,
    statusConfig,
    tagColors,
    // Computed
    statusDefs,
    statusMap,
    childrenMap,
    searchMatchIds,
    visibleRows,
    kanbanColumns,
    kanbanNodes,
    effectiveZoomId,
    allTags,
    trashedNodes,
    // Methods
    getChildren,
    breadcrumb,
    init,
    loadDocument,
    clearSavedHistory,
    clearToEmpty,
    createNode,
    updateText,
    flushTextDebounce,
    moveNode,
    setStatus,
    toggleCollapsed,
    tombstone,
    addTag,
    removeTag,
    restoreNode,
    setDueDate,
    navigateToNode: nav.navigateToNode,
    addStatus,
    removeStatus,
    updateStatus,
    reorderStatuses,
    setTagColor,
    duplicateNode,
    moveSelectionUp: nav.moveSelectionUp,
    moveSelectionDown: nav.moveSelectionDown,
    createSiblingBelow: nav.createSiblingBelow,
    indentNode: nav.indentNode,
    outdentNode: nav.outdentNode,
    editPreviousNode: nav.editPreviousNode,
    editNextNode: nav.editNextNode,
    deleteNodeAndEditPrevious: nav.deleteNodeAndEditPrevious,
    indentAndKeepEditing: nav.indentAndKeepEditing,
    outdentAndKeepEditing: nav.outdentAndKeepEditing,
    createSiblingBelowAndEdit: nav.createSiblingBelowAndEdit,
    selectNode: nav.selectNode,
    clearSelection: nav.clearSelection,
    toggleSelectNode: nav.toggleSelectNode,
    rangeSelectTo: nav.rangeSelectTo,
    isSelected: nav.isSelected,
    bulkSetStatus: nav.bulkSetStatus,
    bulkTombstone: nav.bulkTombstone,
    startEditing: nav.startEditing,
    stopEditing: nav.stopEditing,
    setViewMode: nav.setViewMode,
    zoomIn: nav.zoomIn,
    zoomOut: nav.zoomOut,
    undo,
    redo,
    zoomBreadcrumbs,
    exportJSON,
    downloadExport,
    importJSON,
    importNodes,
    resetDocument,
    suppressTransitions,
    saveToFile: sync.saveToFile,
    hasUnsavedChanges: sync.hasUnsavedChanges,
    recentlyWritten: sync.recentlyWritten,
    refreshFromFile,
  };
});
