<script setup lang="ts">
import { ref } from 'vue'
import { Pencil, Trash2 } from 'lucide-vue-next'
import { useClickOutside, UiMenuItem, UiMenuDivider } from '@/components/ui'
import { useMenuPosition } from '@/composables/useMenuPosition'

const props = defineProps<{
  docId: string
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
  rename: [docId: string]
  delete: [docId: string]
}>()

const menuRef = ref<HTMLElement | null>(null)

useClickOutside(menuRef, () => emit('close'))
const { style: menuStyle } = useMenuPosition(menuRef, props.x, props.y)

function onRename() {
  emit('rename', props.docId)
  emit('close')
}

function onDelete() {
  emit('delete', props.docId)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
  <div
    ref="menuRef"
    class="fixed z-50 bg-(--bg-secondary) border border-(--border-secondary) rounded-lg shadow-lg py-1 min-w-36 text-sm"
    role="menu"
    aria-label="Document actions"
    :style="menuStyle"
  >
    <UiMenuItem :icon="Pencil" @click="onRename">
      Rename
    </UiMenuItem>
    <UiMenuDivider />
    <UiMenuItem :icon="Trash2" danger @click="onDelete">
      Delete
    </UiMenuItem>
  </div>
  </Teleport>
</template>
