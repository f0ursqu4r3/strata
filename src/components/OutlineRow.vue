<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted } from 'vue'
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
const inputRef = ref<HTMLTextAreaElement | null>(null)

const isSelected = computed(() => store.selectedId === props.node.id)
const isEditing = computed(() => store.editingId === props.node.id)
const hasChildren = computed(() => store.getChildren(props.node.id).length > 0)

const localText = ref(props.node.text)

onMounted(async () => {
  await nextTick()
  autoResize()
  // If this row is already in editing state when mounted (e.g. Enter created
  // a new sibling), the watch won't fire so we need to focus here.
  if (isEditing.value) {
    const input = inputRef.value
    if (input && document.activeElement !== input) {
      input.focus()
      if (store.editingTrigger === 'keyboard') {
        const len = input.value.length
        input.setSelectionRange(len, len)
      }
    }
  }
})

function autoResize() {
  const el = inputRef.value
  if (el) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }
}

watch(
  () => props.node.text,
  (v) => {
    if (!isEditing.value) {
      localText.value = v
      nextTick(autoResize)
    }
  },
)

watch(isEditing, async (editing) => {
  if (editing) {
    localText.value = props.node.text
    await nextTick()
    autoResize()
    const input = inputRef.value
    if (input) {
      if (document.activeElement !== input) {
        input.focus()
      }
      if (store.editingTrigger === 'keyboard') {
        const len = input.value.length
        input.setSelectionRange(len, len)
      }
    }
  }
})

function onInput(e: Event) {
  const val = (e.target as HTMLTextAreaElement).value
  localText.value = val
  store.updateText(props.node.id, val)
  autoResize()
}

function onBlur() {
  // Only stop editing if this node is still the one being edited.
  // When Enter creates a sibling, editingId moves to the new node
  // before this blur fires — don't clear it.
  if (store.editingId === props.node.id) {
    store.stopEditing()
  }
}

function onKeydown(e: KeyboardEvent) {
  const input = inputRef.value

  // Status shortcuts work while editing: Ctrl+1/2/3/4
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
    const statusMap: Record<string, Status> = {
      '1': 'todo',
      '2': 'in_progress',
      '3': 'blocked',
      '4': 'done',
    }
    if (statusMap[e.key]) {
      store.setStatus(props.node.id, statusMap[e.key]!)
      e.preventDefault()
      return
    }
  }

  if (e.key === 'Escape') {
    store.stopEditing()
    ;(inputRef.value?.closest('.outline-focus-target') as HTMLElement)?.focus()
    e.preventDefault()
  } else if (e.key === 'Enter' && e.shiftKey) {
    // Shift+Enter: create new sibling below
    store.flushTextDebounce()
    store.createSiblingBelowAndEdit()
    e.preventDefault()
  } else if (e.key === 'Enter' && !e.shiftKey) {
    // Enter: insert newline (default textarea behavior, let it through)
    nextTick(autoResize)
  } else if (e.key === 'Backspace' && input && input.value === '') {
    e.preventDefault()
    store.deleteNodeAndEditPrevious(props.node.id)
  } else if (e.key === 'ArrowUp' && !e.shiftKey && input) {
    // Only navigate to previous node if cursor is on the first line
    const pos = input.selectionStart ?? 0
    const onFirstLine = input.value.lastIndexOf('\n', pos - 1) === -1
    if (onFirstLine && pos === 0 && input.selectionEnd === 0) {
      e.preventDefault()
      store.flushTextDebounce()
      store.editPreviousNode(props.node.id)
    }
  } else if (e.key === 'ArrowDown' && !e.shiftKey && input) {
    // Only navigate to next node if cursor is on the last line
    const pos = input.selectionStart ?? 0
    const len = input.value.length
    const onLastLine = input.value.indexOf('\n', pos) === -1
    if (onLastLine && pos === len && input.selectionEnd === len) {
      e.preventDefault()
      store.flushTextDebounce()
      store.editNextNode(props.node.id)
    }
  } else if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault()
    store.indentAndKeepEditing(props.node.id)
  } else if (e.key === 'Tab' && e.shiftKey) {
    e.preventDefault()
    store.outdentAndKeepEditing(props.node.id)
  }
}

