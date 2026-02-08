<script setup lang="ts">
import { Command, X } from 'lucide-vue-next'
import { useCommandPalette } from '@/composables/overlays/useCommandPalette'
import { UiKbd } from '@/components/ui'

const emit = defineEmits<{
  close: []
  openSettings: []
  openShortcuts: []
  openTrash: []
  openSearch: []
}>()

const {
  query,
  selectedIdx,
  inputRef,
  resultsRef,
  filteredCommands,
  onExecute,
} = useCommandPalette(emit)
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/30"
    role="dialog"
    aria-modal="true"
    aria-label="Command palette"
    @mousedown.self="emit('close')"
  >
    <div class="bg-(--bg-secondary) rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[60vh]">
      <!-- Input -->
      <div class="flex items-center gap-2 px-4 py-3 border-b border-(--border-primary)">
        <Command class="w-4 h-4 text-(--text-faint) shrink-0" />
        <input
          ref="inputRef"
          v-model="query"
          class="flex-1 bg-transparent text-(--text-primary) text-sm outline-none placeholder:text-(--text-faint)"
          placeholder="Type a command..."
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
      <div ref="resultsRef" class="overflow-y-auto flex-1 py-1">
        <div
          v-if="filteredCommands.length === 0"
          class="px-4 py-8 text-center text-sm text-(--text-faint)"
        >
          No matching commands
        </div>
        <button
          v-for="(cmd, idx) in filteredCommands"
          :key="cmd.id"
          class="w-full text-left px-4 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between gap-2"
          :class="idx === selectedIdx
            ? 'bg-(--bg-hover) text-(--text-primary)'
            : 'text-(--text-secondary) hover:bg-(--bg-hover)'"
          :data-selected="idx === selectedIdx"
          @click="onExecute(cmd)"
          @mouseenter="selectedIdx = idx"
        >
          <span class="overflow-hidden text-ellipsis whitespace-nowrap">{{ cmd.label }}</span>
          <UiKbd v-if="cmd.shortcut" size="xs">{{ cmd.shortcut }}</UiKbd>
        </button>
      </div>

      <!-- Footer -->
      <div class="px-4 py-2 border-t border-(--border-primary) text-[11px] text-(--text-faint) flex gap-3">
        <span><UiKbd size="xs">↑↓</UiKbd> navigate</span>
        <span><UiKbd size="xs">Enter</UiKbd> run</span>
        <span><UiKbd size="xs">Esc</UiKbd> close</span>
      </div>
    </div>
  </div>
</template>
