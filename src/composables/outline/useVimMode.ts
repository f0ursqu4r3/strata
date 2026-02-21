import { useDocStore } from '@/stores/doc'
import { useSettingsStore } from '@/stores/settings'
import { rankBetween, rankAfter } from '@/lib/rank'

export function useVimMode(
  emit: (event: 'openSearch') => void,
  scrollSelectedIntoView: () => void,
) {
  const store = useDocStore()
  const settings = useSettingsStore()

  let vimPendingKey = ''
  let vimPendingTimer: ReturnType<typeof setTimeout> | null = null

  function clearVimPending() {
    vimPendingKey = ''
    if (vimPendingTimer) {
      clearTimeout(vimPendingTimer)
      vimPendingTimer = null
    }
  }

  function handleVimKey(e: KeyboardEvent): boolean {
    if (!settings.vimMode || store.editing.id) return false
    if (e.ctrlKey || e.metaKey || e.altKey) return false

    const key = e.key

    // Two-key combos
    if (vimPendingKey) {
      const combo = vimPendingKey + key
      clearVimPending()

      if (combo === 'dd' && store.selection.current) {
        const rows = store.visibleRows
        const idx = rows.findIndex((r) => r.node.id === store.selection.current)
        const nextId = rows[idx + 1]?.node.id ?? rows[idx - 1]?.node.id ?? null
        store.tombstone(store.selection.current)
        if (nextId) store.selectNode(nextId)
        e.preventDefault()
        return true
      }
      if (combo === 'gg') {
        const rows = store.visibleRows
        if (rows.length > 0) {
          store.selectNode(rows[0]!.node.id)
          scrollSelectedIntoView()
        }
        e.preventDefault()
        return true
      }
      if (combo === 'zc' && store.selection.current) {
        const node = store.nodes.get(store.selection.current)
        if (node && store.getChildren(node.id).length > 0 && !node.collapsed) {
          store.toggleCollapsed(node.id)
        }
        e.preventDefault()
        return true
      }
      if (combo === 'zo' && store.selection.current) {
        const node = store.nodes.get(store.selection.current)
        if (node && node.collapsed) {
          store.toggleCollapsed(node.id)
        }
        e.preventDefault()
        return true
      }
      return false
    }

    // Start two-key sequences
    if (key === 'd' || key === 'g' || key === 'z') {
      vimPendingKey = key
      vimPendingTimer = setTimeout(clearVimPending, 500)
      e.preventDefault()
      return true
    }

    // Single keys
    if (key === 'j') {
      store.moveSelectionDown()
      scrollSelectedIntoView()
      e.preventDefault()
      return true
    }
    if (key === 'k') {
      store.moveSelectionUp()
      scrollSelectedIntoView()
      e.preventDefault()
      return true
    }
    if (key === 'i') {
      if (store.selection.current) {
        store.startEditing(store.selection.current, 'keyboard')
        e.preventDefault()
      }
      return true
    }
    if (key === 'o') {
      if (store.selection.current) {
        const node = store.nodes.get(store.selection.current)
        if (node) {
          const siblings = store.getChildren(node.parentId!)
          const idx = siblings.findIndex((s) => s.id === node.id)
          const next = siblings[idx + 1]
          const pos = next ? rankBetween(node.pos, next.pos) : rankAfter(node.pos)
          const op = store.createNode(node.parentId!, pos)
          const newId = (op.payload as { id: string }).id
          store.selectNode(newId)
          store.startEditing(newId, 'keyboard')
          e.preventDefault()
        }
      }
      return true
    }
    if (key === 'G') {
      const rows = store.visibleRows
      if (rows.length > 0) {
        store.selectNode(rows[rows.length - 1]!.node.id)
        scrollSelectedIntoView()
      }
      e.preventDefault()
      return true
    }
    if (key === '/') {
      emit('openSearch')
      e.preventDefault()
      return true
    }

    return false
  }

  return { handleVimKey }
}
