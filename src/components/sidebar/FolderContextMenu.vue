<script setup lang="ts">
import { Plus, FolderPlus, FolderOpen } from 'lucide-vue-next'
import { UiMenuItem, UiMenuDivider } from '@/components/ui'
import BaseContextMenu from '@/components/shared/BaseContextMenu.vue'
import { isTauri } from '@/lib/platform'

const props = defineProps<{
  folderPath: string
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
  'create-doc': [folder: string]
  'create-folder': [parentPath: string]
  reveal: [folderPath: string]
}>()

function onNewDoc() {
  emit('create-doc', props.folderPath)
  emit('close')
}

function onNewFolder() {
  emit('create-folder', props.folderPath)
  emit('close')
}

function onReveal() {
  emit('reveal', props.folderPath)
  emit('close')
}
</script>

<template>
  <BaseContextMenu :x="x" :y="y" aria-label="Folder actions" @close="emit('close')">
    <UiMenuItem :icon="Plus" @click="onNewDoc"> New Document Here </UiMenuItem>
    <UiMenuItem :icon="FolderPlus" @click="onNewFolder"> New Folder </UiMenuItem>
    <template v-if="isTauri()">
      <UiMenuDivider />
      <UiMenuItem :icon="FolderOpen" @click="onReveal"> Show in Finder </UiMenuItem>
    </template>
  </BaseContextMenu>
</template>
