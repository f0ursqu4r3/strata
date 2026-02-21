<script setup lang="ts">
import { ref } from 'vue'
import { useClickOutside } from '@/components/ui'
import { useMenuPosition } from '@/composables/useMenuPosition'

const props = defineProps<{
  x: number
  y: number
  ariaLabel?: string
  minWidth?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const menuRef = ref<HTMLElement | null>(null)

useClickOutside(menuRef, () => emit('close'))
const { style: menuStyle } = useMenuPosition(menuRef, props.x, props.y)

defineExpose({ menuRef })
</script>

<template>
  <Teleport to="body">
    <div
      ref="menuRef"
      class="fixed z-50 bg-(--bg-secondary) border border-(--border-secondary) rounded-lg shadow-lg py-1 text-sm"
      :class="minWidth ?? 'min-w-36'"
      role="menu"
      :aria-label="ariaLabel ?? 'Actions'"
      :style="menuStyle"
    >
      <slot />
    </div>
  </Teleport>
</template>
