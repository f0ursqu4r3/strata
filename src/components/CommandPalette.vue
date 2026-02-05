<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Command, X } from 'lucide-vue-next'
import { useDocStore } from '@/stores/doc'
import { useSettingsStore } from '@/stores/settings'
import { comboToString } from '@/lib/shortcuts'
import { UiKbd } from '@/components/ui'

const emit = defineEmits<{
  close: []
  openSettings: []
  openShortcuts: []
  openTrash: []
  openSearch: []
}>()

const store = useDocStore()
const settings = useSettingsStore()
const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const selectedIdx = ref(0)
const resultsRef = ref<HTMLElement | null>(null)

interface CommandItem {
  id: string
  label: string
  category: string
  shortcut?: string
  execute: () => void
}

const commands = computed<CommandItem[]>(() => {
  const items: CommandItem[] = []

  // View modes
  items.push(
    { id: 'view-outline', label: 'Switch to Outline', category: 'View', execute: () => store.setViewMode('outline') },
    { id: 'view-split', label: 'Switch to Split', category: 'View', execute: () => store.setViewMode('split') },
    { id: 'view-board', label: 'Switch to Board', category: 'View', execute: () => store.setViewMode('board') },
  )

  // Toggles
  items.push(
    { id: 'toggle-sidebar', label: 'Toggle Sidebar', category: 'View', execute: () => settings.setSidebarOpen(!settings.sidebarOpen) },
    { id: 'toggle-tags', label: 'Toggle Tags', category: 'View', execute: () => settings.setShowTags(!settings.showTags) },
  )

  // Panels
  items.push(
    { id: 'open-settings', label: 'Open Settings', category: 'General', execute: () => emit('openSettings') },
    { id: 'open-shortcuts', label: 'Keyboard Shortcuts', category: 'General', execute: () => emit('openShortcuts') },
    { id: 'open-trash', label: 'Open Trash', category: 'General', execute: () => emit('openTrash') },
    { id: 'open-search', label: 'Search All Documents', category: 'General', execute: () => emit('openSearch') },
  )

  // General actions with shortcut display
  const shortcutMap = new Map(settings.resolvedShortcuts.map((s) => [s.action, comboToString(s.combo)]))
  items.push(
    { id: 'undo', label: 'Undo', category: 'Edit', shortcut: shortcutMap.get('undo'), execute: () => { store.flushTextDebounce(); store.undo() } },
    { id: 'redo', label: 'Redo', category: 'Edit', shortcut: shortcutMap.get('redo'), execute: () => { store.flushTextDebounce(); store.redo() } },
  )

  // Node operations (only when a node is selected)
  if (store.selectedId) {
    items.push(
      { id: 'zoom-in', label: 'Zoom Into Node', category: 'Node', shortcut: shortcutMap.get('zoomIn'), execute: () => store.zoomIn(store.selectedId) },
      { id: 'zoom-out', label: 'Zoom Out', category: 'Node', shortcut: shortcutMap.get('zoomOut'), execute: () => store.zoomOut() },
      { id: 'duplicate', label: 'Duplicate Node', category: 'Node', execute: () => store.duplicateNode(store.selectedId) },
      { id: 'delete', label: 'Delete Node', category: 'Node', shortcut: shortcutMap.get('delete'), execute: () => store.tombstone(store.selectedId) },
      { id: 'toggle-collapse', label: 'Toggle Collapse', category: 'Node', shortcut: shortcutMap.get('toggleCollapse'), execute: () => {
        const node = store.nodes.get(store.selectedId)
        if (node && store.getChildren(node.id).length > 0) store.toggleCollapsed(node.id)
      }},
    )

    // Status changes
    for (const s of store.statusDefs) {
      items.push({
        id: `status-${s.id}`,
        label: `Set Status: ${s.label}`,
        category: 'Status',
        execute: () => store.setStatus(store.selectedId, s.id),
      })
    }
  }

  return items
})

const filteredCommands = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return commands.value

  return commands.value
    .filter((cmd) => cmd.label.toLowerCase().includes(q) || cmd.category.toLowerCase().includes(q))
    .sort((a, b) => {
      const aLabel = a.label.toLowerCase()
      const bLabel = b.label.toLowerCase()
      const aPrefix = aLabel.startsWith(q)
      const bPrefix = bLabel.startsWith(q)
      if (aPrefix && !bPrefix) return -1
      if (!aPrefix && bPrefix) return 1
      return 0
    })
})

watch(filteredCommands, () => {
  selectedIdx.value = 0
})

function onExecute(cmd: CommandItem) {
  emit('close')
  cmd.execute()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
    e.preventDefault()
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIdx.value < filteredCommands.value.length - 1) {
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
    const cmd = filteredCommands.value[selectedIdx.value]
    if (cmd) onExecute(cmd)
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
