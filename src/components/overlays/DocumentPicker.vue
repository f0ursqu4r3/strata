<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { FileText, X } from 'lucide-vue-next'
import { useDocumentsStore } from '@/stores/documents'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { UiKbd } from '@/components/ui'

const emit = defineEmits<{
  close: []
  select: [docId: string]
}>()

const docsStore = useDocumentsStore()

const dialogRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const resultsRef = ref<HTMLElement | null>(null)
const query = ref('')
const selectedIdx = ref(0)

useFocusTrap(dialogRef)

const filteredDocuments = computed(() => {
  // Exclude the currently active document
  const docs = docsStore.sortedDocuments.filter((d) => d.id !== docsStore.activeId)
  const q = query.value.trim().toLowerCase()
  if (!q) return docs

  return docs
    .filter((d) => d.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const aPrefix = a.name.toLowerCase().startsWith(q)
      const bPrefix = b.name.toLowerCase().startsWith(q)
      if (aPrefix && !bPrefix) return -1
      if (!aPrefix && bPrefix) return 1
      return 0
    })
})

watch(filteredDocuments, () => {
  selectedIdx.value = 0
})

function onSelect(docId: string) {
  emit('select', docId)
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
    e.preventDefault()
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIdx.value < filteredDocuments.value.length - 1) {
      selectedIdx.value++
      scrollSelectedIntoView()
    }
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIdx.value > 0) {
      selectedIdx.value--
      scrollSelectedIntoView()
    }
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const doc = filteredDocuments.value[selectedIdx.value]
    if (doc) onSelect(doc.id)
    return
  }
}

function scrollSelectedIntoView() {
  nextTick(() => {
    const el = resultsRef.value?.querySelector('[data-selected="true"]')
    if (el) el.scrollIntoView({ block: 'nearest' })
  })
}

onMounted(() => {
  nextTick(() => inputRef.value?.focus())
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    ref="dialogRef"
    class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-(--bg-overlay)"
    role="dialog"
    aria-modal="true"
    aria-label="Move to document"
    @mousedown.self="emit('close')"
  >
    <div
      class="overlay-panel bg-(--bg-secondary) rounded-xl shadow-xl w-full max-w-xl flex flex-col max-h-[60vh]"
    >
      <!-- Input -->
      <div class="flex items-center gap-2 px-4 py-3 border-b border-(--border-primary)">
        <FileText class="w-4 h-4 text-(--text-faint) shrink-0" />
        <input
          ref="inputRef"
          v-model="query"
          class="flex-1 bg-transparent text-(--text-primary) text-sm outline-none placeholder:text-(--text-faint)"
          placeholder="Move to document..."
          spellcheck="false"
        />
        <button
          type="button"
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) cursor-pointer"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Results -->
      <div ref="resultsRef" class="overflow-y-auto flex-1 py-1">
        <div
          v-if="filteredDocuments.length === 0"
          class="px-4 py-8 text-center text-sm text-(--text-faint)"
        >
          No matching documents
        </div>
        <button
          type="button"
          v-for="(doc, idx) in filteredDocuments"
          :key="doc.id"
          class="w-full text-left px-4 py-2 text-sm cursor-pointer transition-colors flex items-center gap-2 border-l-2"
          :class="
            idx === selectedIdx
              ? 'bg-(--bg-hover) text-(--text-primary) border-(--accent-500)'
              : 'text-(--text-secondary) hover:bg-(--bg-hover) border-transparent'
          "
          :data-selected="idx === selectedIdx"
          @click="onSelect(doc.id)"
          @mouseenter="selectedIdx = idx"
        >
          <FileText class="w-3.5 h-3.5 text-(--text-faint) shrink-0" />
          <span class="overflow-hidden text-ellipsis whitespace-nowrap">{{ doc.name }}</span>
        </button>
      </div>

      <!-- Footer -->
      <div
        class="px-4 py-2 border-t border-(--border-primary) text-[11px] text-(--text-faint) flex gap-3"
      >
        <span><UiKbd size="xs">↑↓</UiKbd> navigate</span>
        <span><UiKbd size="xs">Enter</UiKbd> move</span>
        <span><UiKbd size="xs">Esc</UiKbd> cancel</span>
      </div>
    </div>
  </div>
</template>
