<script setup lang="ts">
import { ref, type Component } from 'vue'
import { useClickOutside } from '@/composables/useClickOutside'

interface Props {
  modelValue: string
  icons: string[]
  resolveIcon: (key: string) => Component
  color?: string
  align?: 'left' | 'right'
}

const props = withDefaults(defineProps<Props>(), {
  color: 'currentColor',
  align: 'left',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const pickerRef = ref<HTMLElement | null>(null)

useClickOutside(pickerRef, () => {
  open.value = false
})

function toggle() {
  open.value = !open.value
}

function select(icon: string) {
  emit('update:modelValue', icon)
  open.value = false
}
</script>

<template>
  <div ref="pickerRef" class="relative shrink-0">
    <button
      type="button"
      class="p-1.5 rounded-md hover:bg-(--bg-hover) cursor-pointer"
      @click="toggle"
    >
      <component
        :is="resolveIcon(modelValue)"
        class="w-4 h-4"
        :style="{ color }"
      />
    </button>
    <div
      v-if="open"
      class="absolute top-full mt-1 z-10 bg-(--bg-secondary) border border-(--border-secondary) rounded-lg shadow-lg p-2 flex gap-1"
      :class="align === 'right' ? 'right-0' : 'left-0'"
    >
      <button
        v-for="icon in icons"
        :key="icon"
        type="button"
        class="p-1.5 rounded-md hover:bg-(--bg-hover) cursor-pointer"
        :class="{ 'bg-(--bg-active)': modelValue === icon }"
        @click="select(icon)"
      >
        <component
          :is="resolveIcon(icon)"
          class="w-4 h-4"
          :style="{ color }"
        />
      </button>
    </div>
  </div>
</template>
