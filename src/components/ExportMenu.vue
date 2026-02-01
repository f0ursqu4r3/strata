<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Download } from 'lucide-vue-next'
import { useDocStore } from '@/stores/doc'

const store = useDocStore()
const open = ref(false)
const menuRef = ref<HTMLDivElement | null>(null)

type ExportFormat = 'json' | 'markdown' | 'opml' | 'plaintext'

const formats: { key: ExportFormat; label: string }[] = [
  { key: 'json', label: 'JSON' },
  { key: 'markdown', label: 'Markdown' },
  { key: 'opml', label: 'OPML' },
  { key: 'plaintext', label: 'Plain Text' },
]

function onExport(format: ExportFormat) {
  store.downloadExport(format)
  open.value = false
}

function onClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as HTMLElement)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div ref="menuRef" class="relative">
    <button
      class="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer"
      title="Export"
      @click="open = !open"
    >
      <Download class="w-4 h-4" />
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-full z-50 mt-1 w-36 bg-(--bg-secondary) border border-(--border-primary) rounded-lg shadow-lg py-1"
    >
      <button
        v-for="f in formats"
        :key="f.key"
        class="w-full text-left px-3 py-1.5 text-[13px] text-(--text-secondary) hover:bg-(--bg-hover) cursor-pointer"
        @click="onExport(f.key)"
      >
        {{ f.label }}
      </button>
    </div>
  </div>
</template>
