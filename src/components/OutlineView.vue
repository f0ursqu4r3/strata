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

// ── Drag reorder ──
function onContainerDragOver(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('application/x-strata-node')) return
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'

  const rows = containerRef.value?.querySelectorAll('[data-row-idx]')
  if (!rows) return
  let targetIdx = -1
  for (const row of rows) {
    const rect = (row as HTMLElement).getBoundingClientRect()
    if (e.clientY < rect.top + rect.height / 2) {
      targetIdx = parseInt((row as HTMLElement).dataset.rowIdx!)
      break
    }
  }
  if (targetIdx === -1) targetIdx = store.visibleRows.length
  dropTargetIdx.value = targetIdx
}

function onContainerDragLeave() {
  dropTargetIdx.value = null
}

function onContainerDrop(e: DragEvent) {
  e.preventDefault()
  const nodeId = e.dataTransfer?.getData('application/x-strata-node')
  dropTargetIdx.value = null
  if (!nodeId) return

  const rows = store.visibleRows
  const rowEls = containerRef.value?.querySelectorAll('[data-row-idx]')
  if (!rowEls) return

  let targetIdx = rows.length
  for (const row of rowEls) {
    const rect = (row as HTMLElement).getBoundingClientRect()
    if (e.clientY < rect.top + rect.height / 2) {
      targetIdx = parseInt((row as HTMLElement).dataset.rowIdx!)
      break
    }
  }

  const draggedNode = store.nodes.get(nodeId)
  if (!draggedNode) return

  if (targetIdx === 0) {
    const siblings = store.getChildren(store.effectiveZoomId)
    const firstSibling = siblings[0]
    if (firstSibling && firstSibling.id !== nodeId) {
      store.moveNode(nodeId, store.effectiveZoomId, rankBefore(firstSibling.pos))
    }
  } else if (targetIdx <= rows.length) {
    const aboveRow = rows[targetIdx - 1]
    if (!aboveRow || aboveRow.node.id === nodeId) return
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
  >
    <!-- Rows -->
    <div
      class="px-1"
      @dragover="onContainerDragOver"
      @dragleave="onContainerDragLeave"
      @drop="onContainerDrop"
    >
      <!-- Virtualized mode -->
      <template v-if="useVirtual">
        <div :style="{ height: topSpacer + 'px' }" />
        <template v-for="row in virtualRows" :key="row.node.id">
          <div
            v-if="dropTargetIdx === row.globalIdx"
            class="h-0.5 bg-(--accent-500) rounded mx-2 my-px"
          />
          <div :data-row-idx="row.globalIdx">
            <OutlineRow
              :node="row.node"
              :depth="row.depth"
              @contextmenu="onRowContextMenu"
            />
          </div>
        </template>
        <div :style="{ height: bottomSpacer + 'px' }" />
      </template>

      <!-- Normal mode with transitions -->
      <TransitionGroup v-else name="outline-row">
        <template v-for="(row, idx) in store.visibleRows" :key="row.node.id">
          <div
            v-if="dropTargetIdx === idx"
            class="h-0.5 bg-(--accent-500) rounded mx-2 my-px"
          />
          <div :data-row-idx="idx">
            <OutlineRow
              :node="row.node"
              :depth="row.depth"
              @contextmenu="onRowContextMenu"
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
        No items. Press Enter to create one.
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
