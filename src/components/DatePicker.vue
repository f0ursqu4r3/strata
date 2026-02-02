<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: number | null | undefined
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const pickerRef = ref<HTMLElement | null>(null)

const dateString = computed({
  get() {
    if (!props.modelValue) return ''
    return new Date(props.modelValue).toISOString().slice(0, 10)
  },
  set(val: string) {
    if (!val) {
      emit('update:modelValue', null)
    } else {
      // Parse as local date (noon to avoid timezone issues)
      const [y, m, d] = val.split('-').map(Number)
      const date = new Date(y!, m! - 1, d!, 12, 0, 0)
      emit('update:modelValue', date.getTime())
    }
  },
})

function onClear() {
  emit('update:modelValue', null)
}

function onClickOutside(e: MouseEvent) {
  // Parent handles closing
}
</script>

<template>
  <div
    ref="pickerRef"
    class="bg-(--bg-secondary) border border-(--border-secondary) rounded-lg shadow-lg p-2 flex items-center gap-2"
    @click.stop
  >
    <input
      type="date"
      :value="dateString"
      class="text-xs bg-transparent border border-(--border-primary) rounded px-2 py-1 text-(--text-secondary) outline-none focus:border-(--accent-400)"
      @input="dateString = ($event.target as HTMLInputElement).value"
    />
    <button
      v-if="modelValue"
      class="p-0.5 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--color-danger) cursor-pointer"
      title="Clear due date"
      @click="onClear"
    >
      <X class="w-3 h-3" />
    </button>
  </div>
</template>
