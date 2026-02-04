<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Pencil,
  Trash2,
  Copy,
  ZoomIn,
  Tag,
  ChevronRight,
  CircleDot,
  Calendar,
  Clock,
} from 'lucide-vue-next'
import { useDocStore } from '@/stores/doc'
import { resolveStatusIcon } from '@/lib/status-icons'
import type { Status } from '@/types'
import DatePicker from '@/components/DatePicker.vue'

const props = defineProps<{
  nodeId: string
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
  history: [nodeId: string]
}>()

const store = useDocStore()
const menuRef = ref<HTMLElement | null>(null)
const showStatusSub = ref(false)
const showDatePicker = ref(false)

const isMultiSelect = computed(() => store.selectedIds.size > 1 && store.selectedIds.has(props.nodeId))

function onSetDueDate(dueDate: number | null) {
  store.setDueDate(props.nodeId, dueDate)
  emit('close')
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
  if (isMultiSelect.value) {
    store.bulkTombstone()
  } else {
    const rows = store.visibleRows
    const idx = rows.findIndex((r) => r.node.id === props.nodeId)
    const nextId = rows[idx + 1]?.node.id ?? rows[idx - 1]?.node.id ?? null
    store.tombstone(props.nodeId)
    if (nextId) store.selectNode(nextId)
  }
  emit('close')
}

function onSetStatus(status: Status) {
  if (isMultiSelect.value) {
    store.bulkSetStatus(status)
  } else {
    store.setStatus(props.nodeId, status)
  }
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
      v-if="!isMultiSelect"
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
          v-for="s in store.statusDefs"
          :key="s.id"
          class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary)"
          role="menuitem"
          @click="onSetStatus(s.id)"
        >
          <component :is="resolveStatusIcon(s.icon)" class="w-3.5 h-3.5" :style="{ color: s.color }" />
          {{ s.label }}
        </button>
      </div>
    </div>

    <button
      v-if="!isMultiSelect"
      class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary)"
      role="menuitem"
      @click="onTags"
    >
      <Tag class="w-3.5 h-3.5 text-(--text-faint)" />
      Tags
    </button>

    <!-- Due date -->
    <div v-if="!isMultiSelect" class="relative">
      <button
        class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary)"
        role="menuitem"
        @click="showDatePicker = !showDatePicker"
      >
        <Calendar class="w-3.5 h-3.5 text-(--text-faint)" />
        Due date
      </button>
      <div
        v-if="showDatePicker"
        class="absolute left-full top-0 z-10"
      >
        <DatePicker
          :model-value="store.nodes.get(nodeId)?.dueDate ?? null"
          @update:model-value="onSetDueDate($event)"
        />
      </div>
    </div>

    <button
      v-if="!isMultiSelect"
      class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary)"
      role="menuitem"
      @click="onZoomIn"
    >
      <ZoomIn class="w-3.5 h-3.5 text-(--text-faint)" />
      Zoom in
    </button>

    <button
      v-if="!isMultiSelect"
      class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary)"
      role="menuitem"
      @click="onDuplicate"
    >
      <Copy class="w-3.5 h-3.5 text-(--text-faint)" />
      Duplicate
    </button>

    <button
      v-if="!isMultiSelect"
      class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary)"
      role="menuitem"
      @click="emit('history', props.nodeId); emit('close')"
    >
      <Clock class="w-3.5 h-3.5 text-(--text-faint)" />
      History
    </button>

    <div class="border-t border-(--border-primary) my-1" />

    <button
      class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--color-danger-bg) text-left text-(--color-danger)"
      role="menuitem"
      @click="onDelete"
    >
      <Trash2 class="w-3.5 h-3.5" />
      {{ isMultiSelect ? `Delete ${store.selectedIds.size} items` : 'Delete' }}
    </button>
  </div>
</template>
