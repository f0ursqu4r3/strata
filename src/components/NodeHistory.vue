<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { X, Clock } from 'lucide-vue-next'
import { useDocStore } from '@/stores/doc'
import { isTauri } from '@/lib/platform'
import { useSettingsStore } from '@/stores/settings'
import type { Op } from '@/types'

const props = defineProps<{
  nodeId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useDocStore()
const settings = useSettingsStore()
const ops = ref<Op[]>([])
const loading = ref(true)
const unavailable = ref(false)

function opLabel(op: Op): string {
  const labels: Record<string, string> = {
    create: 'Created',
    updateText: 'Text edited',
    move: 'Moved',
    setStatus: 'Status changed',
    toggleCollapsed: 'Toggled collapse',
    tombstone: 'Deleted',
    addTag: 'Tag added',
    removeTag: 'Tag removed',
    restore: 'Restored',
    setDueDate: 'Due date changed',
  }
  let label = labels[op.type] ?? op.type

  // Add detail for some op types
  const p = op.payload as unknown as Record<string, unknown>
  if (op.type === 'setStatus' && p.status) {
    const def = store.statusDefs.find((s) => s.id === p.status)
    label = `Status → ${def?.label ?? p.status}`
  }
  if (op.type === 'addTag' && p.tag) {
    label = `Tag added: ${p.tag}`
  }
  if (op.type === 'removeTag' && p.tag) {
    label = `Tag removed: ${p.tag}`
  }
  if (op.type === 'updateText' && typeof p.text === 'string') {
    const preview = p.text.length > 40 ? p.text.slice(0, 40) + '...' : p.text
    label = `Text → "${preview}"`
  }
  return label
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

onMounted(async () => {
  // In Tauri file-based mode, ops aren't in IDB
  if (isTauri() && settings.workspacePath) {
    unavailable.value = true
    loading.value = false
    return
  }

  try {
    const { loadOpsForNode } = await import('@/lib/idb')
    const result = await loadOpsForNode(props.nodeId)
    ops.value = result.reverse() // newest first
  } catch {
    unavailable.value = true
  }
  loading.value = false
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
    e.preventDefault()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    role="dialog"
    aria-modal="true"
    aria-label="Node history"
    @mousedown.self="emit('close')"
  >
    <div class="bg-(--bg-secondary) rounded-xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-(--border-primary)">
        <div class="flex items-center gap-2">
          <Clock class="w-4 h-4 text-(--text-faint)" />
          <h2 class="text-base font-semibold text-(--text-primary)">Node History</h2>
        </div>
        <button
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) cursor-pointer"
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-5">
        <div v-if="loading" class="text-center text-sm text-(--text-faint) py-8">
          Loading history...
        </div>

        <div v-else-if="unavailable" class="text-center text-sm text-(--text-faint) py-8">
          History is not available in file-based mode.<br />
          Op-log history is only stored when using browser storage (IndexedDB).
        </div>

        <div v-else-if="ops.length === 0" class="text-center text-sm text-(--text-faint) py-8">
          No history found for this node.
        </div>

        <!-- Timeline -->
        <div v-else class="relative pl-6">
          <!-- Vertical line -->
          <div class="absolute left-2 top-1 bottom-1 w-px bg-(--border-primary)" />

          <div
            v-for="op in ops"
            :key="op.opId"
            class="relative mb-4 last:mb-0"
          >
            <!-- Dot -->
            <div
              class="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 border-(--bg-secondary)"
              :class="op.type === 'create' ? 'bg-(--accent-500)' : 'bg-(--text-faint)'"
            />

            <div class="text-sm text-(--text-secondary)">
              {{ opLabel(op) }}
            </div>
            <div class="text-[11px] text-(--text-faint) mt-0.5">
              {{ formatTime(op.ts) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
