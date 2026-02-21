<script setup lang="ts">
import { Pencil, Trash2 } from 'lucide-vue-next'
import { UiMenuItem, UiMenuDivider } from '@/components/ui'
import BaseContextMenu from '@/components/shared/BaseContextMenu.vue'

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
  <BaseContextMenu :x="x" :y="y" aria-label="Document actions" @close="emit('close')">
    <UiMenuItem :icon="Pencil" @click="onRename">
      Rename
    </UiMenuItem>
    <UiMenuDivider />
    <UiMenuItem :icon="Trash2" danger @click="onDelete">
      Delete
    </UiMenuItem>
  </BaseContextMenu>
</template>
