<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Search, X, FileText } from 'lucide-vue-next'
import { searchAllDocs, type SearchResult } from '@/lib/search-index'
import { useDocumentsStore } from '@/stores/documents'

const emit = defineEmits<{
  close: []
  navigate: [docId: string, nodeId: string]
}>()

const docsStore = useDocumentsStore()
const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const selectedIdx = ref(0)
const resultsRef = ref<HTMLElement | null>(null)

// Build docId → name map from documents store
const docNames = computed(() => {
  const map = new Map<string, string>()
  for (const doc of docsStore.documents) {
    map.set(doc.id, doc.name)
  }
  return map
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null
const debouncedQuery = ref('')

watch(query, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = val
  }, 200)
})

const results = computed(() => {
  return searchAllDocs(debouncedQuery.value, docNames.value, 50)
})

// Group results by docId
const groupedResults = computed(() => {
  const groups: { docId: string; docName: string; items: SearchResult[] }[] = []
  const map = new Map<string, SearchResult[]>()
  for (const r of results.value) {
    let arr = map.get(r.docId)
    if (!arr) {
      arr = []
      map.set(r.docId, arr)
      groups.push({ docId: r.docId, docName: r.docName, items: arr })
    }
    arr.push(r)
  }
  return groups
})

// Flat list for keyboard navigation
const flatResults = computed(() => results.value)

watch(results, () => {
  selectedIdx.value = 0
})

function highlightMatch(text: string, start: number, end: number): string {
  const before = escapeHtml(text.slice(0, start))
  const match = escapeHtml(text.slice(start, end))
  const after = escapeHtml(text.slice(end))
  return `${before}<mark class="bg-(--accent-200) text-(--accent-800) rounded px-0.5">${match}</mark>${after}`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function onSelect(result: SearchResult) {
  emit('navigate', result.docId, result.nodeId)
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
    if (selectedIdx.value < flatResults.value.length - 1) {
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
    const result = flatResults.value[selectedIdx.value]
    if (result) onSelect(result)
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
  if (debounceTimer) clearTimeout(debounceTimer)
})

function resultIndex(result: SearchResult): number {
  return flatResults.value.indexOf(result)
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/30"
    role="dialog"
    aria-modal="true"
    aria-label="Search across documents"
    @mousedown.self="emit('close')"
  >
    <div class="bg-(--bg-secondary) rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[60vh]">
      <!-- Search input -->
      <div class="flex items-center gap-2 px-4 py-3 border-b border-(--border-primary)">
        <Search class="w-4 h-4 text-(--text-faint) shrink-0" />
        <input
          ref="inputRef"
          v-model="query"
          class="flex-1 bg-transparent text-(--text-primary) text-sm outline-none placeholder:text-(--text-faint)"
          placeholder="Search across all documents..."
          spellcheck="false"
        />
        <button
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint)"
          @click="emit('close')"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Results -->
      <div ref="resultsRef" class="overflow-y-auto flex-1">
        <!-- Empty state -->
        <div
          v-if="!debouncedQuery.trim()"
          class="px-4 py-8 text-center text-sm text-(--text-faint)"
        >
          Search across all documents
        </div>

        <!-- No results -->
        <div
          v-else-if="results.length === 0"
          class="px-4 py-8 text-center text-sm text-(--text-faint)"
        >
          No matches found
        </div>

        <!-- Grouped results -->
        <div v-else class="py-1">
          <div v-for="group in groupedResults" :key="group.docId">
            <div class="px-4 py-1.5 text-[11px] font-semibold text-(--text-faint) uppercase tracking-wide flex items-center gap-1.5">
              <FileText class="w-3 h-3" />
              {{ group.docName }}
            </div>
            <button
              v-for="item in group.items"
              :key="item.nodeId"
              class="w-full text-left px-4 py-2 text-sm cursor-pointer transition-colors"
              :class="resultIndex(item) === selectedIdx
                ? 'bg-(--bg-hover) text-(--text-primary)'
                : 'text-(--text-secondary) hover:bg-(--bg-hover)'"
              :data-selected="resultIndex(item) === selectedIdx"
              @click="onSelect(item)"
              @mouseenter="selectedIdx = resultIndex(item)"
            >
              <!-- eslint-disable vue/no-v-html -->
              <div
                class="overflow-hidden text-ellipsis whitespace-nowrap strata-text"
                v-html="highlightMatch(item.text.split('\n')[0]!, item.matchStart, Math.min(item.matchEnd, item.text.split('\n')[0]!.length))"
              />
            </button>
          </div>
        </div>
      </div>

      <!-- Footer hint -->
      <div v-if="results.length > 0" class="px-4 py-2 border-t border-(--border-primary) text-[11px] text-(--text-faint) flex gap-3">
        <span><kbd class="px-1 py-px rounded border border-(--border-primary) font-mono text-[10px]">↑↓</kbd> navigate</span>
        <span><kbd class="px-1 py-px rounded border border-(--border-primary) font-mono text-[10px]">Enter</kbd> open</span>
        <span><kbd class="px-1 py-px rounded border border-(--border-primary) font-mono text-[10px]">Esc</kbd> close</span>
      </div>
    </div>
  </div>
</template>
