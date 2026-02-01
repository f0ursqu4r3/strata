<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useDocStore } from '@/stores/doc'
import type { Node, Status } from '@/types'
import ContextMenu from './ContextMenu.vue'

const store = useDocStore()

const columns: { key: Status; label: string; dotClass: string }[] = [
  { key: 'todo', label: 'Todo', dotClass: 'bg-slate-400' },
  { key: 'in_progress', label: 'In Progress', dotClass: 'bg-blue-500' },
  { key: 'blocked', label: 'Blocked', dotClass: 'bg-red-500' },
  { key: 'done', label: 'Done', dotClass: 'bg-green-500' },
]

const dragNodeId = ref<string | null>(null)
const dragOverColumn = ref<Status | null>(null)

// Inline editing
const editingCardId = ref<string | null>(null)
const editInputRef = ref<HTMLInputElement | null>(null)

function onDragStart(e: DragEvent, node: Node) {
  dragNodeId.value = node.id
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', node.id)
}

function onDragOver(e: DragEvent, status: Status) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  dragOverColumn.value = status
}

function onDragLeave(_e: DragEvent, status: Status) {
  if (dragOverColumn.value === status) {
    dragOverColumn.value = null
  }
}

function onDrop(e: DragEvent, status: Status) {
  e.preventDefault()
  const nodeId = dragNodeId.value ?? e.dataTransfer!.getData('text/plain')
  if (nodeId) {
    store.setStatus(nodeId, status)
  }
  dragNodeId.value = null
  dragOverColumn.value = null
}

function onDragEnd() {
  dragNodeId.value = null
  dragOverColumn.value = null
}

function onCardClick(node: Node) {
  store.selectNode(node.id)
}

function onCardDblClick(node: Node) {
  editingCardId.value = node.id
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

function onCardInput(e: Event, node: Node) {
  store.updateText(node.id, (e.target as HTMLInputElement).value)
}

function onCardEditBlur() {
  editingCardId.value = null
}

function onCardEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' || e.key === 'Enter') {
    editingCardId.value = null
    e.preventDefault()
  }
}

function childCount(node: Node): number {
  return store.getChildren(node.id).length
}

// Context menu
const ctxMenu = ref<{ nodeId: string; x: number; y: number } | null>(null)

function onCardContextMenu(e: MouseEvent, node: Node) {
  e.preventDefault()
  store.selectNode(node.id)
  ctxMenu.value = { nodeId: node.id, x: e.clientX, y: e.clientY }
}

function closeContextMenu() {
  ctxMenu.value = null
}
</script>

<template>
  <div class="flex flex-col sm:flex-row gap-3 h-full p-3 overflow-x-auto overflow-y-auto bg-white dark:bg-slate-900" role="region" aria-label="Kanban board">
    <div
      v-for="col in columns"
      :key="col.key"
      class="flex-1 min-w-0 sm:min-w-50 max-w-full sm:max-w-80 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex flex-col border-2 transition-colors"
      :class="
        dragOverColumn === col.key
          ? 'border-blue-300 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
          : 'border-transparent'
      "
      @dragover="onDragOver($event, col.key)"
      @dragleave="onDragLeave($event, col.key)"
      @drop="onDrop($event, col.key)"
    >
      <!-- Column header -->
      <div class="flex items-center gap-2 px-3 pt-3 pb-2 text-[13px] font-semibold text-slate-600 dark:text-slate-300">
        <span class="w-2.5 h-2.5 rounded-full" :class="col.dotClass" />
        <span>{{ col.label }}</span>
        <span class="ml-auto bg-slate-200 dark:bg-slate-700 rounded-full px-2 py-px text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {{ store.kanbanColumns[col.key].length }}
        </span>
      </div>

      <!-- Cards -->
      <div class="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-1.5">
        <div
          v-for="node in store.kanbanColumns[col.key]"
          :key="node.id"
          class="bg-white dark:bg-slate-800 border rounded-md px-3 py-2.5 cursor-grab transition-[box-shadow,border-color] hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-sm active:cursor-grabbing"
          :class="{
            'border-(--accent-500) shadow-[0_0_0_1px_var(--accent-500)]': store.selectedId === node.id,
            'opacity-40': dragNodeId === node.id,
            'border-slate-200 dark:border-slate-700': store.selectedId !== node.id,
          }"
          draggable="true"
          @dragstart="onDragStart($event, node)"
          @dragend="onDragEnd"
          @click="onCardClick(node)"
          @dblclick="onCardDblClick(node)"
          @contextmenu="onCardContextMenu($event, node)"
        >
          <div v-if="editingCardId === node.id">
            <input
              ref="editInputRef"
              class="w-full text-slate-800 dark:text-slate-200 leading-snug border-none outline-none bg-transparent p-0 font-[inherit] strata-text"
              :value="node.text"
              @input="onCardInput($event, node)"
              @blur="onCardEditBlur"
              @keydown="onCardEditKeydown"
              spellcheck="false"
            />
          </div>
          <div v-else class="text-slate-800 dark:text-slate-200 leading-snug overflow-hidden text-ellipsis whitespace-nowrap strata-text">
            {{ (node.text || '(empty)').split('\n')[0] }}
          </div>
          <div class="flex gap-2 mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            <span
              v-if="store.breadcrumb(node.id)"
              class="overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {{ store.breadcrumb(node.id) }}
            </span>
            <span v-if="childCount(node) > 0">
              {{ childCount(node) }} children
            </span>
          </div>
        </div>

        <!-- Empty column state -->
        <div
          v-if="store.kanbanColumns[col.key].length === 0"
          class="text-center text-slate-300 dark:text-slate-600 text-xs py-6"
        >
          No items
        </div>
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
