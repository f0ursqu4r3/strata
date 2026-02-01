<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import {
  ChevronRight,
  ChevronDown,
  Circle,
  CircleDot,
  CircleAlert,
  CircleCheckBig,
} from 'lucide-vue-next'
import { useDocStore } from '@/stores/doc'
import type { Node, Status } from '@/types'

const props = defineProps<{
  node: Node
  depth: number
}>()

const emit = defineEmits<{
  contextmenu: [nodeId: string, x: number, y: number]
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

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  store.selectNode(props.node.id)
  emit('contextmenu', props.node.id, e.clientX, e.clientY)
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

// ── Inline status picker ──
const showStatusPicker = ref(false)
const statusPickerRef = ref<HTMLElement | null>(null)

const statusOptions: { key: Status; label: string; icon: typeof Circle; color: string }[] = [
  { key: 'todo', label: 'Todo', icon: Circle, color: 'text-slate-400' },
  { key: 'in_progress', label: 'In Progress', icon: CircleDot, color: 'text-blue-500' },
  { key: 'blocked', label: 'Blocked', icon: CircleAlert, color: 'text-red-500' },
  { key: 'done', label: 'Done', icon: CircleCheckBig, color: 'text-green-500' },
]

function currentStatusIcon() {
  return statusOptions.find((s) => s.key === props.node.status) ?? statusOptions[0]!
}

function onStatusClick(e: MouseEvent) {
  e.stopPropagation()
  showStatusPicker.value = !showStatusPicker.value
}

function onPickStatus(status: Status) {
  store.setStatus(props.node.id, status)
  showStatusPicker.value = false
}

function onStatusPickerBlur() {
  // Delay to allow click to register
  setTimeout(() => {
    showStatusPicker.value = false
  }, 150)
}
</script>

<template>
  <div
    class="flex items-center h-8 cursor-pointer select-none rounded gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"
    :class="{
      'bg-slate-200 dark:bg-slate-700': isSelected && !isEditing,
      'bg-blue-100 dark:bg-blue-900/40': isEditing,
      'ring-1 ring-amber-300 bg-amber-50 dark:ring-amber-500 dark:bg-amber-900/30': isSearchMatch && !isSelected && !isEditing,
    }"
    :style="{ paddingLeft: depth * 24 + 8 + 'px' }"
    draggable="true"
    @click="onClick"
    @dblclick="onDblClick"
    @contextmenu="onContextMenu"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <!-- Collapse toggle / bullet -->
    <span
      class="w-4 shrink-0 text-center text-slate-500 dark:text-slate-400 cursor-pointer flex items-center justify-center"
      :class="{ 'hover:text-slate-800 dark:hover:text-slate-200': hasChildren }"
      @click="onBulletClick"
      @dblclick.stop="onBulletDblClick"
    >
      <template v-if="hasChildren">
        <ChevronDown v-if="!node.collapsed" class="w-3.5 h-3.5" />
        <ChevronRight v-else class="w-3.5 h-3.5" />
      </template>
      <template v-else>
        <span class="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
      </template>
    </span>

    <!-- Status dot (clickable picker) -->
    <div class="relative shrink-0" @click="onStatusClick">
      <component
        :is="currentStatusIcon().icon"
        class="w-3.5 h-3.5 cursor-pointer hover:scale-125 transition-transform"
        :class="currentStatusIcon().color"
      />

      <!-- Inline status picker dropdown -->
      <div
        v-if="showStatusPicker"
        ref="statusPickerRef"
        class="absolute left-0 top-5 z-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg py-1 min-w-32"
        @blur="onStatusPickerBlur"
      >
        <button
          v-for="s in statusOptions"
          :key="s.key"
          class="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-left text-slate-700 dark:text-slate-300 text-xs"
          :class="{ 'bg-slate-50 dark:bg-slate-700 font-medium': node.status === s.key }"
          @click.stop="onPickStatus(s.key)"
        >
          <component :is="s.icon" class="w-3.5 h-3.5" :class="s.color" />
          {{ s.label }}
        </button>
      </div>
    </div>

    <!-- Text -->
    <template v-if="isEditing">
      <input
        ref="inputRef"
        class="flex-1 border-none outline-none bg-transparent text-sm font-[inherit] text-slate-800 dark:text-slate-200 p-0"
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
        :class="node.text ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 italic'"
      >
        {{ node.text || '(empty)' }}
      </span>
    </template>
  </div>
</template>
