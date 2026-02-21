<script setup lang="ts">
import { Plus, Settings2 } from 'lucide-vue-next'
import { useDocStore } from '@/stores/doc'
import { rankAfter, initialRank } from '@/lib/rank'
import { UiMenuItem, UiMenuDivider } from '@/components/ui'
import BaseContextMenu from '@/components/shared/BaseContextMenu.vue'
import type { Status } from '@/types'

const props = defineProps<{
  statusId: string
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
  openStatusEditor: []
}>()

const store = useDocStore()

function onAddCard() {
  const parentId = store.effectiveZoomId
  const children = store.getChildren(parentId)
  const pos = children.length > 0
    ? rankAfter(children[children.length - 1]!.pos)
    : initialRank()
  const op = store.createNode(parentId, pos, '', props.statusId as Status)
  const newId = (op.payload as { id: string }).id
  store.selectNode(newId)
  store.startEditing(newId)
  emit('close')
}

function onManageStatuses() {
  emit('openStatusEditor')
  emit('close')
}
</script>

<template>
  <BaseContextMenu :x="x" :y="y" aria-label="Column actions" min-width="min-w-40" @close="emit('close')">
    <UiMenuItem :icon="Plus" @click="onAddCard">
      Add card
    </UiMenuItem>
    <UiMenuDivider />
    <UiMenuItem :icon="Settings2" @click="onManageStatuses">
      Manage statuses
    </UiMenuItem>
  </BaseContextMenu>
</template>
