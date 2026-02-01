<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { useDocStore } from '@/stores/doc'
import { rankBefore, rankBetween, rankAfter } from '@/lib/rank'
import OutlineRow from './OutlineRow.vue'
import ContextMenu from './ContextMenu.vue'

const store = useDocStore()
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

function onKeydown(e: KeyboardEvent) {
  // Undo/redo works even while editing
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    if (e.shiftKey) {
      store.redo()
    } else {
      store.flushTextDebounce()
      store.undo()
    }
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault()
    store.redo()
    return
  }

  if (store.editingId) return

  // Status shortcuts: Ctrl+1/2/3/4
  if ((e.ctrlKey || e.metaKey) && store.selectedId) {
    const statusMap: Record<string, import('@/types').Status> = {
      '1': 'todo',
      '2': 'in_progress',
      '3': 'blocked',
      '4': 'done',
    }
    if (statusMap[e.key]) {
      store.setStatus(store.selectedId, statusMap[e.key]!)
      e.preventDefault()
      return
    }
  }

  switch (e.key) {
    case 'ArrowUp':
      store.moveSelectionUp()
      e.preventDefault()
      scrollSelectedIntoView()
      break
    case 'ArrowDown':
      store.moveSelectionDown()
      e.preventDefault()
      scrollSelectedIntoView()
      break
    case 'Enter':
      if (store.selectedId) {
        store.startEditing(store.selectedId)
        e.preventDefault()
      }
      break
    case 'Tab':
      if (e.shiftKey) {
        store.outdentNode()
      } else {
        store.indentNode()
      }
      e.preventDefault()
      break
    case 'Delete':
    case 'Backspace':
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
    case ' ':
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
    const el = containerRef.value?.querySelector('.bg-slate-200, .bg-blue-100')
    el?.scrollIntoView({ block: 'nearest' })
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
    class="h-full overflow-y-auto outline-none py-2"
    ref="containerRef"
    tabindex="0"
    @keydown="onKeydown"
  >
    <!-- Zoom breadcrumb -->
    <div
      v-if="store.zoomId"
      class="flex items-center gap-2 px-3 pb-2 border-b border-slate-200 mb-1"
    >
      <button
        class="flex items-center gap-1 bg-transparent border border-slate-300 rounded px-2 py-0.5 text-xs cursor-pointer text-slate-600 hover:bg-slate-100"
        @click="store.zoomOut()"
      >
        <ArrowLeft class="w-3 h-3" />
        Back
      </button>
      <span class="text-[13px] text-slate-500 font-medium">
        {{ store.nodes.get(store.zoomId)?.text ?? 'Zoomed' }}
      </span>
    </div>

    <!-- Rows -->
    <div
      class="px-1"
      @dragover="onContainerDragOver"
      @dragleave="onContainerDragLeave"
      @drop="onContainerDrop"
    >
      <template v-for="(row, idx) in store.visibleRows" :key="row.node.id">
        <div
          v-if="dropTargetIdx === idx"
          class="h-0.5 bg-blue-500 rounded mx-2 my-px"
        />
        <div :data-row-idx="idx">
          <OutlineRow
            :node="row.node"
            :depth="row.depth"
            @contextmenu="onRowContextMenu"
          />
        </div>
      </template>
      <div
        v-if="dropTargetIdx === store.visibleRows.length && store.visibleRows.length > 0"
        class="h-0.5 bg-blue-500 rounded mx-2 my-px"
      />
      <div
        v-if="store.visibleRows.length === 0"
        class="p-6 text-center text-slate-400 text-sm"
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
