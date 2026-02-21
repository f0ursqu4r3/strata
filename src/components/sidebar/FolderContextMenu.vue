<script setup lang="ts">
import { Plus, FolderPlus } from 'lucide-vue-next'
import { UiMenuItem } from '@/components/ui'
import BaseContextMenu from '@/components/shared/BaseContextMenu.vue'

const props = defineProps<{
  folderPath: string
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
  'create-doc': [folder: string]
  'create-folder': [parentPath: string]
}>()

function onNewDoc() {
  emit('create-doc', props.folderPath)
  emit('close')
}

function onNewFolder() {
  emit('create-folder', props.folderPath)
  emit('close')
}
</script>

<template>
  <BaseContextMenu :x="x" :y="y" aria-label="Folder actions" @close="emit('close')">
    <UiMenuItem :icon="Plus" @click="onNewDoc">
      New Document Here
    </UiMenuItem>
    <UiMenuItem :icon="FolderPlus" @click="onNewFolder">
      New Sub-folder
    </UiMenuItem>
  </BaseContextMenu>
</template>
