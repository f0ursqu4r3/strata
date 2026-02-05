<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
import { useDocStore } from '@/stores/doc'
import { useSettingsStore } from '@/stores/settings'
import { matchesCombo, type ShortcutAction } from '@/lib/shortcuts'
import { rankBefore, rankBetween, rankAfter, initialRank } from '@/lib/rank'
import OutlineRow from './OutlineRow.vue'
import ContextMenu from './ContextMenu.vue'
import NodeHistory from './NodeHistory.vue'

const emit = defineEmits<{
  openSearch: []
}>()

const store = useDocStore()
const settings = useSettingsStore()
const containerRef = ref<HTMLElement | null>(null)
const dropTargetIdx = ref<number | null>(null)
const dropAsChildId = ref<string | null>(null)

// Context menu state
const ctxMenu = ref<{ nodeId: string; x: number; y: number } | null>(null)
const historyNodeId = ref<string | null>(null)

function onRowContextMenu(nodeId: string, x: number, y: number) {
  ctxMenu.value = { nodeId, x, y }
}

function closeContextMenu() {
  ctxMenu.value = null
}

// ── Virtual scroll ──
const ROW_HEIGHT = 32
const BUFFER = 10
const VIRTUAL_THRESHOLD = 100

const scrollTop = ref(0)
const containerHeight = ref(600)

function onScroll() {
  scrollTop.value = containerRef.value?.scrollTop ?? 0
}

const useVirtual = computed(() => store.visibleRows.length > VIRTUAL_THRESHOLD)

const virtualRange = computed(() => {
  if (!useVirtual.value) {
    return { start: 0, end: store.visibleRows.length }
  }
  const start = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - BUFFER)
  const visibleCount = Math.ceil(containerHeight.value / ROW_HEIGHT) + BUFFER * 2
  const end = Math.min(store.visibleRows.length, start + visibleCount)
  return { start, end }
})

const virtualRows = computed(() => {
  const { start, end } = virtualRange.value
  return store.visibleRows.slice(start, end).map((row, i) => ({
    ...row,
    globalIdx: start + i,
  }))
})

const topSpacer = computed(() => virtualRange.value.start * ROW_HEIGHT)
const bottomSpacer = computed(
  () => (store.visibleRows.length - virtualRange.value.end) * ROW_HEIGHT,
)

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight
    resizeObserver = new ResizeObserver((entries) => {
      containerHeight.value = entries[0]?.contentRect.height ?? 600
    })
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  document.removeEventListener('pointermove', onDocumentPointerMove)
  document.removeEventListener('pointerup', onDocumentPointerUp)
  document.removeEventListener('selectstart', onSelectStart)
  destroyFloatingRow()
})

function findAction(e: KeyboardEvent, context: 'outline' | 'global'): ShortcutAction | null {
  for (const def of settings.resolvedShortcuts) {
    if (def.context !== context) continue
    if (matchesCombo(e, def.combo)) return def.action
  }
  return null
}

// ── Vim mode ──
let vimPendingKey = ''
let vimPendingTimer: ReturnType<typeof setTimeout> | null = null

function clearVimPending() {
  vimPendingKey = ''
  if (vimPendingTimer) {
    clearTimeout(vimPendingTimer)
    vimPendingTimer = null
  }
}

