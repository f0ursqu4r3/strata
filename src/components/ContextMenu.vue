<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  Pencil,
  Trash2,
  Copy,
  ZoomIn,
  Tag,
  ChevronRight,
  Circle,
  CircleDot,
  CircleAlert,
  CircleCheckBig,
} from 'lucide-vue-next'
import { useDocStore } from '@/stores/doc'
import type { Status } from '@/types'

const props = defineProps<{
  nodeId: string
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useDocStore()
const menuRef = ref<HTMLElement | null>(null)
const showStatusSub = ref(false)

const statuses: { key: Status; label: string; icon: typeof Circle }[] = [
  { key: 'todo', label: 'Todo', icon: Circle },
  { key: 'in_progress', label: 'In Progress', icon: CircleDot },
  { key: 'blocked', label: 'Blocked', icon: CircleAlert },
  { key: 'done', label: 'Done', icon: CircleCheckBig },
]

const statusColors: Record<Status, string> = {
  todo: 'text-(--status-todo)',
  in_progress: 'text-(--status-in-progress)',
  blocked: 'text-(--status-blocked)',
  done: 'text-(--status-done)',
}

function onEdit() {
  store.selectNode(props.nodeId)
  store.startEditing(props.nodeId)
  emit('close')
}

function onTags() {
  store.selectNode(props.nodeId)
  store.startEditing(props.nodeId)
  // The OutlineRow will show the tag picker when editing starts
  emit('close')
}

function onDuplicate() {
  store.selectNode(props.nodeId)
  store.duplicateNode(props.nodeId)
  emit('close')
}

function onZoomIn() {
  store.zoomIn(props.nodeId)
  emit('close')
}

function onDelete() {
  const rows = store.visibleRows
  const idx = rows.findIndex((r) => r.node.id === props.nodeId)
  const nextId = rows[idx + 1]?.node.id ?? rows[idx - 1]?.node.id ?? null
  store.tombstone(props.nodeId)
  if (nextId) store.selectNode(nextId)
  emit('close')
}

function onSetStatus(status: Status) {
  store.setStatus(props.nodeId, status)
  emit('close')
}

function onClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as HTMLElement)) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside, true)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside, true)
})
</script>

<template>
  <div
    ref="menuRef"
    class="fixed z-50 bg-(--bg-secondary) border border-(--border-secondary) rounded-lg shadow-lg py-1 min-w-44 text-sm"
    role="menu"
    aria-label="Node actions"
    :style="{ left: x + 'px', top: y + 'px' }"
  >
    <button
      class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary)"
      role="menuitem"
      @click="onEdit"
    >
      <Pencil class="w-3.5 h-3.5 text-(--text-faint)" />
      Edit
    </button>

    <!-- Status submenu -->
    <div
      class="relative"
      @mouseenter="showStatusSub = true"
      @mouseleave="showStatusSub = false"
    >
      <button
        class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary)"
        role="menuitem"
        aria-haspopup="true"
      >
        <CircleDot class="w-3.5 h-3.5 text-(--text-faint)" />
        Set status
        <ChevronRight class="w-3.5 h-3.5 text-(--text-faint) ml-auto" />
      </button>

      <div
        v-if="showStatusSub"
        class="absolute left-full top-0 bg-(--bg-secondary) border border-(--border-secondary) rounded-lg shadow-lg py-1 min-w-36"
        role="menu"
        aria-label="Status options"
      >
        <button
          v-for="s in statuses"
          :key="s.key"
          class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary)"
          role="menuitem"
          @click="onSetStatus(s.key)"
        >
          <component :is="s.icon" class="w-3.5 h-3.5" :class="statusColors[s.key]" />
          {{ s.label }}
        </button>
      </div>
    </div>

    <button
      class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary)"
      role="menuitem"
      @click="onTags"
    >
      <Tag class="w-3.5 h-3.5 text-(--text-faint)" />
      Tags
    </button>

    <button
      class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary)"
      role="menuitem"
      @click="onZoomIn"
    >
      <ZoomIn class="w-3.5 h-3.5 text-(--text-faint)" />
      Zoom in
    </button>

    <button
      class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary)"
      role="menuitem"
      @click="onDuplicate"
    >
      <Copy class="w-3.5 h-3.5 text-(--text-faint)" />
      Duplicate
    </button>

    <div class="border-t border-(--border-primary) my-1" />

    <button
      class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--color-danger-bg) text-left text-(--color-danger)"
      role="menuitem"
      @click="onDelete"
    >
      <Trash2 class="w-3.5 h-3.5" />
      Delete
    </button>
  </div>
</template>
