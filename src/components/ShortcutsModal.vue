<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { X, Settings2 } from 'lucide-vue-next'
import { useDocStore } from '@/stores/doc'
import { useSettingsStore } from '@/stores/settings'
import { comboToString } from '@/lib/shortcuts'

const emit = defineEmits<{ close: []; customize: [] }>()
const store = useDocStore()
const settings = useSettingsStore()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' || e.key === '?') {
    emit('close')
    e.preventDefault()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

const sections = computed(() => {
  // Build sections from resolved shortcuts grouped by category
  const catMap = new Map<string, { keys: string[]; desc: string }[]>()
  const order: string[] = []

  for (const def of settings.resolvedShortcuts) {
    if (!catMap.has(def.category)) {
      catMap.set(def.category, [])
      order.push(def.category)
    }
    catMap.get(def.category)!.push({
      keys: [comboToString(def.combo)],
      desc: def.label,
    })
  }

  const result = order.map((cat) => ({ title: cat, shortcuts: catMap.get(cat)! }))

  // Add status shortcuts (dynamic, not part of shortcut system)
  result.push({
    title: 'Status',
    shortcuts: store.statusDefs.map((s, i) => ({
      keys: ['Ctrl+' + String(i + 1)],
      desc: `Set ${s.label}`,
    })),
  })

  return result
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" @mousedown.self="emit('close')">
    <div class="bg-(--bg-secondary) rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
      <div class="flex items-center justify-between px-5 py-4 border-b border-(--border-primary)">
        <h2 class="text-base font-semibold text-(--text-primary)">Keyboard Shortcuts</h2>
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1 text-[11px] text-(--text-faint) hover:text-(--text-secondary) px-2 py-1 rounded hover:bg-(--bg-hover) cursor-pointer"
            @click="emit('customize')"
          >
            <Settings2 class="w-3 h-3" />
            Customize
          </button>
          <button
            class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) cursor-pointer"
            @click="emit('close')"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
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