function handleVimKey(e: KeyboardEvent): boolean {
  if (!settings.vimMode || store.editingId) return false
  if (e.ctrlKey || e.metaKey || e.altKey) return false

  const key = e.key

  // Two-key combos
  if (vimPendingKey) {
    const combo = vimPendingKey + key
    clearVimPending()

    if (combo === 'dd' && store.selectedId) {
      const rows = store.visibleRows
      const idx = rows.findIndex((r) => r.node.id === store.selectedId)
      const nextId = rows[idx + 1]?.node.id ?? rows[idx - 1]?.node.id ?? null
      store.tombstone(store.selectedId)
      if (nextId) store.selectNode(nextId)
      e.preventDefault()
      return true
    }
    if (combo === 'gg') {
      const rows = store.visibleRows
      if (rows.length > 0) {
        store.selectNode(rows[0]!.node.id)
        scrollSelectedIntoView()
      }
      e.preventDefault()
      return true
    }
    if (combo === 'zc' && store.selectedId) {
      const node = store.nodes.get(store.selectedId)
      if (node && store.getChildren(node.id).length > 0 && !node.collapsed) {
        store.toggleCollapsed(node.id)
      }
      e.preventDefault()
      return true
    }
    if (combo === 'zo' && store.selectedId) {
      const node = store.nodes.get(store.selectedId)
      if (node && node.collapsed) {
        store.toggleCollapsed(node.id)
      }
      e.preventDefault()
      return true
    }
    return false
  }

  // Start two-key sequences
  if (key === 'd' || key === 'g' || key === 'z') {
    vimPendingKey = key
    vimPendingTimer = setTimeout(clearVimPending, 500)
    e.preventDefault()
    return true
  }

  // Single keys
  if (key === 'j') {
    store.moveSelectionDown()
    scrollSelectedIntoView()
    e.preventDefault()
    return true
  }
  if (key === 'k') {
    store.moveSelectionUp()
    scrollSelectedIntoView()
    e.preventDefault()
    return true
  }
  if (key === 'i') {
    if (store.selectedId) {
      store.startEditing(store.selectedId, 'keyboard')
      e.preventDefault()
    }
    return true
  }
  if (key === 'o') {
    if (store.selectedId) {
      const node = store.nodes.get(store.selectedId)
      if (node) {
        const siblings = store.getChildren(node.parentId!)
        const idx = siblings.findIndex((s) => s.id === node.id)
        const next = siblings[idx + 1]
        const pos = next ? rankBetween(node.pos, next.pos) : rankAfter(node.pos)
        const op = store.createNode(node.parentId!, pos)
        const newId = (op.payload as { id: string }).id
        store.selectNode(newId)
        store.startEditing(newId, 'keyboard')
        e.preventDefault()
      }
    }
    return true
  }
  if (key === 'G') {
    const rows = store.visibleRows
    if (rows.length > 0) {
      store.selectNode(rows[rows.length - 1]!.node.id)
      scrollSelectedIntoView()
    }
    e.preventDefault()
    return true
  }
  if (key === '/') {
    emit('openSearch')
    e.preventDefault()
    return true
  }

  return false
}

function onKeydown(e: KeyboardEvent) {
  // Global shortcuts (undo/redo) work even while editing
  const globalAction = findAction(e, 'global')
  if (globalAction === 'undo') {
    e.preventDefault()
    store.flushTextDebounce()
    store.undo()
    return
  }
  if (globalAction === 'redo') {
    e.preventDefault()
    store.flushTextDebounce()
    store.redo()
    return
  }

  if (store.editingId) return

  // Escape clears multi-selection (or deselects)
  if (e.key === 'Escape') {
    if (store.selectedIds.size > 1) {
      store.selectNode(store.selectedId)
    } else if (store.selectedId) {
      store.clearSelection()
    }
    e.preventDefault()
    return
  }

  // Vim mode keys (before standard outline shortcuts)
  if (handleVimKey(e)) return

  // Status shortcuts: Ctrl+1..9 → dynamic from statusDefs
  if ((e.ctrlKey || e.metaKey) && store.selectedId && e.key >= '1' && e.key <= '9') {
    const idx = parseInt(e.key) - 1
    const def = store.statusDefs[idx]
    if (def) {
      if (store.selectedIds.size > 1) {
        store.bulkSetStatus(def.id)
      } else {
        store.setStatus(store.selectedId, def.id)
      }
      e.preventDefault()
      return
    }
  }

  const action = findAction(e, 'outline')
  if (!action) return

  switch (action) {
    case 'moveUp':
      store.moveSelectionUp()
      e.preventDefault()
      scrollSelectedIntoView()
      break
    case 'moveDown':
      store.moveSelectionDown()
      e.preventDefault()
      scrollSelectedIntoView()
      break
    case 'startEditing':
      if (store.selectedId) {
        store.startEditing(store.selectedId, 'keyboard')
        e.preventDefault()
      } else if (store.visibleRows.length === 0) {
        // Empty outline — create first node under root
        const op = store.createNode(store.rootId, initialRank())
        const newId = (op.payload as { id: string }).id
        store.selectNode(newId)
        store.startEditing(newId, 'keyboard')
        e.preventDefault()
      }
      break
    case 'indent':
      store.indentNode()
      e.preventDefault()
      break
    case 'outdent':
      store.outdentNode()
      e.preventDefault()
      break
    case 'delete':
      if (store.selectedIds.size > 1) {
        store.bulkTombstone()
        e.preventDefault()
      } else if (store.selectedId) {
        const rows = store.visibleRows
        const idx = rows.findIndex((r) => r.node.id === store.selectedId)
        const nextId =
          rows[idx + 1]?.node.id ?? rows[idx - 1]?.node.id ?? null
        store.tombstone(store.selectedId)
        if (nextId) store.selectNode(nextId)
        e.preventDefault()
      }
      break
    case 'toggleCollapse':
      if (store.selectedId) {
        const node = store.nodes.get(store.selectedId)
        if (node && store.getChildren(node.id).length > 0) {
          store.toggleCollapsed(node.id)
          e.preventDefault()
        }
      }
      break
    case 'zoomIn':
      if (store.selectedId) {
        store.zoomIn(store.selectedId)
        e.preventDefault()
      }
      break
    case 'zoomOut':
      store.zoomOut()
      e.preventDefault()
      break
  }
}

