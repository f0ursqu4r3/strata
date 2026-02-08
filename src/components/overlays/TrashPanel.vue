<script setup lang="ts">
import { RotateCcw, Trash2 } from 'lucide-vue-next'
import { useDocStore } from '@/stores/doc'
import { useEscapeKey, UiIconButton } from '@/components/ui'
import { X } from 'lucide-vue-next'
import { getTitle } from '@/lib/text-utils'

const emit = defineEmits<{ close: [] }>()
const store = useDocStore()

useEscapeKey(() => emit('close'))

function onRestore(id: string) {
  store.restoreNode(id)
}

function formatDate(ts: number | undefined): string {
  if (!ts) return 'Unknown'
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex justify-end bg-black/30"
      @mousedown.self="emit('close')"
    >
      <div class="bg-(--bg-secondary) w-full max-w-sm h-full shadow-2xl flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-(--border-primary)">
          <div class="flex items-center gap-2">
            <Trash2 class="w-4 h-4 text-(--text-faint)" />
            <h2 class="text-base font-semibold text-(--text-primary)">Trash</h2>
            <span
              v-if="store.trashedNodes.length > 0"
              class="text-xs text-(--text-faint) bg-(--bg-active) rounded-full px-2 py-0.5"
            >
              {{ store.trashedNodes.length }}
            </span>
          </div>
          <UiIconButton title="Close" @click="emit('close')">
            <X class="w-4 h-4" />
          </UiIconButton>
        </div>

        <!-- Trash list -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="store.trashedNodes.length === 0" class="p-6 text-center text-(--text-faint) text-sm">
            Trash is empty
          </div>
          <div
            v-for="node in store.trashedNodes"
            :key="node.id"
            class="flex items-start gap-3 px-5 py-3 border-b border-(--border-primary) hover:bg-(--bg-hover) group"
          >
            <div class="flex-1 min-w-0">
              <div class="text-sm text-(--text-secondary) truncate">
                {{ getTitle(node.text) || '(empty)' }}
              </div>
              <div class="text-[11px] text-(--text-faint) mt-0.5">
                Deleted {{ formatDate(node.deletedAt) }}
              </div>
            </div>
            <button
              class="shrink-0 p-1.5 rounded hover:bg-(--accent-100) text-(--text-faint) hover:text-(--accent-600) cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
              title="Restore"
              @click="onRestore(node.id)"
            >
              <RotateCcw class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
