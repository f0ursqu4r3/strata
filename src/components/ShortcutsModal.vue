<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'
import { useDocStore } from '@/stores/doc'

const emit = defineEmits<{ close: [] }>()
const store = useDocStore()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' || e.key === '?') {
    emit('close')
    e.preventDefault()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

const sections = computed(() => [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['↑', '↓'], desc: 'Move selection' },
      { keys: ['Enter'], desc: 'Start editing selected node' },
      { keys: ['Escape'], desc: 'Stop editing' },
      { keys: ['Space'], desc: 'Toggle collapse' },
      { keys: ['Double-click bullet'], desc: 'Zoom into node' },
    ],
  },
  {
    title: 'Editing',
    shortcuts: [
      { keys: ['Shift', 'Enter'], desc: 'Create sibling below (while editing)' },
      { keys: ['Tab'], desc: 'Indent node' },
      { keys: ['Shift', 'Tab'], desc: 'Outdent node' },
      { keys: ['Delete'], desc: 'Delete node' },
    ],
  },
  {
    title: 'Status',
    shortcuts: store.statusDefs.map((s, i) => ({
      keys: ['Ctrl', String(i + 1)],
      desc: `Set ${s.label}`,
    })),
  },
  {
    title: 'General',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], desc: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], desc: 'Redo' },
      { keys: ['?'], desc: 'Toggle this panel' },
    ],
  },
])
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" @mousedown.self="emit('close')">
    <div class="bg-(--bg-secondary) rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
      <div class="flex items-center justify-between px-5 py-4 border-b border-(--border-primary)">
        <h2 class="text-base font-semibold text-(--text-primary)">Keyboard Shortcuts</h2>
        <button
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint)"
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="p-5 space-y-5">
        <div v-for="section in sections" :key="section.title">
          <h3 class="text-xs font-semibold text-(--text-faint) uppercase tracking-wide mb-2">
            {{ section.title }}
          </h3>
          <div class="space-y-1.5">
            <div
              v-for="(s, i) in section.shortcuts"
              :key="i"
              class="flex items-center justify-between py-1"
            >
              <span class="text-sm text-(--text-tertiary)">{{ s.desc }}</span>
              <span class="flex gap-1">
                <kbd
                  v-for="k in s.keys"
                  :key="k"
                  class="px-1.5 py-0.5 text-xs font-mono bg-(--bg-kbd) text-(--text-tertiary) rounded border border-(--border-primary)"
                >
                  {{ k }}
                </kbd>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
