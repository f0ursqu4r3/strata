import { defineStore } from "pinia";
import { ref, computed, shallowRef, triggerRef, nextTick } from "vue";
import type { Node, Op, Status, ViewMode, Snapshot, StatusDef } from "@/types";
import { DEFAULT_STATUSES } from "@/types";
import { makeOp, applyOp, rebuildState, setSeq } from "@/lib/ops";
import { rankBetween, rankAfter, rankBefore, initialRank } from "@/lib/rank";
import { exportToMarkdown, exportToOPML, exportToPlaintext } from "@/lib/export-formats";
import { matchesDueDateFilter } from "@/lib/due-date";
import { updateIndexForDoc } from "@/lib/search-index";
import { isTauri } from "@/lib/platform";
import { serializeToMarkdown, parseMarkdown } from "@/lib/markdown-serialize";
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
} from "@/lib/idb";

const SNAPSHOT_INTERVAL = 200;

export const useDocStore = defineStore("doc", () => {
  // ── Core state ──
  // Using shallowRef + manual trigger for the Map to avoid deep reactivity overhead
  const nodes = shallowRef<Map<string, Node>>(new Map());
  const rootId = ref<string>("");
  const zoomId = ref<string | null>(null);
  const selectedId = ref<string>("");
  const editingId = ref<string | null>(null);
  const editingTrigger = ref<"keyboard" | "click" | "dblclick" | null>(null);
  const viewMode = ref<ViewMode>("split");
  const ready = ref(false);
  const searchQuery = ref("");
  const tagFilter = ref<string | null>(null);
  const dueDateFilter = ref<"all" | "overdue" | "today" | "week">("all");
  const currentDocId = ref<string>("");
  const suppressTransitions = ref(false);
  const selectedIds = ref<Set<string>>(new Set());
  const selectionAnchor = ref<string>("");

  // ── Debounced search-index updater ──
  let _indexTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleIndexUpdate() {
    if (_indexTimer) clearTimeout(_indexTimer);
    _indexTimer = setTimeout(() => {
      _indexTimer = null;
      if (currentDocId.value) {
        updateIndexForDoc(currentDocId.value, nodes.value);
      }
    }, 500);
  }

  // ── Debounced file save (Tauri mode) ──
  let _fileSaveTimer: ReturnType<typeof setTimeout> | null = null;
  const FILE_SAVE_DELAY = 1000;
  const WRITE_COOLDOWN = 2000;
  let _lastWriteAt = 0;

  function scheduleFileSave() {
    if (!isTauri()) return;
    if (_fileSaveTimer) clearTimeout(_fileSaveTimer);
    _fileSaveTimer = setTimeout(() => {
      _fileSaveTimer = null;
      saveToFile();
    }, FILE_SAVE_DELAY);
  }

  function hasUnsavedChanges(): boolean {
    return _fileSaveTimer !== null;
  }

  function recentlyWritten(): boolean {
    return Date.now() - _lastWriteAt < WRITE_COOLDOWN;
  }

  async function saveToFile() {
    if (!isTauri() || !currentDocId.value) return;
    flushTextDebounce();
    const { useSettingsStore } = await import("@/stores/settings");
    const settings = useSettingsStore();
    if (!settings.workspacePath) return;
    const { writeFile } = await import("@/lib/tauri-fs");
    const content = serializeToMarkdown({
      nodes: nodes.value,
      rootId: rootId.value,
      statusConfig: statusConfig.value,
    });
    const filePath = `${settings.workspacePath}/${currentDocId.value}`;
    await writeFile(filePath, content);
    _lastWriteAt = Date.now();
  }

  // ── Status configuration (per-document) ──
  const statusConfig = ref<StatusDef[]>([...DEFAULT_STATUSES]);

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
  const MAX_UNDO = 200;

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

  // ── Visible rows (flattened DFS for outline) ──
  const effectiveZoomId = computed(() => zoomId.value ?? rootId.value);

  // ── Search: set of matching node IDs + ancestors that should be visible ──
  const searchMatchIds = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return null;
    const matches = new Set<string>();
    for (const node of nodes.value.values()) {
      if (node.deleted) continue;
      if (node.text.toLowerCase().includes(q)) {
        matches.add(node.id);
        // Also mark all ancestors visible so the match is reachable
        let cur = node;
        while (cur.parentId) {
          matches.add(cur.parentId);
          const parent = nodes.value.get(cur.parentId);
          if (!parent) break;
          cur = parent;
        }
      }
    }
    return matches;
  });

  const allTags = computed(() => {
    const tagSet = new Set<string>();
    for (const node of nodes.value.values()) {
      if (node.deleted) continue;
      if (node.tags) {
        for (const tag of node.tags) tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  });

  const tagMatchIds = computed(() => {
    const tag = tagFilter.value;
    if (!tag) return null;
    const matches = new Set<string>();
    for (const node of nodes.value.values()) {
      if (node.deleted) continue;
      if (node.tags && node.tags.includes(tag)) {
        matches.add(node.id);
        // Mark ancestors visible
        let cur = node;
        while (cur.parentId) {
          matches.add(cur.parentId);
          const parent = nodes.value.get(cur.parentId);
          if (!parent) break;
          cur = parent;
        }
      }
    }
    return matches;
  });

  const dueDateMatchIds = computed(() => {
    const filter = dueDateFilter.value;
    if (filter === "all") return null;
    const matches = new Set<string>();
    for (const node of nodes.value.values()) {
      if (node.deleted) continue;
      if (matchesDueDateFilter(node.dueDate, filter)) {
        matches.add(node.id);
        let cur = node;
        while (cur.parentId) {
          matches.add(cur.parentId);
          const parent = nodes.value.get(cur.parentId);
          if (!parent) break;
          cur = parent;
        }
      }
    }
    return matches;
  });

  const visibleRows = computed(() => {
    const rows: { node: Node; depth: number }[] = [];
    const root = effectiveZoomId.value;
    if (!root) return rows;
    const searchFilter = searchMatchIds.value;
    const tagF = tagMatchIds.value;
    const dueF = dueDateMatchIds.value;

    function walk(parentId: string, depth: number) {
      const children = getChildren(parentId);
      for (const child of children) {
        if (searchFilter && !searchFilter.has(child.id)) continue;
        if (tagF && !tagF.has(child.id)) continue;
        if (dueF && !dueF.has(child.id)) continue;
        rows.push({ node: child, depth });
        const isFiltering = searchFilter || tagF || dueF;
        if (!child.collapsed || isFiltering) {
          walk(child.id, depth + 1);
        }
      }
    }
    walk(root, 0);
    return rows;
  });

  // ── Kanban: nodes grouped by status ──
  function subtreeNodes(rootNodeId: string): Node[] {
    const result: Node[] = [];
    function walk(pid: string) {
      const children = getChildren(pid);
      for (const child of children) {
        result.push(child);
        walk(child.id);
      }
    }
    walk(rootNodeId);
    return result;
  }

  const kanbanNodes = computed(() => {
    const root = effectiveZoomId.value;
    if (!root) return [];
    let all = subtreeNodes(root);
    const tag = tagFilter.value;
    if (tag) all = all.filter((n) => n.tags && n.tags.includes(tag));
    const dueFilter = dueDateFilter.value;
    if (dueFilter !== "all") all = all.filter((n) => matchesDueDateFilter(n.dueDate, dueFilter));
    return all;
  });

  const kanbanColumns = computed(() => {
    const cols = statusConfig.value.map((def) => ({ def, nodes: [] as Node[] }));
    const colMap = new Map(cols.map((c) => [c.def.id, c]));
    for (const node of kanbanNodes.value) {
      const col = colMap.get(node.status);
      if (col) col.nodes.push(node);
      else if (cols.length > 0) cols[0]!.nodes.push(node);
    }
    return cols;
  });

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
        selectedBefore: selectedId.value,
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
      scheduleIndexUpdate();
    }

    scheduleFileSave();

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
    // Handle create undo: if the op created a node, remove it
    if (entry.op.type === "create") {
      const id = (entry.op.payload as { id: string }).id;
      const node = nodes.value.get(id);
      if (node) {
        node.deleted = true;
      }
    }
    triggerRef(nodes);

    // Persist a compensating op
    if (entry.op.type === "create") {
      const id = (entry.op.payload as { id: string }).id;
      const compensate = makeOp("tombstone", { type: "tombstone", id });
      saveOp(compensate);
      lastSeq.value = compensate.seq;
    } else {
      // For other ops, write the restored state as new ops
      for (const snap of entry.beforeSnapshots) {
        if (entry.op.type === "updateText") {
          const compensate = makeOp("updateText", {
            type: "updateText",
            id: snap.id,
            text: snap.text,
          });
          saveOp(compensate);
          lastSeq.value = compensate.seq;
        } else if (entry.op.type === "move") {
          const compensate = makeOp("move", {
            type: "move",
            id: snap.id,
            parentId: snap.parentId,
            pos: snap.pos,
          });
          saveOp(compensate);
          lastSeq.value = compensate.seq;
        } else if (entry.op.type === "setStatus") {
          const compensate = makeOp("setStatus", {
            type: "setStatus",
            id: snap.id,
            status: snap.status,
          });
          saveOp(compensate);
          lastSeq.value = compensate.seq;
        } else if (entry.op.type === "toggleCollapsed") {
          const compensate = makeOp("toggleCollapsed", { type: "toggleCollapsed", id: snap.id });
          saveOp(compensate);
          lastSeq.value = compensate.seq;
        } else if (entry.op.type === "tombstone") {
          // Restore: un-delete
          const node = nodes.value.get(snap.id);
          if (node) {
            node.deleted = false;
            node.deletedAt = undefined;
            const compensate = makeOp("create", {
              type: "create",
              id: snap.id,
              parentId: snap.parentId,
              pos: snap.pos,
              text: snap.text,
              status: snap.status,
            });
            saveOp(compensate);
            lastSeq.value = compensate.seq;
          }
        } else if (entry.op.type === "addTag") {
          const node = nodes.value.get(snap.id);
          if (node) {
            node.tags = snap.tags ? [...snap.tags] : [];
            const tag = (entry.op.payload as { tag: string }).tag;
            const compensate = makeOp("removeTag", { type: "removeTag", id: snap.id, tag });
            saveOp(compensate);
            lastSeq.value = compensate.seq;
          }
        } else if (entry.op.type === "removeTag") {
          const node = nodes.value.get(snap.id);
          if (node) {
            node.tags = snap.tags ? [...snap.tags] : [];
            const tag = (entry.op.payload as { tag: string }).tag;
            const compensate = makeOp("addTag", { type: "addTag", id: snap.id, tag });
            saveOp(compensate);
            lastSeq.value = compensate.seq;
          }
        } else if (entry.op.type === "restore") {
          const node = nodes.value.get(snap.id);
          if (node) {
            node.deleted = snap.deleted;
            node.deletedAt = snap.deletedAt;
            const compensate = makeOp("tombstone", { type: "tombstone", id: snap.id });
            saveOp(compensate);
            lastSeq.value = compensate.seq;
          }
        } else if (entry.op.type === "setDueDate") {
          const node = nodes.value.get(snap.id);
          if (node) {
            node.dueDate = snap.dueDate;
            const compensate = makeOp("setDueDate", {
              type: "setDueDate",
              id: snap.id,
              dueDate: snap.dueDate ?? null,
            });
            saveOp(compensate);
            lastSeq.value = compensate.seq;
          }
        }
      }
    }

    selectedId.value = entry.selectedBefore;
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
      selectedBefore: selectedId.value,
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
      }, 300),
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
        selectedBefore: selectedId.value,
      });
      if (undoStack.length > MAX_UNDO) undoStack.shift();
      redoStack.length = 0;
      _textBeforeSnapshots.delete(id);
    }

    // Persist (don't re-apply to memory, already done)
    lastSeq.value = op.seq;
    opsSinceSnapshot.value++;
    scheduleIndexUpdate();
    scheduleFileSave();
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
    selectedId.value = newId;
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
    if (!isTauri()) await saveStatusConfig(statusConfig.value);
    scheduleFileSave();
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
    if (!isTauri()) await saveStatusConfig(statusConfig.value);
    scheduleFileSave();
  }

  async function updateStatus(statusId: string, updates: Partial<Omit<StatusDef, "id">>) {
    statusConfig.value = statusConfig.value.map((s) =>
      s.id === statusId ? { ...s, ...updates } : s,
    );
    if (!isTauri()) await saveStatusConfig(statusConfig.value);
    scheduleFileSave();
  }

  async function reorderStatuses(orderedIds: string[]) {
    const byId = new Map(statusConfig.value.map((s) => [s.id, s]));
    statusConfig.value = orderedIds.map((id) => byId.get(id)!).filter(Boolean);
    if (!isTauri()) await saveStatusConfig(statusConfig.value);
    scheduleFileSave();
  }

  const trashedNodes = computed(() => {
    const result: Node[] = [];
    for (const node of nodes.value.values()) {
      if (node.deleted && node.parentId !== null) {
        result.push(node);
      }
    }
    return result.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  });

  // ── Outline keyboard actions ──

  function selectedIndex(): number {
    return visibleRows.value.findIndex((r) => r.node.id === selectedId.value);
  }

  function moveSelectionUp() {
    const idx = selectedIndex();
    if (idx > 0) {
      selectedId.value = visibleRows.value[idx - 1]!.node.id;
      editingId.value = null;
    }
  }

  function moveSelectionDown() {
    const idx = selectedIndex();
    if (idx < visibleRows.value.length - 1) {
      selectedId.value = visibleRows.value[idx + 1]!.node.id;
      editingId.value = null;
    }
  }

  function createSiblingBelow() {
    const node = nodes.value.get(selectedId.value);
    if (!node) return;

    const siblings = getChildren(node.parentId!);
    const myIdx = siblings.findIndex((s) => s.id === node.id);
    const nextSibling = siblings[myIdx + 1];

    let pos: string;
    if (nextSibling) {
      pos = rankBetween(node.pos, nextSibling.pos);
    } else {
      pos = rankAfter(node.pos);
    }

    const op = createNode(node.parentId, pos, "", node.status);
    const newId = (op.payload as { id: string }).id;
    selectedId.value = newId;
    editingId.value = newId;
  }

  function indentNode() {
    const idx = selectedIndex();
    if (idx <= 0) return;

    const node = nodes.value.get(selectedId.value);
    if (!node) return;

    // Find previous visible sibling to become new parent
    const prevRow = visibleRows.value[idx - 1]!;
    const newParentId = prevRow.node.id;

    // Put at end of new parent's children
    const newSiblings = getChildren(newParentId);
    let pos: string;
    if (newSiblings.length > 0) {
      pos = rankAfter(newSiblings[newSiblings.length - 1]!.pos);
    } else {
      pos = initialRank();
    }

    moveNode(node.id, newParentId, pos);

    // Ensure new parent is expanded
    const newParent = nodes.value.get(newParentId);
    if (newParent && newParent.collapsed) {
      toggleCollapsed(newParentId);
    }
  }

  function outdentNode() {
    const node = nodes.value.get(selectedId.value);
    if (!node || !node.parentId) return;

    const parent = nodes.value.get(node.parentId);
    if (!parent || !parent.parentId) return; // Can't outdent children of root
    if (parent.id === rootId.value) return;

    // New parent is grandparent
    const grandparentId = parent.parentId;
    const grandparentChildren = getChildren(grandparentId);
    const parentIdx = grandparentChildren.findIndex((s) => s.id === parent.id);
    const nextUncle = grandparentChildren[parentIdx + 1];

    let pos: string;
    if (nextUncle) {
      pos = rankBetween(parent.pos, nextUncle.pos);
    } else {
      pos = rankAfter(parent.pos);
    }

    moveNode(node.id, grandparentId, pos);
  }

  // ── Editing-aware navigation ──

  function editPreviousNode(fromId: string) {
    const idx = visibleRows.value.findIndex((r) => r.node.id === fromId);
    if (idx > 0) {
      const prevId = visibleRows.value[idx - 1]!.node.id;
      selectedId.value = prevId;
      editingId.value = prevId;
      editingTrigger.value = "keyboard";
    }
  }

  function editNextNode(fromId: string) {
    const idx = visibleRows.value.findIndex((r) => r.node.id === fromId);
    if (idx >= 0 && idx < visibleRows.value.length - 1) {
      const nextId = visibleRows.value[idx + 1]!.node.id;
      selectedId.value = nextId;
      editingId.value = nextId;
      editingTrigger.value = "keyboard";
    }
  }

  function deleteNodeAndEditPrevious(id: string) {
    const idx = visibleRows.value.findIndex((r) => r.node.id === id);
    const prevId = idx > 0 ? visibleRows.value[idx - 1]!.node.id : null;
    const nextId = idx < visibleRows.value.length - 1 ? visibleRows.value[idx + 1]!.node.id : null;

    tombstone(id);

    const targetId = prevId ?? nextId;
    if (targetId) {
      selectedId.value = targetId;
      editingId.value = targetId;
      editingTrigger.value = "keyboard";
    } else {
      editingId.value = null;
      editingTrigger.value = null;
    }
  }

  function indentAndKeepEditing(id: string) {
    selectedId.value = id;
    indentNode();
    // Node id doesn't change, just re-assert editing
    editingId.value = id;
    editingTrigger.value = "keyboard";
  }

  function outdentAndKeepEditing(id: string) {
    selectedId.value = id;
    outdentNode();
    editingId.value = id;
    editingTrigger.value = "keyboard";
  }

  function createSiblingBelowAndEdit() {
    const node = nodes.value.get(selectedId.value);
    if (!node) return;

    const siblings = getChildren(node.parentId!);
    const myIdx = siblings.findIndex((s) => s.id === node.id);
    const nextSibling = siblings[myIdx + 1];

    let pos: string;
    if (nextSibling) {
      pos = rankBetween(node.pos, nextSibling.pos);
    } else {
      pos = rankAfter(node.pos);
    }

    const op = createNode(node.parentId, pos, "", node.status);
    const newId = (op.payload as { id: string }).id;
    selectedId.value = newId;
    editingId.value = newId;
    editingTrigger.value = "keyboard";
  }

  // ── Init / Load ──

  async function loadDocument(docId: string) {
    flushTextDebounce();
    // Force-flush any pending file save so the current document is written
    // to disk before we reset state and load the new one.
    if (_fileSaveTimer) {
      clearTimeout(_fileSaveTimer);
      _fileSaveTimer = null;
      await saveToFile();
    }
    if (!isTauri()) {
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
    searchQuery.value = "";
    tagFilter.value = null;
    dueDateFilter.value = "all";
    editingId.value = null;
    editingTrigger.value = null;
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
    if (isTauri() && currentDocId.value) {
      await initFromFile();
      return;
    }
    await initFromIdb();
  }

  async function initFromFile() {
    const { useSettingsStore } = await import("@/stores/settings");
    const settings = useSettingsStore();
    if (!settings.workspacePath || !currentDocId.value) return;

    const { readFile } = await import("@/lib/tauri-fs");
    const filePath = `${settings.workspacePath}/${currentDocId.value}`;

    let content = "";
    try {
      content = await readFile(filePath);
    } catch {
      // New file — will be created on first save
    }

    if (content.trim()) {
      const parsed = parseMarkdown(content);
      rootId.value = parsed.rootId;
      nodes.value = parsed.nodes;
      statusConfig.value = parsed.statusConfig;
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
      selectedId.value = firstChild[0]!.id;
    }

    ready.value = true;
    scheduleIndexUpdate();
  }

  async function refreshFromFile() {
    const { useSettingsStore } = await import("@/stores/settings");
    const settings = useSettingsStore();
    if (!settings.workspacePath || !currentDocId.value) return;

    const { readFile } = await import("@/lib/tauri-fs");
    const filePath = `${settings.workspacePath}/${currentDocId.value}`;

    let content = "";
    try {
      content = await readFile(filePath);
    } catch {
      return;
    }

    if (!content.trim()) return;

    const parsed = parseMarkdown(content);

    // Preserve UI state: carry over collapsed and selection from current nodes
    const oldNodes = nodes.value;
    for (const [id, newNode] of parsed.nodes) {
      const oldNode = oldNodes.get(id);
      if (oldNode) {
        newNode.collapsed = oldNode.collapsed;
      }
    }

    suppressTransitions.value = true;
    rootId.value = parsed.rootId;
    nodes.value = parsed.nodes;
    statusConfig.value = parsed.statusConfig;
    triggerRef(nodes);
    scheduleIndexUpdate();
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
        selectedId.value = firstId;
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

    nodes.value = nodeMap;

    // Set selection to first visible if not set
    if (!selectedId.value || !nodeMap.has(selectedId.value)) {
      const firstChild = getChildren(rootId.value);
      if (firstChild.length > 0) {
        selectedId.value = firstChild[0]!.id;
      }
    }

    ready.value = true;

    // Update cross-document search index
    scheduleIndexUpdate();
  }

  function selectNode(id: string) {
    selectedId.value = id;
    selectedIds.value = new Set([id]);
    selectionAnchor.value = id;
  }

  function clearSelection() {
    selectedId.value = '';
    selectedIds.value = new Set();
    selectionAnchor.value = '';
  }

  function toggleSelectNode(id: string) {
    const newSet = new Set(selectedIds.value);
    if (newSet.has(id)) {
      newSet.delete(id);
      // Update selectedId to last remaining or the toggled one
      if (newSet.size > 0) {
        selectedId.value = [...newSet][newSet.size - 1]!;
      }
    } else {
      newSet.add(id);
      selectedId.value = id;
    }
    selectedIds.value = newSet;
    selectionAnchor.value = id;
  }

  function rangeSelectTo(id: string) {
    const rows = visibleRows.value;
    const anchorIdx = rows.findIndex((r) => r.node.id === selectionAnchor.value);
    const targetIdx = rows.findIndex((r) => r.node.id === id);
    if (anchorIdx === -1 || targetIdx === -1) return;

    const start = Math.min(anchorIdx, targetIdx);
    const end = Math.max(anchorIdx, targetIdx);
    const newSet = new Set<string>();
    for (let i = start; i <= end; i++) {
      newSet.add(rows[i]!.node.id);
    }
    selectedIds.value = newSet;
    selectedId.value = id;
  }

  function isSelected(id: string): boolean {
    return selectedIds.value.has(id);
  }

  function bulkSetStatus(status: Status) {
    for (const id of selectedIds.value) {
      const op = makeOp("setStatus", { type: "setStatus", id, status });
      dispatch(op);
    }
  }

  function bulkTombstone() {
    const rows = visibleRows.value;
    const ids = selectedIds.value;
    // Find first row after selection for focus
    // Find a row to focus after deletion: prefer first non-selected row after the last selected
    let lastSelectedIdx = -1;
    let firstSelectedIdx = -1;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (ids.has(rows[i]!.node.id)) {
        if (lastSelectedIdx === -1) lastSelectedIdx = i;
        firstSelectedIdx = i;
      }
    }
    let nextId: string | null = null;
    for (let i = lastSelectedIdx + 1; i < rows.length; i++) {
      if (!ids.has(rows[i]!.node.id)) {
        nextId = rows[i]!.node.id;
        break;
      }
    }
    if (!nextId && firstSelectedIdx > 0) {
      nextId = rows[firstSelectedIdx - 1]!.node.id;
    }
    for (const id of ids) {
      const op = makeOp("tombstone", { type: "tombstone", id });
      dispatch(op);
    }
    if (nextId) {
      selectNode(nextId);
    } else {
      selectedIds.value = new Set();
    }
  }

  function startEditing(id: string, trigger: "keyboard" | "click" | "dblclick" = "keyboard") {
    editingTrigger.value = trigger;
    editingId.value = id;
  }

  function stopEditing() {
    editingId.value = null;
    editingTrigger.value = null;
  }

  function setViewMode(mode: ViewMode) {
    viewMode.value = mode;
  }

  function zoomIn(id: string) {
    zoomId.value = id;
  }

  function zoomOut() {
    if (!zoomId.value) return;
    const node = nodes.value.get(zoomId.value);
    if (node && node.parentId && node.parentId !== rootId.value) {
      zoomId.value = node.parentId;
    } else {
      zoomId.value = null;
    }
  }

  // ── Zoom breadcrumb path ──
  const zoomBreadcrumbs = computed(() => {
    const crumbs: { id: string; text: string }[] = [];
    if (!zoomId.value) return crumbs;
    let cur = nodes.value.get(zoomId.value);
    while (cur && cur.id !== rootId.value) {
      crumbs.unshift({ id: cur.id, text: cur.text || "(empty)" });
      if (!cur.parentId) break;
      cur = nodes.value.get(cur.parentId);
    }
    return crumbs;
  });

  // ── Export / Import / Reset ──

  function exportJSON(): string {
    flushTextDebounce();
    // Note: flushOpBuffer is async but export is sync; the buffer will flush soon via timer
    const allNodes = Array.from(nodes.value.values());
    const doc = {
      version: 3,
      rootId: rootId.value,
      nodes: allNodes,
      statusConfig: statusConfig.value,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(doc, null, 2);
  }

  type ExportFormat = "json" | "markdown" | "opml" | "plaintext";

  function downloadExport(format: ExportFormat = "json") {
    flushTextDebounce();
    let content: string;
    let ext: string;
    let mime: string;

    const sMap = statusMap.value;
    switch (format) {
      case "markdown":
        content = exportToMarkdown(nodes.value, rootId.value, sMap, zoomId.value);
        ext = "md";
        mime = "text/markdown";
        break;
      case "opml":
        content = exportToOPML(nodes.value, rootId.value, sMap, zoomId.value);
        ext = "opml";
        mime = "application/xml";
        break;
      case "plaintext":
        content = exportToPlaintext(nodes.value, rootId.value, sMap, zoomId.value);
        ext = "txt";
        mime = "text/plain";
        break;
      default:
        content = exportJSON();
        ext = "json";
        mime = "application/json";
        break;
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strata-export-${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
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

    // Update state
    rootId.value = doc.rootId;
    nodes.value = nodeMap;
    zoomId.value = null;
    lastSeq.value = ops[ops.length - 1]?.seq ?? 0;
    opsSinceSnapshot.value = ops.length;

    // Select first child
    const firstChild = getChildren(rootId.value);
    if (firstChild.length > 0) {
      selectedId.value = firstChild[0]!.id;
    }
    editingId.value = null;
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
    selectedId.value = "";
    editingId.value = null;
    editingTrigger.value = null;
    zoomId.value = null;
    searchQuery.value = "";
    tagFilter.value = null;
    dueDateFilter.value = "all";
    currentDocId.value = "";
  }

  async function resetDocument() {
    await clearAll();
    undoStack.length = 0;
    redoStack.length = 0;
    ready.value = false;
    zoomId.value = null;
    searchQuery.value = "";
    setSeq(0);
    await init();
  }

  function navigateToNode(nodeId: string) {
    // Expand all ancestors so the node becomes visible
    let cur = nodes.value.get(nodeId);
    while (cur && cur.parentId) {
      const parent = nodes.value.get(cur.parentId);
      if (parent && parent.collapsed) {
        const op = makeOp("toggleCollapsed", { type: "toggleCollapsed", id: parent.id });
        dispatch(op, false);
      }
      cur = parent;
    }
    // Clear zoom so node is reachable
    zoomId.value = null;
    selectedId.value = nodeId;
  }

  return {
    // State
    nodes,
    rootId,
    zoomId,
    selectedId,
    editingId,
    editingTrigger,
    viewMode,
    ready,
    searchQuery,
    tagFilter,
    dueDateFilter,
    statusConfig,
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
    navigateToNode,
    addStatus,
    removeStatus,
    updateStatus,
    reorderStatuses,
    duplicateNode,
    moveSelectionUp,
    moveSelectionDown,
    createSiblingBelow,
    indentNode,
    outdentNode,
    editPreviousNode,
    editNextNode,
    deleteNodeAndEditPrevious,
    indentAndKeepEditing,
    outdentAndKeepEditing,
    createSiblingBelowAndEdit,
    selectNode,
    clearSelection,
    selectedIds,
    toggleSelectNode,
    rangeSelectTo,
    isSelected,
    bulkSetStatus,
    bulkTombstone,
    startEditing,
    stopEditing,
    setViewMode,
    zoomIn,
    zoomOut,
    undo,
    redo,
    zoomBreadcrumbs,
    exportJSON,
    downloadExport,
    importJSON,
    importNodes,
    resetDocument,
    suppressTransitions,
    saveToFile,
    hasUnsavedChanges,
    recentlyWritten,
    refreshFromFile,
  };
});
