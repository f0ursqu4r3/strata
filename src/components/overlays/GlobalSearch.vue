<script setup lang="ts">
import { Search, X, FileText } from 'lucide-vue-next'
import { useGlobalSearch } from '@/composables/overlays/useGlobalSearch'
import { UiKbd } from '@/components/ui'

const emit = defineEmits<{
  close: []
  navigate: [docId: string, nodeId: string]
}>()

const {
  query,
  hasQuery,
  hasResults,
  currentDocResults,
  groupedAllDocs,
  flatIndexOf,
  selectedIdx,
  inputRef,
  resultsRef,
  onSelect,
  highlightMatch,
} = useGlobalSearch(emit)
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
        <span><UiKbd size="xs">↑↓</UiKbd> navigate</span>
        <span><UiKbd size="xs">Enter</UiKbd> open</span>
        <span><UiKbd size="xs">Esc</UiKbd> close</span>
      </div>
    </div>
  </div>
</template>