// ── Pointer-based drag reorder ──
const DRAG_THRESHOLD = 5
const dragNodeId = ref<string | null>(null)
const isDragging = ref(false)

// The set of root-level node IDs being dragged (multi-select aware)
const dragRootIds = computed(() => {
  if (!dragNodeId.value) return [] as string[]
  // If the dragged node is part of a multi-selection, drag all selected nodes
  if (store.selectedIds.size > 1 && store.selectedIds.has(dragNodeId.value)) {
    // Return selected nodes in visible order
    return store.visibleRows
      .filter((r) => store.selectedIds.has(r.node.id))
      .map((r) => r.node.id)
  }
  return [dragNodeId.value]
})

const dragSubtreeIds = computed(() => {
  const ids = new Set<string>()
  if (!dragNodeId.value) return ids
  function addDescendants(parentId: string) {
    for (const child of store.getChildren(parentId)) {
      ids.add(child.id)
      addDescendants(child.id)
    }
  }
  for (const rootId of dragRootIds.value) {
    ids.add(rootId)
    addDescendants(rootId)
  }
  return ids
})

let dragStartX = 0
let dragStartY = 0
let grabOffsetX = 0
let grabOffsetY = 0
let pendingDragNodeId: string | null = null
let floatingEl: HTMLElement | null = null

function onRowPointerDown(nodeId: string, e: PointerEvent) {
  pendingDragNodeId = nodeId
  dragStartX = e.clientX
  dragStartY = e.clientY

  const rowEl = (e.target as HTMLElement).closest('[data-row-idx]') as HTMLElement | null
  if (rowEl) {
    const rect = rowEl.getBoundingClientRect()
    grabOffsetX = e.clientX - rect.left
    grabOffsetY = e.clientY - rect.top
  }

  document.addEventListener('pointermove', onDocumentPointerMove)
  document.addEventListener('pointerup', onDocumentPointerUp)
  document.addEventListener('selectstart', onSelectStart)
}

function onSelectStart(e: Event) {
  if (pendingDragNodeId) e.preventDefault()
}

