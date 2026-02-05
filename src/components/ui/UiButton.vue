<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'xs' | 'sm' | 'md'
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'sm',
  disabled: false,
})

const variantClasses: Record<string, string> = {
  primary: 'bg-(--accent-500) text-white hover:bg-(--accent-600)',
  secondary: 'hover:bg-(--bg-hover) text-(--text-secondary)',
  ghost: 'hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-secondary)',
  danger: 'bg-(--color-danger) text-white hover:opacity-90',
}

const sizeClasses: Record<string, string> = {
  xs: 'px-1.5 py-0.5 text-[11px]',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
}
</script>

<template>
  <button
    class="rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    :class="[
      variantClasses[variant],
      sizeClasses[size],
      disabled ? 'cursor-not-allowed' : 'cursor-pointer',
    ]"
    type="button"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>
