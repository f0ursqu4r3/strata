<script setup lang="ts">
interface Props {
  size?: 'xs' | 'sm'
}

withDefaults(defineProps<Props>(), {
  size: 'sm',
})
</script>

<template>
  <kbd
    class="font-mono bg-(--bg-kbd) text-(--text-tertiary) rounded border border-(--border-primary)"
    :class="size === 'xs' ? 'px-1 py-px text-[10px]' : 'px-1.5 py-0.5 text-xs'"
  >
    <slot />
  </kbd>
</template>