function onDocumentPointerMove(e: PointerEvent) {
  if (!pendingDragNodeId) return

  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY

  if (!isDragging.value) {
    if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
    isDragging.value = true
    dragNodeId.value = pendingDragNodeId
    window.getSelection()?.removeAllRanges()
    createFloatingRow()
  }

  if (floatingEl) {
    floatingEl.style.left = `${e.clientX - grabOffsetX}px`
    floatingEl.style.top = `${e.clientY - grabOffsetY}px`
  }

  // Compute drop target: 3-zone detection per row (top 25% = before, mid 50% = as child, bottom 25% = after)
  const rowEls = containerRef.value?.querySelectorAll('[data-row-idx]')
  if (!rowEls) return
  const subtreeIds = dragSubtreeIds.value
  let targetIdx: number | null = null
  let childId: string | null = null

  for (const row of rowEls) {
    const idx = parseInt((row as HTMLElement).dataset.rowIdx!)
    const rowNode = store.visibleRows[idx]?.node
    if (rowNode && subtreeIds.has(rowNode.id)) continue
    const rect = (row as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    const h = rect.height

    if (y < 0) {
      // Cursor is above this row — drop before it
      targetIdx = idx
      break
    }
    if (y < h * 0.25) {
      targetIdx = idx
      break
    }
    if (y < h * 0.75) {
      childId = rowNode!.id
      break
    }
    // Bottom 25% — continue to next row (will become "before next" or "end")
  }

  if (childId) {
    dropTargetIdx.value = null
    dropAsChildId.value = childId
  } else {
    dropTargetIdx.value = targetIdx ?? store.visibleRows.length
    dropAsChildId.value = null
  }
}

function createFloatingRow() {
  const allRowEls = containerRef.value?.querySelectorAll('[data-row-idx]')
  if (!allRowEls) return

  const rows = store.visibleRows
  const subtreeIds = dragSubtreeIds.value

  // Collect all DOM elements that belong to the dragged subtree
  const sources: HTMLElement[] = []
  for (const el of allRowEls) {
    const idx = parseInt((el as HTMLElement).dataset.rowIdx!)
    const rowNode = rows[idx]?.node
    if (rowNode && subtreeIds.has(rowNode.id)) {
      sources.push(el as HTMLElement)
    }
  }
  if (sources.length === 0) return

  const firstRect = sources[0]!.getBoundingClientRect()

  const wrapper = document.createElement('div')
  wrapper.style.position = 'fixed'
  wrapper.style.left = `${firstRect.left}px`
  wrapper.style.top = `${firstRect.top}px`
  wrapper.style.width = `${firstRect.width}px`
  wrapper.style.zIndex = '9999'
  wrapper.style.pointerEvents = 'none'
  wrapper.style.opacity = '0.9'
  wrapper.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'
  wrapper.style.background = 'var(--bg-secondary)'
  wrapper.style.borderRadius = '4px'
  wrapper.style.overflow = 'hidden'

  for (const src of sources) {
    const clone = src.cloneNode(true) as HTMLElement
    clone.style.opacity = '1'
    wrapper.appendChild(clone)
  }

  document.body.appendChild(wrapper)
  floatingEl = wrapper
}

function destroyFloatingRow() {
  if (floatingEl) {
    floatingEl.remove()
    floatingEl = null
  }
}

function onDocumentPointerUp() {
  document.removeEventListener('pointermove', onDocumentPointerMove)
  document.removeEventListener('pointerup', onDocumentPointerUp)
  document.removeEventListener('selectstart', onSelectStart)

  if (isDragging.value && dragNodeId.value) {
    const rootIds = dragRootIds.value
    const rows = store.visibleRows
    const subtreeIds = dragSubtreeIds.value

    if (dropAsChildId.value) {
      // Drop as last child of target node
      const targetId = dropAsChildId.value
      const children = store.getChildren(targetId)
      const lastChild = children.filter((c) => !subtreeIds.has(c.id)).pop()
      let pos = lastChild ? rankAfter(lastChild.pos) : initialRank()
      for (const id of rootIds) {
        store.moveNode(id, targetId, pos)
        pos = rankAfter(pos)
      }

      // Ensure target is expanded so the dropped nodes are visible
      const targetNode = store.nodes.get(targetId)
      if (targetNode && targetNode.collapsed) {
        store.toggleCollapsed(targetId)
      }
    } else if (dropTargetIdx.value !== null) {
      const targetIdx = dropTargetIdx.value

      if (targetIdx === 0) {
        const siblings = store.getChildren(store.effectiveZoomId)
        const firstSibling = siblings.find((s) => !subtreeIds.has(s.id))
        if (firstSibling) {
          let pos = rankBefore(firstSibling.pos)
          for (const id of rootIds) {
            store.moveNode(id, store.effectiveZoomId, pos)
            pos = rankBetween(pos, firstSibling.pos)
          }
        }
      } else if (targetIdx <= rows.length) {
        // Find the nearest non-subtree row above the drop target
        let aboveRow = null
        for (let i = targetIdx - 1; i >= 0; i--) {
          if (!subtreeIds.has(rows[i]!.node.id)) {
            aboveRow = rows[i]
            break
          }
        }

        if (aboveRow) {
          const aboveNode = aboveRow.node
          const siblings = store.getChildren(aboveNode.parentId!)
          const aboveIdx = siblings.findIndex((s) => s.id === aboveNode.id)
          const nextSibling = siblings.slice(aboveIdx + 1).find((s) => !subtreeIds.has(s.id))

          let pos: string
          if (nextSibling) {
            pos = rankBetween(aboveNode.pos, nextSibling.pos)
          } else {
            pos = rankAfter(aboveNode.pos)
          }
          for (const id of rootIds) {
            store.moveNode(id, aboveNode.parentId, pos)
            pos = rankAfter(pos)
          }
        }
      }
    }
  }

  destroyFloatingRow()
  pendingDragNodeId = null
  dragNodeId.value = null
  dropTargetIdx.value = null
  dropAsChildId.value = null
  isDragging.value = false
}

// ── File drop import ──
const fileDragOver = ref(false)

function onFileDragOver(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('Files')) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
  fileDragOver.value = true
}

