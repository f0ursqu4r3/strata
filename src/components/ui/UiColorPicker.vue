<script setup lang="ts">
import { ref } from 'vue'
import { useClickOutside } from '@/composables/useClickOutside'

interface Props {
  modelValue: string
  colors: string[]
  align?: 'left' | 'right'
}

const props = withDefaults(defineProps<Props>(), {
  align: 'right',
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

function select(color: string) {
  emit('update:modelValue', color)
  open.value = false
}
</script>

<template>
  <div ref="pickerRef" class="relative shrink-0">
    <button
      type="button"
      class="w-5 h-5 rounded-full border-2 border-(--border-primary) cursor-pointer"
      :style="{ backgroundColor: modelValue }"
      @click="toggle"
    />
    <div
      v-if="open"
      class="strata-popup absolute top-full mt-1 z-10 p-2 grid grid-cols-4 gap-1 w-max"
      :class="align === 'right' ? 'right-0' : 'left-0'"
    >
      <button
        v-for="color in colors"
        :key="color"
        type="button"
        class="w-6 h-6 rounded-full cursor-pointer border-2 transition-transform hover:scale-110"
        :class="modelValue === color ? 'border-(--text-primary)' : 'border-transparent'"
        :style="{ backgroundColor: color }"
        @click="select(color)"
      />
    </div>
  </div>
</template>
