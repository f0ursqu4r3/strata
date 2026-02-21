<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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
import { UiMenuItem, UiMenuDivider } from '@/components/ui'
import BaseContextMenu from './BaseContextMenu.vue'
import type { Status } from '@/types'
import DatePicker from './DatePicker.vue'

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
const baseMenuRef = ref<InstanceType<typeof BaseContextMenu> | null>(null)
const showStatusSub = ref(false)
const showDatePicker = ref(false)

const isMultiSelect = computed(() => store.selectedIds.size > 1 && store.selectedIds.has(props.nodeId))

// Flip submenus to open left if near right edge
const subLeft = ref(false)
onMounted(() => {
  const el = baseMenuRef.value?.menuRef
  if (!el) return
  const rect = el.getBoundingClientRect()
  subLeft.value = rect.right + 160 > window.innerWidth
})

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

function onHistory() {
  emit('history', props.nodeId)
  emit('close')
}
</script>

<template>
  <BaseContextMenu
    ref="baseMenuRef"
    :x="x"
    :y="y"
    aria-label="Node actions"
    min-width="min-w-44"
    @close="emit('close')"
  >
    <UiMenuItem v-if="!isMultiSelect" :icon="Pencil" @click="onEdit">
      Edit
    </UiMenuItem>

    <!-- Status submenu -->
    <div
      class="relative"
      @mouseenter="showStatusSub = true"
      @mouseleave="showStatusSub = false"
    >
      <button
        class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary) cursor-pointer"
        role="menuitem"
        aria-haspopup="true"
      >
        <CircleDot class="w-3.5 h-3.5 text-(--text-faint)" />
        <span class="flex-1">Set status</span>
        <ChevronRight class="w-3.5 h-3.5 text-(--text-faint)" />
      </button>

      <div
        v-if="showStatusSub"
        class="absolute top-0 bg-(--bg-secondary) border border-(--border-secondary) rounded-lg shadow-lg py-1 min-w-36"
        :class="subLeft ? 'right-full' : 'left-full'"
        role="menu"
        aria-label="Status options"
      >
        <button
          v-for="s in store.statusDefs"
          :key="s.id"
          class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary) cursor-pointer"
          role="menuitem"
          @click="onSetStatus(s.id)"
        >
          <component :is="resolveStatusIcon(s.icon)" class="w-3.5 h-3.5" :style="{ color: s.color }" />
          {{ s.label }}
        </button>
      </div>
    </div>

    <UiMenuItem v-if="!isMultiSelect" :icon="Tag" @click="onTags">
      Tags
    </UiMenuItem>

    <!-- Due date -->
    <div v-if="!isMultiSelect" class="relative">
      <button
        class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary) cursor-pointer"
        role="menuitem"
        @click="showDatePicker = !showDatePicker"
      >
        <Calendar class="w-3.5 h-3.5 text-(--text-faint)" />
        <span class="flex-1">Due date</span>
      </button>
      <div v-if="showDatePicker" class="absolute top-0 z-10" :class="subLeft ? 'right-full' : 'left-full'">
        <DatePicker
          :model-value="store.nodes.get(nodeId)?.dueDate ?? null"
          @update:model-value="onSetDueDate($event)"
        />
      </div>
    </div>

    <UiMenuItem v-if="!isMultiSelect" :icon="ZoomIn" @click="onZoomIn">
      Zoom in
    </UiMenuItem>

    <UiMenuItem v-if="!isMultiSelect" :icon="Copy" @click="onDuplicate">
      Duplicate
    </UiMenuItem>

    <UiMenuItem v-if="!isMultiSelect" :icon="Clock" @click="onHistory">
      History
    </UiMenuItem>

    <UiMenuDivider />

    <UiMenuItem :icon="Trash2" danger @click="onDelete">
      {{ isMultiSelect ? `Delete ${store.selectedIds.size} items` : 'Delete' }}
    </UiMenuItem>
  </BaseContextMenu>
</template>
