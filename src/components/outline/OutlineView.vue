<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useDocStore } from '@/stores/doc'
import { useDocumentsStore } from '@/stores/documents'
import { useSettingsStore } from '@/stores/settings'
import { isFileSystemMode } from '@/lib/platform'
import { matchesCombo, type ShortcutAction } from '@/lib/shortcuts'
import { rankAfter, initialRank } from '@/lib/rank'
import { useVirtualScroll, ROW_HEIGHT } from '@/composables/outline/useVirtualScroll'
import { useVimMode } from '@/composables/outline/useVimMode'
import { useDragReorder } from '@/composables/outline/useDragReorder'
import { useFileDrop } from '@/composables/outline/useFileDrop'
import OutlineRow from './OutlineRow.vue'
import ContextMenu from '../shared/ContextMenu.vue'
import NodeHistory from './NodeHistory.vue'

const emit = defineEmits<{
  openSearch: []
}>()

const store = useDocStore()
const docsStore = useDocumentsStore()
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

/** If no document exists, auto-create one and load it. Returns true if a doc was created. */
async function ensureDocument(): Promise<boolean> {
  if (docsStore.documents.length > 0) return false
  if (isFileSystemMode()) return false
  const name = docsStore.nextUntitledName()
  const id = docsStore.createDocument(name)
  await docsStore.switchDocument(id)
  await store.loadDocument(id)
  return true
}

// ── Composables ──
const visibleRows = computed(() => store.visibleRows)

const { useVirtual, virtualRows, topSpacer, bottomSpacer, onScroll } =
  useVirtualScroll(visibleRows, containerRef)

const { dragNodeId, isDragging, dragSubtreeIds, onRowPointerDown } =
  useDragReorder(containerRef, dropTargetIdx, dropAsChildId)

const { fileDragOver, onFileDragOver, onFileDragLeave, onFileDrop } =
  useFileDrop(dragNodeId)

const { handleVimKey } = useVimMode(emit, scrollSelectedIntoView)

// ── Keyboard ──
function findAction(e: KeyboardEvent, context: 'outline' | 'global'): ShortcutAction | null {
  for (const def of settings.resolvedShortcuts) {
    if (def.context !== context) continue
    if (matchesCombo(e, def.combo)) return def.action
  }
  return null
}

async function onKeydown(e: KeyboardEvent) {
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

  if (store.editing.id) return

  if (e.key === 'Escape') {
    if (store.selection.ids.size > 1) {
      store.selectNode(store.selection.current)
    } else if (store.selection.current) {
      store.clearSelection()
    }
    e.preventDefault()
    return
  }

  if (handleVimKey(e)) return

  if ((e.ctrlKey || e.metaKey) && store.selection.current && e.key >= '1' && e.key <= '9') {
    const idx = parseInt(e.key) - 1
    const def = store.statusDefs[idx]
    if (def) {
      if (store.selection.ids.size > 1) {
        store.bulkSetStatus(def.id)
      } else {
        store.setStatus(store.selection.current, def.id)
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
      if (store.selection.current) {
        store.startEditing(store.selection.current, 'keyboard')
        e.preventDefault()
      } else if (store.visibleRows.length === 0) {
        e.preventDefault()
        await ensureDocument()
        const op = store.createNode(store.rootId, initialRank())
        const newId = (op.payload as { id: string }).id
        store.selectNode(newId)
        store.startEditing(newId, 'keyboard')
      }
      break
    case 'indent':
      store.indentNode()
      e.preventDefault()
      scrollSelectedIntoView()
      break
    case 'outdent':
      store.outdentNode()
      e.preventDefault()
      scrollSelectedIntoView()
      break
    case 'delete':
      if (store.selection.ids.size > 1) {
        store.bulkTombstone()
        e.preventDefault()
      } else if (store.selection.current) {
        const rows = store.visibleRows
        const idx = rows.findIndex((r) => r.node.id === store.selection.current)
        const nextId = rows[idx + 1]?.node.id ?? rows[idx - 1]?.node.id ?? null
        store.tombstone(store.selection.current)
        if (nextId) store.selectNode(nextId)
        e.preventDefault()
      }
      break
    case 'toggleCollapse':
      if (store.selection.current) {
        const node = store.nodes.get(store.selection.current)
        if (node && store.getChildren(node.id).length > 0) {
          store.toggleCollapsed(node.id)
          e.preventDefault()
        }
      }
      break
    case 'zoomIn':
      if (store.selection.current) {
        store.zoomIn(store.selection.current)
        e.preventDefault()
      }
      break
    case 'zoomOut':
      store.zoomOut()
      e.preventDefault()
      break
  }
}

// ── Container interactions ──
function onContainerClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('[data-row-idx]')) return
  if (store.selection.current || store.selection.ids.size > 0) {
    store.clearSelection()
  }
}

async function onContainerDblClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('[data-row-idx]')) return

  await ensureDocument()

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
      const idx = store.visibleRows.findIndex((r) => r.node.id === store.selection.current)
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
  () => store.selection.current,
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
