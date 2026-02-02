<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
import { useDocStore } from '@/stores/doc'
import { useSettingsStore } from '@/stores/settings'
import { matchesCombo, type ShortcutAction } from '@/lib/shortcuts'
import { rankBefore, rankBetween, rankAfter, initialRank } from '@/lib/rank'
import OutlineRow from './OutlineRow.vue'
import ContextMenu from './ContextMenu.vue'

const store = useDocStore()
const settings = useSettingsStore()
const containerRef = ref<HTMLElement | null>(null)
const dropTargetIdx = ref<number | null>(null)

// Context menu state
const ctxMenu = ref<{ nodeId: string; x: number; y: number } | null>(null)

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

  // Status shortcuts: Ctrl+1..9 → dynamic from statusDefs
  if ((e.ctrlKey || e.metaKey) && store.selectedId && e.key >= '1' && e.key <= '9') {
    const idx = parseInt(e.key) - 1
    const def = store.statusDefs[idx]
    if (def) {
      store.setStatus(store.selectedId, def.id)
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
      if (store.selectedId) {
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
  }
}

// ── Pointer-based drag reorder ──
const DRAG_THRESHOLD = 5
const dragNodeId = ref<string | null>(null)
const isDragging = ref(false)

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

  // Compute drop target index based on cursor position
  const rowEls = containerRef.value?.querySelectorAll('[data-row-idx]')
  if (!rowEls) return
  let targetIdx = -1
  for (const row of rowEls) {
    const rect = (row as HTMLElement).getBoundingClientRect()
    if (e.clientY < rect.top + rect.height / 2) {
      targetIdx = parseInt((row as HTMLElement).dataset.rowIdx!)
      break
    }
  }
  if (targetIdx === -1) targetIdx = store.visibleRows.length
  dropTargetIdx.value = targetIdx
}

function createFloatingRow() {
  const rowEl = containerRef.value?.querySelector(`[data-row-idx] [aria-label="${CSS.escape(store.nodes.get(pendingDragNodeId!)?.text || '(empty)')}"]`)?.closest('[data-row-idx]') as HTMLElement | null
  // Fallback: find by iterating rows
  let source: HTMLElement | null = rowEl
  if (!source) {
    const allRows = containerRef.value?.querySelectorAll('[data-row-idx]')
    if (allRows) {
      const rows = store.visibleRows
      for (const el of allRows) {
        const idx = parseInt((el as HTMLElement).dataset.rowIdx!)
        if (rows[idx]?.node.id === pendingDragNodeId) {
          source = el as HTMLElement
          break
        }
      }
    }
  }
  if (!source) return

  const clone = source.cloneNode(true) as HTMLElement
  const rect = source.getBoundingClientRect()

  clone.style.position = 'fixed'
  clone.style.left = `${rect.left}px`
  clone.style.top = `${rect.top}px`
  clone.style.width = `${rect.width}px`
  clone.style.zIndex = '9999'
  clone.style.pointerEvents = 'none'
  clone.style.opacity = '0.9'
  clone.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'
  clone.style.background = 'var(--bg-secondary)'
  clone.style.borderRadius = '4px'

  document.body.appendChild(clone)
  floatingEl = clone
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

  if (isDragging.value && dragNodeId.value && dropTargetIdx.value !== null) {
    const nodeId = dragNodeId.value
    const targetIdx = dropTargetIdx.value
    const rows = store.visibleRows

    if (targetIdx === 0) {
      const siblings = store.getChildren(store.effectiveZoomId)
      const firstSibling = siblings[0]
      if (firstSibling && firstSibling.id !== nodeId) {
        store.moveNode(nodeId, store.effectiveZoomId, rankBefore(firstSibling.pos))
      }
    } else if (targetIdx <= rows.length) {
      const aboveRow = rows[targetIdx - 1]
      if (aboveRow && aboveRow.node.id !== nodeId) {
        const aboveNode = aboveRow.node
        const siblings = store.getChildren(aboveNode.parentId!)
        const aboveIdx = siblings.findIndex((s) => s.id === aboveNode.id)
        const nextSibling = siblings[aboveIdx + 1]

        let pos: string
        if (nextSibling && nextSibling.id !== nodeId) {
          pos = rankBetween(aboveNode.pos, nextSibling.pos)
        } else {
          pos = rankAfter(aboveNode.pos)
        }
        store.moveNode(nodeId, aboveNode.parentId, pos)
      }
    }
  }

  destroyFloatingRow()
  pendingDragNodeId = null
  dragNodeId.value = null
  dropTargetIdx.value = null
  isDragging.value = false
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
    class="h-full overflow-y-auto outline-none py-2 outline-focus-target"
    ref="containerRef"
    tabindex="0"
    role="tree"
    aria-label="Outline"
    @keydown="onKeydown"
    @scroll="onScroll"
    @dblclick="onContainerDblClick"
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
            :class="{ 'opacity-30': dragNodeId === row.node.id }"
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
            :class="{ 'opacity-30': dragNodeId === row.node.id }"
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
    />
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
