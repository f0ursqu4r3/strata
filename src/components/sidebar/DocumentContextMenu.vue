<script setup lang="ts">
import { Pencil, Trash2, FolderOpen, Save } from 'lucide-vue-next'
import { UiMenuItem, UiMenuDivider } from '@/components/ui'
import BaseContextMenu from '@/components/shared/BaseContextMenu.vue'
import { isTauri } from '@/lib/platform'
import { useDocumentsStore } from '@/stores/documents'

const props = defineProps<{
  docId: string
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
  rename: [docId: string]
  delete: [docId: string]
  reveal: [docId: string]
  save: [docId: string]
}>()

const docsStore = useDocumentsStore()

function onRename() {
  emit('rename', props.docId)
  emit('close')
}

function onReveal() {
  emit('reveal', props.docId)
  emit('close')
}

function onSave() {
  emit('save', props.docId)
  emit('close')
}

function onDelete() {
  emit('delete', props.docId)
  emit('close')
}
</script>

<template>
  <BaseContextMenu :x="x" :y="y" aria-label="Document actions" @close="emit('close')">
    <UiMenuItem v-if="docsStore.isDraft(docId)" :icon="Save" @click="onSave"> Save to Workspace </UiMenuItem>
    <UiMenuItem v-if="!docsStore.isDraft(docId)" :icon="Pencil" @click="onRename"> Rename </UiMenuItem>
    <UiMenuItem v-if="isTauri() && !docsStore.isDraft(docId)" :icon="FolderOpen" @click="onReveal"> Show in Finder </UiMenuItem>
    <UiMenuDivider />
    <UiMenuItem :icon="Trash2" danger @click="onDelete">
      {{ docsStore.isDraft(docId) ? 'Discard' : 'Delete' }}
    </UiMenuItem>
  </BaseContextMenu>
</template>
