import { defineStore } from 'pinia'
import { ref, computed, shallowRef, triggerRef } from 'vue'
import type { Node, Op, Status, ViewMode, Snapshot } from '@/types'
import { makeOp, applyOp, rebuildState, setSeq } from '@/lib/ops'
import { rankBetween, rankAfter, rankBefore, initialRank } from '@/lib/rank'
import {
  saveOp,
  saveOps,
  loadOpsAfter,
  loadLatestSnapshot,
  saveSnapshot,
  loadAllOps,
  clearAll,
  flushOpBuffer,
} from '@/lib/idb'

const SNAPSHOT_INTERVAL = 200

export const useDocStore = defineStore('doc', () => {
  // ── Core state ──
  // Using shallowRef + manual trigger for the Map to avoid deep reactivity overhead
  const nodes = shallowRef<Map<string, Node>>(new Map())
  const rootId = ref<string>('')
  const zoomId = ref<string | null>(null)
  const selectedId = ref<string>('')
  const editingId = ref<string | null>(null)
  const editingTrigger = ref<'keyboard' | 'click' | 'dblclick' | null>(null)
  const viewMode = ref<ViewMode>('split')
  const ready = ref(false)
  const searchQuery = ref('')

  // Op tracking
  const opsSinceSnapshot = ref(0)
  const lastSeq = ref(0)

  // ── Undo / Redo ──
  interface UndoEntry {
    op: Op
    beforeSnapshots: Node[] // deep copies of affected nodes before op
    selectedBefore: string
  }
  const undoStack: UndoEntry[] = []
  const redoStack: UndoEntry[] = []
  const MAX_UNDO = 200

  // ── Helpers: children lookup (cached per trigger) ──
  const childrenMap = computed(() => {
    const map = new Map<string | null, Node[]>()
    for (const node of nodes.value.values()) {
      if (node.deleted) continue
      const pid = node.parentId
      let arr = map.get(pid)
      if (!arr) {
        arr = []
        map.set(pid, arr)
      }
      arr.push(node)
    }
    // Sort each group by pos
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0))
    }
    return map
  })

  function getChildren(parentId: string): Node[] {
    return childrenMap.value.get(parentId) ?? []
  }

  // ── Visible rows (flattened DFS for outline) ──
  const effectiveZoomId = computed(() => zoomId.value ?? rootId.value)

  // ── Search: set of matching node IDs + ancestors that should be visible ──
  const searchMatchIds = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return null
    const matches = new Set<string>()
    for (const node of nodes.value.values()) {
      if (node.deleted) continue
      if (node.text.toLowerCase().includes(q)) {
        matches.add(node.id)
        // Also mark all ancestors visible so the match is reachable
        let cur = node
        while (cur.parentId) {
          matches.add(cur.parentId)
          const parent = nodes.value.get(cur.parentId)
          if (!parent) break
          cur = parent
        }
      }
    }
    return matches
  })

  const visibleRows = computed(() => {
    const rows: { node: Node; depth: number }[] = []
    const root = effectiveZoomId.value
    if (!root) return rows
    const filter = searchMatchIds.value

    function walk(parentId: string, depth: number) {
      const children = getChildren(parentId)
      for (const child of children) {
        if (filter && !filter.has(child.id)) continue
        rows.push({ node: child, depth })
        if (!child.collapsed || filter) {
          walk(child.id, depth + 1)
        }
      }
    }
    walk(root, 0)
    return rows
  })

  // ── Kanban: nodes grouped by status ──
  function subtreeNodes(rootNodeId: string): Node[] {
    const result: Node[] = []
    function walk(pid: string) {
      const children = getChildren(pid)
      for (const child of children) {
        result.push(child)
        walk(child.id)
      }
    }
    walk(rootNodeId)
    return result
  }

  const kanbanNodes = computed(() => {
    const root = effectiveZoomId.value
    if (!root) return []
    return subtreeNodes(root)
  })

  const kanbanColumns = computed(() => {
    const cols: Record<Status, Node[]> = {
      todo: [],
      in_progress: [],
      blocked: [],
      done: [],
    }
    for (const node of kanbanNodes.value) {
      cols[node.status].push(node)
    }
    return cols
  })

  // ── Breadcrumb path for a node ──
  function breadcrumb(nodeId: string): string {
    const parts: string[] = []
    let cur = nodes.value.get(nodeId)
    while (cur && cur.parentId && cur.parentId !== effectiveZoomId.value) {
      const parent = nodes.value.get(cur.parentId)
      if (parent && !parent.deleted) {
        parts.unshift(parent.text || '(empty)')
      }
      cur = parent
    }
    return parts.join(' > ')
  }

  // ── Op dispatch ──
  function getAffectedIds(op: Op): string[] {
    const p = op.payload as { id?: string }
    return p.id ? [p.id] : []
  }

  async function dispatch(op: Op, recordUndo = true) {
    if (recordUndo) {
      // Snapshot affected nodes before mutation
      const ids = getAffectedIds(op)
      const beforeSnapshots: Node[] = []
      for (const id of ids) {
        const node = nodes.value.get(id)
        if (node) beforeSnapshots.push({ ...node })
      }
      undoStack.push({
        op,
        beforeSnapshots,
        selectedBefore: selectedId.value,
      })
      if (undoStack.length > MAX_UNDO) undoStack.shift()
      // Clear redo on new action
      redoStack.length = 0
    }

    applyOp(nodes.value, op)
    // Replace affected nodes with new object references so child components
    // (which receive node as a prop) detect the change and re-render.
    // shallowRef + triggerRef alone won't help because the Map values are
    // the same object references after in-place mutation.
    for (const id of getAffectedIds(op)) {
      const node = nodes.value.get(id)
      if (node) nodes.value.set(id, { ...node })
    }
    triggerRef(nodes)
    lastSeq.value = op.seq
    opsSinceSnapshot.value++

    await saveOp(op)

    if (opsSinceSnapshot.value >= SNAPSHOT_INTERVAL) {
      await takeSnapshot()
    }
  }

  function undo() {
    const entry = undoStack.pop()
    if (!entry) return

    // Restore node snapshots
    for (const snap of entry.beforeSnapshots) {
      nodes.value.set(snap.id, { ...snap })
    }
    // Handle create undo: if the op created a node, remove it
    if (entry.op.type === 'create') {
      const id = (entry.op.payload as { id: string }).id
      const node = nodes.value.get(id)
      if (node) {
        node.deleted = true
      }
    }
    triggerRef(nodes)

    // Persist a compensating op
    if (entry.op.type === 'create') {
      const id = (entry.op.payload as { id: string }).id
      const compensate = makeOp('tombstone', { type: 'tombstone', id })
      saveOp(compensate)
      lastSeq.value = compensate.seq
    } else {
      // For other ops, write the restored state as new ops
      for (const snap of entry.beforeSnapshots) {
        if (entry.op.type === 'updateText') {
          const compensate = makeOp('updateText', { type: 'updateText', id: snap.id, text: snap.text })
          saveOp(compensate)
          lastSeq.value = compensate.seq
        } else if (entry.op.type === 'move') {
          const compensate = makeOp('move', { type: 'move', id: snap.id, parentId: snap.parentId, pos: snap.pos })
          saveOp(compensate)
          lastSeq.value = compensate.seq
        } else if (entry.op.type === 'setStatus') {
          const compensate = makeOp('setStatus', { type: 'setStatus', id: snap.id, status: snap.status })
          saveOp(compensate)
          lastSeq.value = compensate.seq
        } else if (entry.op.type === 'toggleCollapsed') {
          const compensate = makeOp('toggleCollapsed', { type: 'toggleCollapsed', id: snap.id })
          saveOp(compensate)
          lastSeq.value = compensate.seq
        } else if (entry.op.type === 'tombstone') {
          // Restore: un-delete
          const node = nodes.value.get(snap.id)
          if (node) {
            node.deleted = false
            const compensate = makeOp('create', {
              type: 'create',
              id: snap.id,
              parentId: snap.parentId,
              pos: snap.pos,
              text: snap.text,
              status: snap.status,
            })
            saveOp(compensate)
            lastSeq.value = compensate.seq
          }
        }
      }
    }

    selectedId.value = entry.selectedBefore
    redoStack.push(entry)
  }

  function redo() {
    const entry = redoStack.pop()
    if (!entry) return

    // Re-apply the original op
    const reOp = makeOp(entry.op.type, entry.op.payload)

    // Capture current state for undo
    const ids = getAffectedIds(reOp)
    const beforeSnapshots: Node[] = []
    for (const id of ids) {
      const node = nodes.value.get(id)
      if (node) beforeSnapshots.push({ ...node })
    }
    undoStack.push({
      op: reOp,
      beforeSnapshots,
      selectedBefore: selectedId.value,
    })

    applyOp(nodes.value, reOp)
    triggerRef(nodes)
    lastSeq.value = reOp.seq
    opsSinceSnapshot.value++
    saveOp(reOp)
  }

  async function takeSnapshot() {
    await flushOpBuffer()
    const snap: Snapshot = {
      id: crypto.randomUUID(),
      nodes: Array.from(nodes.value.values()),
      rootId: rootId.value,
      seqAfter: lastSeq.value,
      ts: Date.now(),
    }
    await saveSnapshot(snap)
    opsSinceSnapshot.value = 0
  }

  // ── Actions ──

  function createNode(
    parentId: string | null,
    pos: string,
    text: string = '',
    status: Status = 'todo',
  ): Op {
    const id = crypto.randomUUID()
    const op = makeOp('create', {
      type: 'create',
      id,
      parentId,
      pos,
      text,
      status,
    })
    dispatch(op)
    return op
  }

  // ── Debounced text update ──
  // Immediate in-memory mutation for responsive UI; op emitted after 300ms pause
  const _textDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

  function updateText(id: string, text: string) {
    // Apply to memory immediately
    const node = nodes.value.get(id)
    if (node) {
      node.text = text
      triggerRef(nodes)
    }

    // Debounce the persistent op
    const existing = _textDebounceTimers.get(id)
    if (existing) clearTimeout(existing)
    _textDebounceTimers.set(
      id,
      setTimeout(() => {
        _textDebounceTimers.delete(id)
        const op = makeOp('updateText', { type: 'updateText', id, text })
        // Don't re-apply to memory (already done), just persist
        lastSeq.value = op.seq
        opsSinceSnapshot.value++
        saveOp(op).then(() => {
          if (opsSinceSnapshot.value >= SNAPSHOT_INTERVAL) {
            takeSnapshot()
          }
        })
      }, 300),
    )
  }

  function flushTextDebounce() {
    for (const [id, timer] of _textDebounceTimers) {
      clearTimeout(timer)
      _textDebounceTimers.delete(id)
      const node = nodes.value.get(id)
      if (node) {
        const op = makeOp('updateText', { type: 'updateText', id, text: node.text })
        lastSeq.value = op.seq
        opsSinceSnapshot.value++
        saveOp(op)
      }
    }
  }

  function moveNode(id: string, parentId: string | null, pos: string) {
    const op = makeOp('move', { type: 'move', id, parentId, pos })
    dispatch(op)
  }

  function setStatus(id: string, status: Status) {
    const op = makeOp('setStatus', { type: 'setStatus', id, status })
    dispatch(op)
  }

  function toggleCollapsed(id: string) {
    const op = makeOp('toggleCollapsed', { type: 'toggleCollapsed', id })
    dispatch(op)
  }

  function duplicateNode(id: string) {
    const node = nodes.value.get(id)
    if (!node || !node.parentId) return

    const siblings = getChildren(node.parentId)
    const myIdx = siblings.findIndex((s) => s.id === node.id)
    const nextSibling = siblings[myIdx + 1]

    let pos: string
    if (nextSibling) {
      pos = rankBetween(node.pos, nextSibling.pos)
    } else {
      pos = rankAfter(node.pos)
    }

    const op = createNode(node.parentId, pos, node.text, node.status)
    const newId = (op.payload as { id: string }).id
    selectedId.value = newId
  }

  function tombstone(id: string) {
    // Also tombstone descendants
    function deleteTree(nid: string) {
      const children = getChildren(nid)
      for (const child of children) {
        deleteTree(child.id)
      }
      const op = makeOp('tombstone', { type: 'tombstone', id: nid })
      dispatch(op)
    }
    deleteTree(id)
  }

  // ── Outline keyboard actions ──

  function selectedIndex(): number {
    return visibleRows.value.findIndex((r) => r.node.id === selectedId.value)
  }

  function moveSelectionUp() {
    const idx = selectedIndex()
    if (idx > 0) {
      selectedId.value = visibleRows.value[idx - 1]!.node.id
      editingId.value = null
    }
  }

  function moveSelectionDown() {
    const idx = selectedIndex()
    if (idx < visibleRows.value.length - 1) {
      selectedId.value = visibleRows.value[idx + 1]!.node.id
      editingId.value = null
    }
  }

  function createSiblingBelow() {
    const node = nodes.value.get(selectedId.value)
    if (!node) return

    const siblings = getChildren(node.parentId!)
    const myIdx = siblings.findIndex((s) => s.id === node.id)
    const nextSibling = siblings[myIdx + 1]

    let pos: string
    if (nextSibling) {
      pos = rankBetween(node.pos, nextSibling.pos)
    } else {
      pos = rankAfter(node.pos)
    }

    const op = createNode(node.parentId, pos, '', node.status)
    const newId = (op.payload as { id: string }).id
    selectedId.value = newId
    editingId.value = newId
  }

  function indentNode() {
    const idx = selectedIndex()
    if (idx <= 0) return

    const node = nodes.value.get(selectedId.value)
    if (!node) return

    // Find previous visible sibling to become new parent
    const prevRow = visibleRows.value[idx - 1]!
    const newParentId = prevRow.node.id

    // Put at end of new parent's children
    const newSiblings = getChildren(newParentId)
    let pos: string
    if (newSiblings.length > 0) {
      pos = rankAfter(newSiblings[newSiblings.length - 1]!.pos)
    } else {
      pos = initialRank()
    }

    moveNode(node.id, newParentId, pos)

    // Ensure new parent is expanded
    const newParent = nodes.value.get(newParentId)
    if (newParent && newParent.collapsed) {
      toggleCollapsed(newParentId)
    }
  }

  function outdentNode() {
    const node = nodes.value.get(selectedId.value)
    if (!node || !node.parentId) return

    const parent = nodes.value.get(node.parentId)
    if (!parent || !parent.parentId) return // Can't outdent children of root
    if (parent.id === rootId.value) return

    // New parent is grandparent
    const grandparentId = parent.parentId
    const grandparentChildren = getChildren(grandparentId)
    const parentIdx = grandparentChildren.findIndex((s) => s.id === parent.id)
    const nextUncle = grandparentChildren[parentIdx + 1]

    let pos: string
    if (nextUncle) {
      pos = rankBetween(parent.pos, nextUncle.pos)
    } else {
      pos = rankAfter(parent.pos)
    }

    moveNode(node.id, grandparentId, pos)
  }

  // ── Editing-aware navigation ──

  function editPreviousNode(fromId: string) {
    const idx = visibleRows.value.findIndex((r) => r.node.id === fromId)
    if (idx > 0) {
      const prevId = visibleRows.value[idx - 1]!.node.id
      selectedId.value = prevId
      editingId.value = prevId
      editingTrigger.value = 'keyboard'
    }
  }

  function editNextNode(fromId: string) {
    const idx = visibleRows.value.findIndex((r) => r.node.id === fromId)
    if (idx >= 0 && idx < visibleRows.value.length - 1) {
      const nextId = visibleRows.value[idx + 1]!.node.id
      selectedId.value = nextId
      editingId.value = nextId
      editingTrigger.value = 'keyboard'
    }
  }

  function deleteNodeAndEditPrevious(id: string) {
    const idx = visibleRows.value.findIndex((r) => r.node.id === id)
    const prevId = idx > 0 ? visibleRows.value[idx - 1]!.node.id : null
    const nextId = idx < visibleRows.value.length - 1 ? visibleRows.value[idx + 1]!.node.id : null

    tombstone(id)

    const targetId = prevId ?? nextId
    if (targetId) {
      selectedId.value = targetId
      editingId.value = targetId
      editingTrigger.value = 'keyboard'
    } else {
      editingId.value = null
      editingTrigger.value = null
    }
  }

  function indentAndKeepEditing(id: string) {
    selectedId.value = id
    indentNode()
    // Node id doesn't change, just re-assert editing
    editingId.value = id
    editingTrigger.value = 'keyboard'
  }

  function outdentAndKeepEditing(id: string) {
    selectedId.value = id
    outdentNode()
    editingId.value = id
    editingTrigger.value = 'keyboard'
  }

  function createSiblingBelowAndEdit() {
    const node = nodes.value.get(selectedId.value)
    if (!node) return

    const siblings = getChildren(node.parentId!)
    const myIdx = siblings.findIndex((s) => s.id === node.id)
    const nextSibling = siblings[myIdx + 1]

    let pos: string
    if (nextSibling) {
      pos = rankBetween(node.pos, nextSibling.pos)
    } else {
      pos = rankAfter(node.pos)
    }

    const op = createNode(node.parentId, pos, '', node.status)
    const newId = (op.payload as { id: string }).id
    selectedId.value = newId
    editingId.value = newId
    editingTrigger.value = 'keyboard'
  }

  // ── Init / Load ──

  async function init() {
    const snapshot = await loadLatestSnapshot()

    let nodeMap: Map<string, Node>
    let baseSeq = 0

    if (snapshot) {
      nodeMap = new Map(snapshot.nodes.map((n) => [n.id, { ...n }]))
      rootId.value = snapshot.rootId
      baseSeq = snapshot.seqAfter
      setSeq(baseSeq)

      const recentOps = await loadOpsAfter(baseSeq)
      for (const op of recentOps) {
        applyOp(nodeMap, op)
        if (op.seq > baseSeq) baseSeq = op.seq
      }
      setSeq(baseSeq)
      lastSeq.value = baseSeq
      opsSinceSnapshot.value = recentOps.length
    } else {
      // Check if there are any ops at all
      const allOps = await loadAllOps()
      if (allOps.length > 0) {
        nodeMap = rebuildState([], allOps)
        // Find root (node with parentId === null)
        for (const [id, node] of nodeMap) {
          if (node.parentId === null && !node.deleted) {
            rootId.value = id
            break
          }
        }
        const maxSeq = allOps.reduce((m, o) => Math.max(m, o.seq), 0)
        setSeq(maxSeq)
        lastSeq.value = maxSeq
        opsSinceSnapshot.value = allOps.length
      } else {
        // Brand new document
        nodeMap = new Map()
        const rId = crypto.randomUUID()
        rootId.value = rId
        nodeMap.set(rId, {
          id: rId,
          parentId: null,
          pos: initialRank(),
          text: 'Root',
          collapsed: false,
          status: 'todo',
          deleted: false,
        })

        // Create starter nodes for onboarding
        const starters = [
          { text: 'Welcome to Strata', status: 'in_progress' as Status },
          { text: 'Try pressing Enter to create a new item', status: 'todo' as Status },
          { text: 'Use Tab to indent, Shift+Tab to outdent', status: 'todo' as Status },
          { text: 'Ctrl+1/2/3/4 to change status', status: 'todo' as Status },
          { text: 'Right-click for more options', status: 'todo' as Status },
          { text: 'Drag cards between Kanban columns', status: 'done' as Status },
        ]
        let prevPos = ''
        const firstId = crypto.randomUUID()
        for (let i = 0; i < starters.length; i++) {
          const s = starters[i]!
          const id = i === 0 ? firstId : crypto.randomUUID()
          const pos = prevPos ? rankAfter(prevPos) : initialRank()
          prevPos = pos
          nodeMap.set(id, {
            id,
            parentId: rId,
            pos,
            text: s.text,
            collapsed: false,
            status: s.status,
            deleted: false,
          })
        }

        // Save initial ops
        const ops: Op[] = []
        for (const node of nodeMap.values()) {
          ops.push(
            makeOp('create', {
              type: 'create',
              id: node.id,
              parentId: node.parentId,
              pos: node.pos,
              text: node.text,
              status: node.status,
            }),
          )
        }
        await saveOps(ops)
        lastSeq.value = ops[ops.length - 1]?.seq ?? 0
        selectedId.value = firstId
      }
    }

    nodes.value = nodeMap

    // Set selection to first visible if not set
    if (!selectedId.value || !nodeMap.has(selectedId.value)) {
      const firstChild = getChildren(rootId.value)
      if (firstChild.length > 0) {
        selectedId.value = firstChild[0]!.id
      }
    }

    ready.value = true
  }

  function selectNode(id: string) {
    selectedId.value = id
  }

  function startEditing(id: string, trigger: 'keyboard' | 'click' | 'dblclick' = 'keyboard') {
    editingTrigger.value = trigger
    editingId.value = id
  }

  function stopEditing() {
    editingId.value = null
    editingTrigger.value = null
  }

  function setViewMode(mode: ViewMode) {
    viewMode.value = mode
  }

  function zoomIn(id: string) {
    zoomId.value = id
  }

  function zoomOut() {
    if (!zoomId.value) return
    const node = nodes.value.get(zoomId.value)
    if (node && node.parentId && node.parentId !== rootId.value) {
      zoomId.value = node.parentId
    } else {
      zoomId.value = null
    }
  }

  // ── Zoom breadcrumb path ──
  const zoomBreadcrumbs = computed(() => {
    const crumbs: { id: string; text: string }[] = []
    if (!zoomId.value) return crumbs
    let cur = nodes.value.get(zoomId.value)
    while (cur && cur.id !== rootId.value) {
      crumbs.unshift({ id: cur.id, text: cur.text || '(empty)' })
      if (!cur.parentId) break
      cur = nodes.value.get(cur.parentId)
    }
    return crumbs
  })

  // ── Export / Import / Reset ──

  function exportJSON(): string {
    flushTextDebounce()
    // Note: flushOpBuffer is async but export is sync; the buffer will flush soon via timer
    const allNodes = Array.from(nodes.value.values())
    const doc = {
      version: 1,
      rootId: rootId.value,
      nodes: allNodes,
      exportedAt: new Date().toISOString(),
    }
    return JSON.stringify(doc, null, 2)
  }

  function downloadExport() {
    const json = exportJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `strata-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importJSON(json: string) {
    const doc = JSON.parse(json)
    if (!doc.version || !doc.rootId || !Array.isArray(doc.nodes)) {
      throw new Error('Invalid Strata export file')
    }

    // Clear existing data
    await clearAll()
    undoStack.length = 0
    redoStack.length = 0

    // Build new node map
    const nodeMap = new Map<string, Node>()
    for (const n of doc.nodes as Node[]) {
      nodeMap.set(n.id, { ...n })
    }

    // Persist as ops
    setSeq(0)
    const ops: Op[] = []
    for (const node of nodeMap.values()) {
      ops.push(
        makeOp('create', {
          type: 'create',
          id: node.id,
          parentId: node.parentId,
          pos: node.pos,
          text: node.text,
          status: node.status,
        }),
      )
    }
    await saveOps(ops)

    // Update state
    rootId.value = doc.rootId
    nodes.value = nodeMap
    zoomId.value = null
    lastSeq.value = ops[ops.length - 1]?.seq ?? 0
    opsSinceSnapshot.value = ops.length

    // Select first child
    const firstChild = getChildren(rootId.value)
    if (firstChild.length > 0) {
      selectedId.value = firstChild[0]!.id
    }
    editingId.value = null
  }

  async function resetDocument() {
    await clearAll()
    undoStack.length = 0
    redoStack.length = 0
    ready.value = false
    zoomId.value = null
    searchQuery.value = ''
    setSeq(0)
    await init()
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
    // Computed
    childrenMap,
    searchMatchIds,
    visibleRows,
    kanbanColumns,
    kanbanNodes,
    effectiveZoomId,
    // Methods
    getChildren,
    breadcrumb,
    init,
    createNode,
    updateText,
    flushTextDebounce,
    moveNode,
    setStatus,
    toggleCollapsed,
    tombstone,
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
    resetDocument,
  }
})
