import { type Ref, type ShallowRef, type ComputedRef } from 'vue'
import type { Node, Op, Status, ViewMode } from '@/types'
import { rankBetween, rankAfter, initialRank } from '@/lib/rank'
import { makeOp } from '@/lib/ops'

interface DocNavDeps {
  nodes: ShallowRef<Map<string, Node>>
  rootId: Ref<string>
  editing: {
    id: string | null
    trigger: 'keyboard' | 'click' | 'dblclick' | null
    focusBody: boolean
    cursorColumn: number | null
  }
  selection: { current: string; ids: Set<string>; anchor: string }
  filters: { search: string; tag: string | null; dueDate: string }
  viewMode: Ref<ViewMode>
  zoomId: Ref<string | null>
  visibleRows: ComputedRef<{ node: Node; depth: number }[]>
  childrenMap: ComputedRef<Map<string | null, Node[]>>
  // Functions from doc core that nav needs to call:
  dispatch: (op: Op, recordUndo?: boolean) => void
  createNode: (parentId: string | null, pos: string, text?: string, status?: Status) => Op
  moveNode: (id: string, parentId: string | null, pos: string) => void
  tombstone: (id: string) => void
  toggleCollapsed: (id: string) => void
  flushTextDebounce: () => void
}

export function useDocNav(deps: DocNavDeps) {
  const { nodes, rootId, editing, selection, viewMode, zoomId, visibleRows, childrenMap } = deps

  function getChildren(parentId: string): Node[] {
    return childrenMap.value.get(parentId) ?? []
  }

  // ── Selection functions ──

  function selectNode(id: string) {
    selection.current = id
    selection.ids = new Set([id])
    selection.anchor = id
  }

  function clearSelection() {
    selection.current = ''
    selection.ids = new Set()
    selection.anchor = ''
  }

  function toggleSelectNode(id: string) {
    const newSet = new Set(selection.ids)
    if (newSet.has(id)) {
      newSet.delete(id)
      if (newSet.size > 0) {
        selection.current = [...newSet][newSet.size - 1]!
      }
    } else {
      newSet.add(id)
      selection.current = id
    }
    selection.ids = newSet
    selection.anchor = id
  }

  function rangeSelectTo(id: string) {
    const rows = visibleRows.value
    const anchorIdx = rows.findIndex((r) => r.node.id === selection.anchor)
    const targetIdx = rows.findIndex((r) => r.node.id === id)
    if (anchorIdx === -1 || targetIdx === -1) return

    const start = Math.min(anchorIdx, targetIdx)
    const end = Math.max(anchorIdx, targetIdx)
    const newSet = new Set<string>()
    for (let i = start; i <= end; i++) {
      newSet.add(rows[i]!.node.id)
    }
    selection.ids = newSet
    selection.current = id
  }

  function isSelected(id: string): boolean {
    return selection.ids.has(id)
  }

  function bulkSetStatus(status: Status) {
    for (const id of selection.ids) {
      const op = makeOp('setStatus', { type: 'setStatus', id, status })
      deps.dispatch(op)
    }
  }

  function bulkTombstone() {
    const rows = visibleRows.value
    const ids = selection.ids
    let lastSelectedIdx = -1
    let firstSelectedIdx = -1
    for (let i = rows.length - 1; i >= 0; i--) {
      if (ids.has(rows[i]!.node.id)) {
        if (lastSelectedIdx === -1) lastSelectedIdx = i
        firstSelectedIdx = i
      }
    }
    let nextId: string | null = null
    for (let i = lastSelectedIdx + 1; i < rows.length; i++) {
      if (!ids.has(rows[i]!.node.id)) {
        nextId = rows[i]!.node.id
        break
      }
    }
    if (!nextId && firstSelectedIdx > 0) {
      nextId = rows[firstSelectedIdx - 1]!.node.id
    }
    for (const id of ids) {
      const op = makeOp('tombstone', { type: 'tombstone', id })
      deps.dispatch(op)
    }
    if (nextId) {
      selectNode(nextId)
    } else {
      selection.ids = new Set()
    }
  }

  // ── Edit state ──

  function startEditing(id: string, trigger: 'keyboard' | 'click' | 'dblclick' = 'keyboard') {
    editing.trigger = trigger
    editing.focusBody = false
    editing.cursorColumn = null
    editing.id = id
  }

  function stopEditing() {
    editing.id = null
    editing.trigger = null
    editing.focusBody = false
    editing.cursorColumn = null
  }

  // ── View mode & zoom ──

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

  // ── Outline keyboard navigation ──

  function selectedIndex(): number {
    return visibleRows.value.findIndex((r) => r.node.id === selection.current)
  }

  function moveSelectionUp() {
    const idx = selectedIndex()
    if (idx > 0) {
      selection.current = visibleRows.value[idx - 1]!.node.id
      editing.id = null
    }
  }

  function moveSelectionDown() {
    const idx = selectedIndex()
    if (idx < visibleRows.value.length - 1) {
      selection.current = visibleRows.value[idx + 1]!.node.id
      editing.id = null
    }
  }

  function createSiblingBelow() {
    const node = nodes.value.get(selection.current)
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

    const op = deps.createNode(node.parentId, pos, '', node.status)
    const newId = (op.payload as { id: string }).id
    selection.current = newId
    editing.id = newId
  }

  function indentNode() {
    const idx = selectedIndex()
    if (idx <= 0) return

    const node = nodes.value.get(selection.current)
    if (!node) return

    const prevRow = visibleRows.value[idx - 1]!
    const newParentId = prevRow.node.id

    const newSiblings = getChildren(newParentId)
    let pos: string
    if (newSiblings.length > 0) {
      pos = rankAfter(newSiblings[newSiblings.length - 1]!.pos)
    } else {
      pos = initialRank()
    }

    deps.moveNode(node.id, newParentId, pos)

    const newParent = nodes.value.get(newParentId)
    if (newParent && newParent.collapsed) {
      deps.toggleCollapsed(newParentId)
    }
  }

  function outdentNode() {
    const node = nodes.value.get(selection.current)
    if (!node || !node.parentId) return

    const parent = nodes.value.get(node.parentId)
    if (!parent || !parent.parentId) return
    if (parent.id === rootId.value) return

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

    deps.moveNode(node.id, grandparentId, pos)
  }

  // ── Edit-aware navigation ──

  function editPreviousNode(fromId: string, focusBody = false, cursorColumn: number | null = null) {
    const idx = visibleRows.value.findIndex((r) => r.node.id === fromId)
    if (idx > 0) {
      const prevId = visibleRows.value[idx - 1]!.node.id
      selection.current = prevId
      selection.ids = new Set([prevId])
      editing.id = prevId
      editing.trigger = 'keyboard'
      editing.focusBody = focusBody
      editing.cursorColumn = cursorColumn
    }
  }

  function editNextNode(fromId: string, cursorColumn: number | null = null) {
    const idx = visibleRows.value.findIndex((r) => r.node.id === fromId)
    if (idx >= 0 && idx < visibleRows.value.length - 1) {
      const nextId = visibleRows.value[idx + 1]!.node.id
      selection.current = nextId
      selection.ids = new Set([nextId])
      editing.id = nextId
      editing.trigger = 'keyboard'
      editing.cursorColumn = cursorColumn
    }
  }

  function deleteNodeAndEditPrevious(id: string) {
    const idx = visibleRows.value.findIndex((r) => r.node.id === id)
    const prevId = idx > 0 ? visibleRows.value[idx - 1]!.node.id : null
    const nextId = idx < visibleRows.value.length - 1 ? visibleRows.value[idx + 1]!.node.id : null

    deps.tombstone(id)

    const targetId = prevId ?? nextId
    if (targetId) {
      selection.current = targetId
      editing.id = targetId
      editing.trigger = 'keyboard'
    } else {
      editing.id = null
      editing.trigger = null
    }
  }

  function indentAndKeepEditing(id: string) {
    selection.current = id
    indentNode()
    editing.id = id
    editing.trigger = 'keyboard'
  }

  function outdentAndKeepEditing(id: string) {
    selection.current = id
    outdentNode()
    editing.id = id
    editing.trigger = 'keyboard'
  }

  function createSiblingBelowAndEdit() {
    const node = nodes.value.get(selection.current)
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

    const op = deps.createNode(node.parentId, pos, '', node.status)
    const newId = (op.payload as { id: string }).id
    selection.current = newId
    editing.id = newId
    editing.trigger = 'keyboard'
  }

  // ── Other ──

  function navigateToNode(nodeId: string) {
    let cur = nodes.value.get(nodeId)
    while (cur && cur.parentId) {
      const parent = nodes.value.get(cur.parentId)
      if (parent && parent.collapsed) {
        const op = makeOp('toggleCollapsed', { type: 'toggleCollapsed', id: parent.id })
        deps.dispatch(op, false)
      }
      cur = parent
    }
    zoomId.value = null
    selection.current = nodeId
  }

  return {
    selectNode,
    clearSelection,
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
    selectedIndex,
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
    navigateToNode,
  }
}