function onFocus() {
  if (!isEditing.value) {
    store.selectNode(props.node.id)
    store.startEditing(props.node.id, 'click')
  }
}

function onClick(e: MouseEvent) {
  store.selectNode(props.node.id)
  // Clicking on row background (not the input): focus the input
  if (e.target !== inputRef.value) {
    store.startEditing(props.node.id, 'keyboard')
  }
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
  { key: 'todo', label: 'Todo', icon: Circle, color: 'text-(--status-todo)' },
  { key: 'in_progress', label: 'In Progress', icon: CircleDot, color: 'text-(--status-in-progress)' },
  { key: 'blocked', label: 'Blocked', icon: CircleAlert, color: 'text-(--status-blocked)' },
  { key: 'done', label: 'Done', icon: CircleCheckBig, color: 'text-(--status-done)' },
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
    class="flex items-start min-h-8 cursor-pointer select-none rounded gap-1.5 hover:bg-(--bg-hover)"
    :class="{
      'bg-(--bg-active)': isSelected && !isEditing,
      'bg-(--bg-editing)': isEditing,
      'ring-1 ring-(--highlight-search-ring) bg-(--highlight-search-bg)': isSearchMatch && !isSelected && !isEditing,
    }"
    :style="{ paddingLeft: depth * 24 + 8 + 'px' }"
    role="treeitem"
    :aria-selected="isSelected"
    :aria-expanded="hasChildren ? !node.collapsed : undefined"
    :aria-level="depth + 1"
    :aria-label="node.text || '(empty)'"
    draggable="true"
    @click="onClick"
    @contextmenu="onContextMenu"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <!-- Collapse toggle / bullet -->
    <span
      class="w-4 shrink-0 text-center text-(--text-muted) cursor-pointer flex items-center justify-center h-8"
      :class="{ 'hover:text-(--text-primary)': hasChildren }"
      role="button"
      :aria-label="hasChildren ? (node.collapsed ? 'Expand' : 'Collapse') : 'Zoom into node'"
      @click="onBulletClick"
      @dblclick.stop="onBulletDblClick"
    >
      <template v-if="hasChildren">
        <ChevronDown v-if="!node.collapsed" class="w-3.5 h-3.5" />
        <ChevronRight v-else class="w-3.5 h-3.5" />
      </template>
      <template v-else>
        <span class="w-1.5 h-1.5 rounded-full bg-(--border-hover)" />
      </template>
    </span>

    <!-- Status dot (clickable picker) -->
    <div class="relative shrink-0 h-8 flex items-center" role="button" :aria-label="'Status: ' + node.status.replace('_', ' ')" @click="onStatusClick">
      <component
        :is="currentStatusIcon().icon"
        class="w-3.5 h-3.5 cursor-pointer hover:scale-125 transition-transform"
        :class="currentStatusIcon().color"
      />

      <!-- Inline status picker dropdown -->
      <div
        v-if="showStatusPicker"
        ref="statusPickerRef"
        class="absolute left-0 top-5 z-40 bg-(--bg-secondary) border border-(--border-secondary) rounded-lg shadow-lg py-1 min-w-32"
        role="listbox"
        aria-label="Select status"
        @blur="onStatusPickerBlur"
      >
        <button
          v-for="s in statusOptions"
          :key="s.key"
          class="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary) text-xs"
          :class="{ 'bg-(--bg-tertiary) font-medium': node.status === s.key }"
          @click.stop="onPickStatus(s.key)"
        >
          <component :is="s.icon" class="w-3.5 h-3.5" :class="s.color" />
          {{ s.label }}
        </button>
      </div>
    </div>

    <!-- Text (always a textarea for seamless click-to-edit + multiline) -->
    <textarea
      ref="inputRef"
      class="flex-1 border-none outline-none bg-transparent font-[inherit] text-(--text-secondary) p-0 py-1.5 strata-text resize-none overflow-hidden leading-5 placeholder:text-(--text-faint) placeholder:italic select-text"
      :value="localText"
      placeholder="(empty)"
      rows="1"
      tabindex="-1"
      spellcheck="false"
      @focus="onFocus"
      @input="onInput"
      @blur="onBlur"
      @keydown="onKeydown"
    />
  </div>
</template>