function onFileDragLeave() {
  fileDragOver.value = false
}

async function onFileDrop(e: DragEvent) {
  fileDragOver.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  // Only handle file drops (not row drags)
  if (dragNodeId.value) return
  e.preventDefault()

  const { parseMarkdownImport, parseOPMLImport, parsePlainTextImport, flattenImportNodes } = await import('@/lib/import-formats')

  const targetParentId = store.selectedId
    ? (store.nodes.get(store.selectedId)?.parentId ?? store.effectiveZoomId)
    : store.effectiveZoomId
  const defaultStatus = store.statusDefs[0]?.id ?? 'todo'

  // Find last child pos for ordering after existing children
  const siblings = store.getChildren(targetParentId)
  const afterPos = siblings.length > 0 ? siblings[siblings.length - 1]!.pos : undefined

  for (const file of Array.from(files)) {
    const text = await file.text()
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    let trees

    if (ext === 'json') {
      // Use existing full JSON import
      try {
        await store.importJSON(text)
      } catch (err) {
        alert('Failed to import JSON: ' + (err as Error).message)
      }
      continue
    } else if (ext === 'opml') {
      trees = parseOPMLImport(text)
    } else if (ext === 'md' || ext === 'markdown') {
      trees = parseMarkdownImport(text)
    } else {
      // Plain text fallback
      trees = parsePlainTextImport(text)
    }

    if (trees && trees.length > 0) {
      const flat = flattenImportNodes(trees, targetParentId, defaultStatus, afterPos)
      await store.importNodes(flat)
    }
  }
}

function onContainerClick(e: MouseEvent) {
  // Clear selection when clicking empty space (not on a row)
  const target = e.target as HTMLElement
  if (target.closest('[data-row-idx]')) return
  if (store.selectedId || store.selectedIds.size > 0) {
    store.clearSelection()
  }
}

function onContainerDblClick(e: MouseEvent) {
  // Only create a new node when clicking empty space (not on a row)
  const target = e.target as HTMLElement
  if (target.closest('[data-row-idx]')) return

  const siblings = store.getChildren(store.effectiveZoomId)
  const lastSibling = siblings[siblings.length - 1]
  const pos = lastSibling ? rankAfter(lastSibling.pos) : initialRank()

  const op = store.createNode(store.effectiveZoomId, pos)
  const newId = (op.payload as { id: string }).id
  store.selectNode(newId)
  store.startEditing(newId, 'dblclick')
}

function scrollSelectedIntoView() {
  nextTick(() => {
    if (useVirtual.value) {
      // For virtual scroll, compute the position and scroll to it
      const idx = store.visibleRows.findIndex((r) => r.node.id === store.selectedId)
      if (idx >= 0 && containerRef.value) {
        const rowTop = idx * ROW_HEIGHT
        const rowBottom = rowTop + ROW_HEIGHT
        const viewTop = containerRef.value.scrollTop
        const viewBottom = viewTop + containerRef.value.clientHeight
        if (rowTop < viewTop) {
          containerRef.value.scrollTop = rowTop
        } else if (rowBottom > viewBottom) {
          containerRef.value.scrollTop = rowBottom - containerRef.value.clientHeight
        }
      }
    } else {
      const el = containerRef.value?.querySelector('[aria-selected="true"]')
      el?.scrollIntoView({ block: 'nearest' })
    }
  })
}

