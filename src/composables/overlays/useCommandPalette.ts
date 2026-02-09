import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useDocStore } from '@/stores/doc'
import { useSettingsStore } from '@/stores/settings'
import { comboToString } from '@/lib/shortcuts'

interface CommandItem {
  id: string
  label: string
  category: string
  shortcut?: string
  execute: () => void
}

export type { CommandItem }

export function useCommandPalette(emit: {
  (e: 'close'): void
  (e: 'openSettings'): void
  (e: 'openDocSettings'): void
  (e: 'openShortcuts'): void
  (e: 'openTrash'): void
  (e: 'openSearch'): void
}) {
  const store = useDocStore()
  const settings = useSettingsStore()

  const query = ref('')
  const inputRef = ref<HTMLInputElement | null>(null)
  const selectedIdx = ref(0)
  const resultsRef = ref<HTMLElement | null>(null)

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
      { id: 'open-doc-settings', label: 'Document Settings', category: 'General', execute: () => emit('openDocSettings') },
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

  return {
    query,
    selectedIdx,
    inputRef,
    resultsRef,
    filteredCommands,
    onExecute,
  }
}
