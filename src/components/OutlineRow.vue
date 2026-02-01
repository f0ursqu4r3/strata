<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useDocStore } from '@/stores/doc'
import type { Node } from '@/types'

const props = defineProps<{
  node: Node
  depth: number
}>()

const store = useDocStore()
const inputRef = ref<HTMLInputElement | null>(null)

const isSelected = computed(() => store.selectedId === props.node.id)
const isEditing = computed(() => store.editingId === props.node.id)
const hasChildren = computed(() => store.getChildren(props.node.id).length > 0)

const localText = ref(props.node.text)

watch(
  () => props.node.text,
  (v) => {
    if (!isEditing.value) localText.value = v
  },
)

watch(isEditing, async (editing) => {
  if (editing) {
    localText.value = props.node.text
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  }
})

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  localText.value = val
  store.updateText(props.node.id, val)
}

function onBlur() {
  if (isEditing.value) {
    store.stopEditing()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    store.stopEditing()
    e.preventDefault()
  } else if (e.key === 'Enter' && !e.shiftKey) {
    store.stopEditing()
    store.createSiblingBelow()
    e.preventDefault()
  } else if (e.key === 'ArrowUp' && !e.shiftKey) {
    store.stopEditing()
    store.moveSelectionUp()
    e.preventDefault()
  } else if (e.key === 'ArrowDown' && !e.shiftKey) {
    store.stopEditing()
    store.moveSelectionDown()
    e.preventDefault()
  } else if (e.key === 'Tab' && !e.shiftKey) {
    store.stopEditing()
    store.indentNode()
    store.startEditing(store.selectedId)
    e.preventDefault()
  } else if (e.key === 'Tab' && e.shiftKey) {
    store.stopEditing()
    store.outdentNode()
    store.startEditing(store.selectedId)
    e.preventDefault()
  }
}

function onClick() {
  store.selectNode(props.node.id)
}

function onDblClick() {
  store.selectNode(props.node.id)
  store.startEditing(props.node.id)
}

function onToggleCollapse(e: MouseEvent) {
  e.stopPropagation()
  store.toggleCollapsed(props.node.id)
}

const isSearchMatch = computed(() => {
  const matches = store.searchMatchIds
  if (!matches) return false
  const q = store.searchQuery.trim().toLowerCase()
  return q !== '' && props.node.text.toLowerCase().includes(q)
})

function onBulletClick(e: MouseEvent) {
  e.stopPropagation()
  if (hasChildren.value) {
    store.toggleCollapsed(props.node.id)
  } else {
    store.zoomIn(props.node.id)
  }
}

function onBulletDblClick(e: MouseEvent) {
  e.stopPropagation()
  store.zoomIn(props.node.id)
}

// ── Drag reorder ──
function onDragStart(e: DragEvent) {
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('application/x-strata-node', props.node.id)
  ;(e.target as HTMLElement).classList.add('opacity-40')
}

function onDragEnd(e: DragEvent) {
  ;(e.target as HTMLElement).classList.remove('opacity-40')
}

const statusColors: Record<string, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  blocked: 'bg-red-500',
  done: 'bg-green-500',
}
</script>

<template>
  <div
    class="flex items-center h-8 cursor-pointer select-none rounded gap-1.5 hover:bg-slate-100"
    :class="{
      'bg-slate-200': isSelected && !isEditing,
      'bg-blue-100': isEditing,
      'ring-1 ring-amber-300 bg-amber-50': isSearchMatch && !isSelected && !isEditing,
    }"
    :style="{ paddingLeft: depth * 24 + 8 + 'px' }"
    draggable="true"
    @click="onClick"
    @dblclick="onDblClick"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <!-- Collapse toggle / bullet -->
    <span
      class="w-4 shrink-0 text-center text-xs text-slate-500 cursor-pointer"
      :class="{ 'hover:text-slate-800': hasChildren }"
      @click="onBulletClick"
      @dblclick="onBulletDblClick"
    >
      <template v-if="hasChildren">
        {{ node.collapsed ? '&#x25B8;' : '&#x25BE;' }}
      </template>
      <template v-else>
        <span class="text-slate-400 text-sm">&bull;</span>
      </template>
    </span>

    <!-- Status dot -->
    <span
      class="w-2 h-2 rounded-full shrink-0"
      :class="statusColors[node.status]"
      :title="node.status"
    />

    <!-- Text -->
    <template v-if="isEditing">
      <input
        ref="inputRef"
        class="flex-1 border-none outline-none bg-transparent text-sm font-[inherit] text-slate-800 p-0"
        :value="localText"
        @input="onInput"
        @blur="onBlur"
        @keydown="onKeydown"
        spellcheck="false"
      />
    </template>
    <template v-else>
      <span
        class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm"
        :class="node.text ? 'text-slate-800' : 'text-slate-400 italic'"
      >
        {{ node.text || '(empty)' }}
      </span>
    </template>
  </div>
</template>
