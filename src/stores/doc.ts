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
  const viewMode = ref<ViewMode>('split')
  const ready = ref(false)

  // Op tracking
  const opsSinceSnapshot = ref(0)
  const lastSeq = ref(0)

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

  const visibleRows = computed(() => {
    const rows: { node: Node; depth: number }[] = []
    const root = effectiveZoomId.value
    if (!root) return rows

    function walk(parentId: string, depth: number) {
      const children = getChildren(parentId)
      for (const child of children) {
        rows.push({ node: child, depth })
        if (!child.collapsed) {
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
  async function dispatch(op: Op) {
    applyOp(nodes.value, op)
    triggerRef(nodes)
    lastSeq.value = op.seq
    opsSinceSnapshot.value++

    await saveOp(op)

    if (opsSinceSnapshot.value >= SNAPSHOT_INTERVAL) {
      await takeSnapshot()
    }
  }

  async function takeSnapshot() {
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

  function updateText(id: string, text: string) {
    const op = makeOp('updateText', { type: 'updateText', id, text })
    dispatch(op)
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

        // Create a few starter nodes
        const firstId = crypto.randomUUID()
        const firstPos = initialRank()
        nodeMap.set(firstId, {
          id: firstId,
          parentId: rId,
          pos: firstPos,
          text: 'First item',
          collapsed: false,
          status: 'todo',
          deleted: false,
        })

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

  function startEditing(id: string) {
    editingId.value = id
  }

  function stopEditing() {
    editingId.value = null
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

  return {
    // State
    nodes,
    rootId,
    zoomId,
    selectedId,
    editingId,
    viewMode,
    ready,
    // Computed
    childrenMap,
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
    moveNode,
    setStatus,
    toggleCollapsed,
    tombstone,
    moveSelectionUp,
    moveSelectionDown,
    createSiblingBelow,
    indentNode,
    outdentNode,
    selectNode,
    startEditing,
    stopEditing,
    setViewMode,
    zoomIn,
    zoomOut,
  }
})
