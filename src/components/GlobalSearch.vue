<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Search, X, FileText } from 'lucide-vue-next'
import { searchAllDocs, type SearchResult } from '@/lib/search-index'
import { useDocumentsStore } from '@/stores/documents'
import { useDocStore } from '@/stores/doc'

const emit = defineEmits<{
  close: []
  navigate: [docId: string, nodeId: string]
}>()

const docsStore = useDocumentsStore()
const store = useDocStore()
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

// Current document results — search nodes directly
const currentDocResults = computed(() => {
  const q = debouncedQuery.value.trim().toLowerCase()
  if (!q) return [] as SearchResult[]
  const results: SearchResult[] = []
  const currentDocId = docsStore.activeId
  if (!currentDocId) return results
  const currentDocName = docNames.value.get(currentDocId) ?? 'Current Document'
  for (const node of store.nodes.values()) {
    if (node.deleted || node.parentId === null) continue
    const lower = node.text.toLowerCase()
    const idx = lower.indexOf(q)
    if (idx === -1) continue
    results.push({
      docId: currentDocId,
      docName: currentDocName,
      nodeId: node.id,
      text: node.text,
      matchStart: idx,
      matchEnd: idx + q.length,
    })
    if (results.length >= 20) break
  }
  return results
})

// All documents results — exclude current doc
const allDocsResults = computed(() => {
  const currentDocId = docsStore.activeId
  const all = searchAllDocs(debouncedQuery.value, docNames.value, 50)
  if (!currentDocId) return all
  return all.filter((r) => r.docId !== currentDocId)
})

// Group cross-doc results by docId
const groupedAllDocs = computed(() => {
  const groups: { docId: string; docName: string; items: SearchResult[] }[] = []
  const map = new Map<string, SearchResult[]>()
  for (const r of allDocsResults.value) {
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

// Flat list for keyboard navigation: current doc results first, then all docs
const flatResults = computed(() => [...currentDocResults.value, ...allDocsResults.value])

const hasResults = computed(() => flatResults.value.length > 0)
const hasQuery = computed(() => !!debouncedQuery.value.trim())

watch(flatResults, () => {
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

function flatIndexOf(result: SearchResult): number {
  return flatResults.value.indexOf(result)
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
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/30"
    role="dialog"
    aria-modal="true"
    aria-label="Search"
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
          placeholder="Search..."
          spellcheck="false"
        />
        <button
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) cursor-pointer"
          @click="emit('close')"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Results -->
      <div ref="resultsRef" class="overflow-y-auto flex-1">
        <!-- Empty state -->
        <div
          v-if="!hasQuery"
          class="px-4 py-8 text-center text-sm text-(--text-faint)"
        >
          Search current document and all documents
        </div>

        <!-- No results -->
        <div
          v-else-if="!hasResults"
          class="px-4 py-8 text-center text-sm text-(--text-faint)"
        >
          No matches found
        </div>

        <div v-else class="py-1">
          <!-- Current document section -->
          <template v-if="currentDocResults.length > 0">
            <div class="px-4 py-1.5 text-[11px] font-semibold text-(--text-faint) uppercase tracking-wide">
              Current Document
            </div>
            <button
              v-for="item in currentDocResults"
              :key="'cur-' + item.nodeId"
              class="w-full text-left px-4 py-2 text-sm cursor-pointer transition-colors"
              :class="flatIndexOf(item) === selectedIdx
                ? 'bg-(--bg-hover) text-(--text-primary)'
                : 'text-(--text-secondary) hover:bg-(--bg-hover)'"
              :data-selected="flatIndexOf(item) === selectedIdx"
              @click="onSelect(item)"
              @mouseenter="selectedIdx = flatIndexOf(item)"
            >
              <!-- eslint-disable vue/no-v-html -->
              <div
                class="overflow-hidden text-ellipsis whitespace-nowrap strata-text"
                v-html="highlightMatch(item.text.split('\n')[0]!, item.matchStart, Math.min(item.matchEnd, item.text.split('\n')[0]!.length))"
              />
            </button>
          </template>

          <!-- All documents section -->
          <template v-if="groupedAllDocs.length > 0">
            <div class="px-4 py-1.5 text-[11px] font-semibold text-(--text-faint) uppercase tracking-wide" :class="currentDocResults.length > 0 ? 'mt-2 border-t border-(--border-primary) pt-2' : ''">
              All Documents
            </div>
            <div v-for="group in groupedAllDocs" :key="group.docId">
              <div class="px-4 py-1 text-[11px] text-(--text-faint) flex items-center gap-1.5">
                <FileText class="w-3 h-3" />
                {{ group.docName }}
              </div>
              <button
                v-for="item in group.items"
                :key="item.nodeId"
                class="w-full text-left px-4 py-2 text-sm cursor-pointer transition-colors"
                :class="flatIndexOf(item) === selectedIdx
                  ? 'bg-(--bg-hover) text-(--text-primary)'
                  : 'text-(--text-secondary) hover:bg-(--bg-hover)'"
                :data-selected="flatIndexOf(item) === selectedIdx"
                @click="onSelect(item)"
                @mouseenter="selectedIdx = flatIndexOf(item)"
              >
                <!-- eslint-disable vue/no-v-html -->
                <div
                  class="overflow-hidden text-ellipsis whitespace-nowrap strata-text"
                  v-html="highlightMatch(item.text.split('\n')[0]!, item.matchStart, Math.min(item.matchEnd, item.text.split('\n')[0]!.length))"
                />
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- Footer hint -->
      <div v-if="hasResults" class="px-4 py-2 border-t border-(--border-primary) text-[11px] text-(--text-faint) flex gap-3">
        <span><kbd class="px-1 py-px rounded border border-(--border-primary) font-mono text-[10px]">↑↓</kbd> navigate</span>
        <span><kbd class="px-1 py-px rounded border border-(--border-primary) font-mono text-[10px]">Enter</kbd> open</span>
        <span><kbd class="px-1 py-px rounded border border-(--border-primary) font-mono text-[10px]">Esc</kbd> close</span>
      </div>
    </div>
  </div>
</template>
