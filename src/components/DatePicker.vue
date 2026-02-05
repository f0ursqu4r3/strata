<script setup lang="ts">
import { computed } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: number | null | undefined
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

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

function getDateAtNoon(daysFromNow: number): number {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  date.setHours(12, 0, 0, 0)
  return date.getTime()
}

function setToday() {
  emit('update:modelValue', getDateAtNoon(0))
}

function setTomorrow() {
  emit('update:modelValue', getDateAtNoon(1))
}

function setNextWeek() {
  emit('update:modelValue', getDateAtNoon(7))
}

function onClear() {
  emit('update:modelValue', null)
}
</script>

<template>
  <div
    class="bg-(--bg-secondary) border border-(--border-secondary) rounded-lg shadow-lg p-2 min-w-48"
    @click.stop
  >
    <!-- Quick presets -->
    <div class="flex gap-1 mb-2">
      <button
        class="flex-1 px-2 py-1 text-[11px] rounded hover:bg-(--bg-hover) text-(--text-secondary) cursor-pointer transition-colors"
        @click="setToday"
      >
        Today
      </button>
      <button
        class="flex-1 px-2 py-1 text-[11px] rounded hover:bg-(--bg-hover) text-(--text-secondary) cursor-pointer transition-colors"
        @click="setTomorrow"
      >
        Tomorrow
      </button>
      <button
        class="flex-1 px-2 py-1 text-[11px] rounded hover:bg-(--bg-hover) text-(--text-secondary) cursor-pointer transition-colors"
        @click="setNextWeek"
      >
        Next week
      </button>
    </div>

    <!-- Date input row -->
    <div class="flex items-center gap-2">
      <input
        type="date"
        :value="dateString"
        class="flex-1 text-xs bg-transparent border border-(--border-primary) rounded px-2 py-1 text-(--text-secondary) outline-none focus:border-(--accent-400)"
        @input="dateString = ($event.target as HTMLInputElement).value"
      />
      <button
        v-if="modelValue"
        class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--color-danger) cursor-pointer"
        title="Clear due date"
        @click="onClear"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>
