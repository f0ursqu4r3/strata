<script setup lang="ts">
interface Props {
  variant?: 'default' | 'danger'
  size?: 'sm' | 'md'
  title?: string
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'md',
  disabled: false,
})

const variantClasses: Record<string, string> = {
  default: 'hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-secondary)',
  danger: 'hover:bg-(--color-danger-bg) text-(--text-faint) hover:text-(--color-danger)',
}

const sizeClasses: Record<string, string> = {
  sm: 'p-0.5',
  md: 'p-1',
}
</script>

<template>
  <button
    class="rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
    :class="[
      variantClasses[variant],
      sizeClasses[size],
      disabled ? 'cursor-not-allowed' : 'cursor-pointer',
    ]"
    type="button"
    :title="title"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>