watch(
  () => store.selectedId,
  () => {
    scrollSelectedIntoView()
  },
)
</script>

<template>
  <div
    class="h-full overflow-y-auto outline-none py-2 outline-focus-target relative"
    ref="containerRef"
    tabindex="0"
    role="tree"
    aria-label="Outline"
    @keydown="onKeydown"
    @scroll="onScroll"
    @click="onContainerClick"
    @dblclick="onContainerDblClick"
    @dragover="onFileDragOver"
    @dragleave="onFileDragLeave"
    @drop="onFileDrop"
  >
    <!-- Rows -->
    <div class="px-1">
      <!-- Virtualized mode -->
      <template v-if="useVirtual">
        <div :style="{ height: topSpacer + 'px' }" />
        <template v-for="row in virtualRows" :key="row.node.id">
          <div
            v-if="dropTargetIdx === row.globalIdx"
            class="h-0.5 bg-(--accent-500) rounded mx-2 my-px"
          />
          <div
            :data-row-idx="row.globalIdx"
            :class="{
              'opacity-30': dragSubtreeIds.has(row.node.id),
              'ring-2 ring-(--accent-500) rounded': dropAsChildId === row.node.id,
            }"
          >
            <OutlineRow
              :node="row.node"
              :depth="row.depth"
              @contextmenu="onRowContextMenu"
              @row-pointerdown="onRowPointerDown"
            />
          </div>
        </template>
        <div :style="{ height: bottomSpacer + 'px' }" />
      </template>

      <!-- Normal mode with transitions (suppressed during external file refresh) -->
      <TransitionGroup v-else :name="store.suppressTransitions ? '' : 'outline-row'">
        <template v-for="(row, idx) in store.visibleRows" :key="row.node.id">
          <div
            v-if="dropTargetIdx === idx"
            class="h-0.5 bg-(--accent-500) rounded mx-2 my-px"
          />
          <div
            :data-row-idx="idx"
            :class="{
              'opacity-30': dragSubtreeIds.has(row.node.id),
              'ring-2 ring-(--accent-500) rounded': dropAsChildId === row.node.id,
            }"
          >
            <OutlineRow
              :node="row.node"
              :depth="row.depth"
              @contextmenu="onRowContextMenu"
              @row-pointerdown="onRowPointerDown"
            />
          </div>
        </template>
      </TransitionGroup>

      <div
        v-if="dropTargetIdx === store.visibleRows.length && store.visibleRows.length > 0"
        class="h-0.5 bg-(--accent-500) rounded mx-2 my-px"
      />
      <div
        v-if="store.visibleRows.length === 0"
        class="p-6 text-center text-(--text-faint) text-sm"
      >
        No items. Press Enter or double-click to create one.
      </div>
    </div>

    <!-- Context menu -->
    <ContextMenu
      v-if="ctxMenu"
      :node-id="ctxMenu.nodeId"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      @close="closeContextMenu"
      @history="historyNodeId = $event"
    />

    <!-- Node history -->
    <NodeHistory
      v-if="historyNodeId"
      :node-id="historyNodeId"
      @close="historyNodeId = null"
    />

    <!-- File drop overlay -->
    <div
      v-if="fileDragOver"
      class="absolute inset-0 bg-(--accent-500)/10 border-2 border-dashed border-(--accent-500) rounded-lg flex items-center justify-center pointer-events-none z-40"
    >
      <span class="text-(--accent-600) font-medium text-sm">Drop files to import</span>
    </div>
  </div>
</template>

<style scoped>
.outline-row-enter-active,
.outline-row-leave-active {
  transition: all 0.15s ease;
  overflow: hidden;
}
.outline-row-enter-from {
  opacity: 0;
  max-height: 0;
  transform: translateY(-4px);
}
.outline-row-enter-to {
  opacity: 1;
  max-height: 2rem;
  transform: translateY(0);
}
.outline-row-leave-from {
  opacity: 1;
  max-height: 2rem;
}
.outline-row-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-4px);
}
.outline-row-move {
  transition: transform 0.15s ease;
}
</style>
