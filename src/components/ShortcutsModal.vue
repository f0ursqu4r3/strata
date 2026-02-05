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

const sections = computed(() => {
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
