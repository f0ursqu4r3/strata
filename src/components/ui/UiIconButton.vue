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
  sm: 'p-0.5 min-w-6 min-h-6 flex items-center justify-center',
  md: 'p-1 min-w-7 min-h-7 flex items-center justify-center',
}
</script>

<template>
  <button
    class="rounded transition-[colors,transform] disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
    :class="[
      variantClasses[variant],
      sizeClasses[size],
      disabled ? 'cursor-not-allowed' : 'cursor-pointer',
    ]"
    type="button"
    :title="title"
    :aria-label="title"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>
