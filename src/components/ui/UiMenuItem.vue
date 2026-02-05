<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  icon?: Component
  shortcut?: string
  danger?: boolean
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  danger: false,
  disabled: false,
})
</script>

<template>
  <button
    class="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors disabled:opacity-50"
    :class="[
      danger
        ? 'hover:bg-(--color-danger-bg) text-(--color-danger)'
        : 'hover:bg-(--bg-hover) text-(--text-secondary)',
      disabled ? 'cursor-not-allowed' : 'cursor-pointer',
    ]"
    type="button"
    role="menuitem"
    :disabled="disabled"
  >
    <component
      v-if="icon"
      :is="icon"
      class="w-3.5 h-3.5 shrink-0"
      :class="danger ? '' : 'text-(--text-faint)'"
    />
    <slot name="icon" v-else />
    <span class="flex-1 truncate"><slot /></span>
    <span v-if="shortcut" class="text-[11px] text-(--text-faint) font-mono shrink-0">
      {{ shortcut }}
    </span>
  </button>
</template>
