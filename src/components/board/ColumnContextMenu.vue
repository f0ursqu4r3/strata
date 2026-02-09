<script setup lang="ts">
import { ref } from 'vue'
import { Plus, Settings2 } from 'lucide-vue-next'
import { useDocStore } from '@/stores/doc'
import { rankAfter, initialRank } from '@/lib/rank'
import { useClickOutside, UiMenuItem, UiMenuDivider } from '@/components/ui'
import { useMenuPosition } from '@/composables/useMenuPosition'
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
const menuRef = ref<HTMLElement | null>(null)

useClickOutside(menuRef, () => emit('close'))
const { style: menuStyle } = useMenuPosition(menuRef, props.x, props.y)

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
  <Teleport to="body">
  <div
    ref="menuRef"
    class="fixed z-50 bg-(--bg-secondary) border border-(--border-secondary) rounded-lg shadow-lg py-1 min-w-40 text-sm"
    role="menu"
    aria-label="Column actions"
    :style="menuStyle"
  >
    <UiMenuItem :icon="Plus" @click="onAddCard">
      Add card
    </UiMenuItem>
    <UiMenuDivider />
    <UiMenuItem :icon="Settings2" @click="onManageStatuses">
      Manage statuses
    </UiMenuItem>
  </div>
  </Teleport>
</template>
