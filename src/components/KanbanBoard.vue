<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { Settings2 } from 'lucide-vue-next'
import { useDocStore } from '@/stores/doc'
import { useSettingsStore } from '@/stores/settings'
import { renderInlineMarkdown } from '@/lib/inline-markdown'
import type { Node } from '@/types'
import ContextMenu from './ContextMenu.vue'

const store = useDocStore()
const settings = useSettingsStore()
const emit = defineEmits<{ openStatusEditor: [] }>()

const dragNodeId = ref<string | null>(null)
const dragOverColumn = ref<string | null>(null)

// Inline editing
const editingCardId = ref<string | null>(null)
const editInputRef = ref<HTMLInputElement | null>(null)

function onDragStart(e: DragEvent, node: Node) {
  dragNodeId.value = node.id
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', node.id)
}

function onDragOver(e: DragEvent, statusId: string) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  dragOverColumn.value = statusId
}

function onDragLeave(_e: DragEvent, statusId: string) {
  if (dragOverColumn.value === statusId) {
    dragOverColumn.value = null
  }
}

function onDrop(e: DragEvent, statusId: string) {
  e.preventDefault()
  const nodeId = dragNodeId.value ?? e.dataTransfer!.getData('text/plain')
  if (nodeId) {
    store.setStatus(nodeId, statusId)
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
  <div class="flex flex-col h-full bg-(--bg-primary)">
    <!-- Kanban header with gear button -->
    <div class="flex items-center justify-end px-3 pt-2 pb-0 shrink-0">
      <button
        class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer"
        title="Manage statuses"
        @click="emit('openStatusEditor')"
      >
        <Settings2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 flex-1 p-3 pt-1 overflow-x-auto overflow-y-auto" role="region" aria-label="Kanban board">
      <div
        v-for="col in store.kanbanColumns"
        :key="col.def.id"
        class="flex-1 min-w-0 sm:min-w-50 max-w-full sm:max-w-80 bg-(--bg-tertiary) rounded-lg flex flex-col border-2 transition-colors"
        :class="
          dragOverColumn === col.def.id
            ? 'border-(--highlight-drag-border) bg-(--highlight-drag-bg)'
            : 'border-transparent'
        "
        @dragover="onDragOver($event, col.def.id)"
        @dragleave="onDragLeave($event, col.def.id)"
        @drop="onDrop($event, col.def.id)"
      >
        <!-- Column header -->
        <div class="flex items-center gap-2 px-3 pt-3 pb-2 text-[13px] font-semibold text-(--text-tertiary)">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: col.def.color }" />
          <span>{{ col.def.label }}</span>
          <span class="ml-auto bg-(--bg-active) rounded-full px-2 py-px text-[11px] font-medium text-(--text-muted)">
            {{ col.nodes.length }}
          </span>
        </div>

        <!-- Cards -->
        <div class="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-1.5">
          <div
            v-for="node in col.nodes"
            :key="node.id"
            class="bg-(--bg-secondary) border rounded-md px-3 py-2.5 cursor-grab transition-[box-shadow,border-color] hover:border-(--border-hover) hover:shadow-sm active:cursor-grabbing"
            :class="{
              'border-(--accent-500) shadow-[0_0_0_1px_var(--accent-500)]': store.selectedId === node.id,
              'opacity-40': dragNodeId === node.id,
              'border-(--border-primary)': store.selectedId !== node.id,
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
                class="w-full text-(--text-secondary) leading-snug border-none outline-none bg-transparent p-0 font-[inherit] strata-text"
                :value="node.text"
                @input="onCardInput($event, node)"
                @blur="onCardEditBlur"
                @keydown="onCardEditKeydown"
                spellcheck="false"
              />
            </div>
            <!-- eslint-disable vue/no-v-html -->
            <div
              v-else
              class="text-(--text-secondary) leading-snug overflow-hidden text-ellipsis whitespace-nowrap strata-text"
              v-html="renderInlineMarkdown((node.text || '(empty)').split('\n')[0]!)"
            />
            <div class="flex gap-2 mt-1 text-[11px] text-(--text-faint)">
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
            <div v-if="settings.showTags && node.tags?.length > 0" class="flex flex-wrap gap-1 mt-1.5">
              <span
                v-for="tag in node.tags.slice(0, 3)"
                :key="tag"
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-(--accent-100) text-(--accent-700)"
              >
                {{ tag }}
              </span>
              <span
                v-if="node.tags.length > 3"
                class="text-[10px] text-(--text-faint)"
              >
                +{{ node.tags.length - 3 }}
              </span>
            </div>
          </div>

          <!-- Empty column state -->
          <div
            v-if="col.nodes.length === 0"
            class="text-center text-(--text-faint) text-xs py-6"
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
  </div>
</template>
