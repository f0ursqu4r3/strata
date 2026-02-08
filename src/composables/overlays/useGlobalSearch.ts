import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { searchAllDocs, type SearchResult } from '@/lib/search-index'
import { useDocumentsStore } from '@/stores/documents'
import { useDocStore } from '@/stores/doc'

export type { SearchResult }

export function useGlobalSearch(emit: {
  (e: 'close'): void
  (e: 'navigate', docId: string, nodeId: string): void
}) {
  const docsStore = useDocumentsStore()
  const store = useDocStore()

  const query = ref('')
  const inputRef = ref<HTMLInputElement | null>(null)
  const selectedIdx = ref(0)
  const resultsRef = ref<HTMLElement | null>(null)

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

  const allDocsResults = computed(() => {
    const currentDocId = docsStore.activeId
    const all = searchAllDocs(debouncedQuery.value, docNames.value, 50)
    if (!currentDocId) return all
    return all.filter((r) => r.docId !== currentDocId)
  })

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

  return {
    query,
    debouncedQuery,
    hasQuery,
    hasResults,
    currentDocResults,
    groupedAllDocs,
    flatResults,
    flatIndexOf,
    docNames,
    selectedIdx,
    inputRef,
    resultsRef,
    onSelect,
    highlightMatch,
  }
}
