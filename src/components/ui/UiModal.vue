<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { useEscapeKey } from '@/composables/useEscapeKey'

interface Props {
  title?: string
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showClose?: boolean
}

withDefaults(defineProps<Props>(), {
  maxWidth: 'md',
  showClose: true,
})

const emit = defineEmits<{
  close: []
}>()

useEscapeKey(() => emit('close'))

const maxWidthClasses: Record<string, string> = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      role="dialog"
      aria-modal="true"
      @mousedown.self="emit('close')"
    >
      <div
        class="bg-(--bg-secondary) rounded-xl shadow-2xl w-full max-h-[80vh] flex flex-col"
        :class="maxWidthClasses[maxWidth]"
      >
        <!-- Header -->
        <div
          v-if="title || $slots.header || showClose"
          class="flex items-center justify-between px-5 py-4 border-b border-(--border-primary) shrink-0"
        >
          <slot name="header">
            <h2 v-if="title" class="text-base font-semibold text-(--text-primary)">
              {{ title }}
            </h2>
          </slot>
          <div class="flex items-center gap-2">
            <slot name="header-actions" />
            <button
              v-if="showClose"
              class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) cursor-pointer"
              @click="emit('close')"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto">
          <slot />
        </div>

        <!-- Footer -->
        <div
          v-if="$slots.footer"
          class="px-5 py-3 border-t border-(--border-primary) shrink-0"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
