<script setup lang="ts">
import { ref } from 'vue'
import { useClickOutside } from '@/composables/useClickOutside'

interface Props {
  align?: 'left' | 'right'
  width?: string
}

withDefaults(defineProps<Props>(), {
  align: 'left',
  width: 'w-36',
})

const open = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

useClickOutside(dropdownRef, () => {
  open.value = false
})

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

defineExpose({ open, toggle, close })
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <div @click="toggle">
      <slot name="trigger" />
    </div>

    <div
      v-if="open"
      class="strata-popup absolute top-full z-50 mt-1 py-1"
      :class="[width, align === 'right' ? 'right-0' : 'left-0']"
      @click="close"
    >
      <slot />
    </div>
  </div>
</template>
