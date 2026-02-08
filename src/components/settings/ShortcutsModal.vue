<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { Settings2 } from 'lucide-vue-next'
import { useDocStore } from '@/stores/doc'
import { useSettingsStore } from '@/stores/settings'
import { comboToString } from '@/lib/shortcuts'
import { UiModal, UiKbd, UiButton } from '@/components/ui'

const emit = defineEmits<{ close: []; customize: [] }>()
const store = useDocStore()
const settings = useSettingsStore()

// Also close on '?' key (UiModal handles Escape)
function onKeydown(e: KeyboardEvent) {
  if (e.key === '?') {
    emit('close')
    e.preventDefault()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

interface ShortcutEntry {
  keys: string[]
  desc: string
}

interface Section {
  title: string
  shortcuts: ShortcutEntry[]
}

const sections = computed(() => {
  const catMap = new Map<string, ShortcutEntry[]>()
  const order: string[] = []
  const seen = new Set<string>()

  for (const def of settings.resolvedShortcuts) {
    const combo = comboToString(def.combo)
    const dedup = `${def.category}::${def.label}::${combo}`
    if (seen.has(dedup)) continue
    seen.add(dedup)

    if (!catMap.has(def.category)) {
      catMap.set(def.category, [])
      order.push(def.category)
    }
    catMap.get(def.category)!.push({ keys: [combo], desc: def.label })
  }

  // Add non-customizable general shortcuts
  const general = catMap.get('General')
  if (general) {
    general.push({ keys: ['?'], desc: 'Show keyboard shortcuts' })
  }

  // Add non-customizable navigation shortcuts
  const nav = catMap.get('Navigation')
  if (nav) {
    nav.push({ keys: ['Esc'], desc: 'Deselect / clear selection' })
  }

  const result: Section[] = order.map((cat) => ({ title: cat, shortcuts: catMap.get(cat)! }))

  // Editing context tips
  result.push({
    title: 'While Editing',
    shortcuts: [
      { keys: ['Enter'], desc: 'Move to note body (from title)' },
      { keys: ['Backspace'], desc: 'Delete empty node' },
      { keys: ['↑', '↓'], desc: 'Navigate between nodes' },
    ],
  })

  // Status shortcuts
  result.push({
    title: 'Status',
    shortcuts: store.statusDefs.map((s, i) => ({
      keys: ['Ctrl+' + String(i + 1)],
      desc: `Set ${s.label}`,
    })),
  })

  // Selection
  result.push({
    title: 'Selection',
    shortcuts: [
      { keys: ['Shift+Click'], desc: 'Range select' },
      { keys: ['Ctrl+Click'], desc: 'Toggle select' },
      { keys: ['Double-click'], desc: 'Edit node' },
    ],
  })

  // Vim mode (only when enabled)
  if (settings.vimMode) {
    result.push({
      title: 'Vim Mode',
      shortcuts: [
        { keys: ['j', 'k'], desc: 'Move down / up' },
        { keys: ['i'], desc: 'Start editing' },
        { keys: ['o'], desc: 'New sibling and edit' },
        { keys: ['dd'], desc: 'Delete node' },
        { keys: ['gg'], desc: 'Go to first node' },
        { keys: ['G'], desc: 'Go to last node' },
        { keys: ['zc', 'zo'], desc: 'Collapse / expand' },
        { keys: ['/'], desc: 'Search' },
      ],
    })
  }

  return result
})
</script>

<template>
  <UiModal title="Keyboard Shortcuts" max-width="lg" @close="emit('close')">
    <template #header-actions>
      <UiButton variant="ghost" size="xs" @click="emit('customize')">
        <Settings2 class="w-3 h-3" />
        Customize
      </UiButton>
    </template>

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
              <UiKbd v-for="k in s.keys" :key="k">{{ k }}</UiKbd>
            </span>
          </div>
        </div>
      </div>
    </div>
  </UiModal>
</template>
