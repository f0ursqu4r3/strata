<script setup lang="ts">
interface Props {
  modelValue: boolean
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <button
    class="relative w-9 h-5 rounded-full transition-colors shrink-0"
    :class="[
      modelValue ? 'bg-(--accent-500)' : 'bg-(--bg-active)',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    ]"
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    @click="!disabled && emit('update:modelValue', !modelValue)"
  >
    <span
      class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
      :class="{ 'translate-x-4': modelValue }"
    />
  </button>
</template>
