import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import {
  comboToString,
  findConflicts,
  DEFAULT_SHORTCUTS,
  type ShortcutAction,
  type KeyCombo,
} from '@/lib/shortcuts'

export function useShortcutCapture() {
  const settings = useSettingsStore()

  const editingAction = ref<ShortcutAction | null>(null)
  const capturedCombo = ref<KeyCombo | null>(null)

  const categories = computed(() => {
    const cats: { name: string; defs: typeof settings.resolvedShortcuts }[] = []
    const catMap = new Map<string, typeof settings.resolvedShortcuts>()
    for (const def of settings.resolvedShortcuts) {
      let arr = catMap.get(def.category)
      if (!arr) {
        arr = []
        catMap.set(def.category, arr)
        cats.push({ name: def.category, defs: arr })
      }
      arr.push(def)
    }
    return cats
  })

  const conflicts = computed(() => {
    if (!editingAction.value || !capturedCombo.value) return []
    const def = settings.resolvedShortcuts.find((s) => s.action === editingAction.value)
    if (!def) return []
    return findConflicts(settings.resolvedShortcuts, capturedCombo.value, def.context, editingAction.value)
  })

  function isCustomized(action: ShortcutAction): boolean {
    const defaultDef = DEFAULT_SHORTCUTS.find((s) => s.action === action)
    const resolved = settings.resolvedShortcuts.find((s) => s.action === action)
    if (!defaultDef || !resolved) return false
    return comboToString(defaultDef.combo) !== comboToString(resolved.combo)
  }

  function startCapture(action: ShortcutAction) {
    editingAction.value = action
    capturedCombo.value = null
  }

  function cancelCapture() {
    editingAction.value = null
    capturedCombo.value = null
  }

  function confirmCapture() {
    if (editingAction.value && capturedCombo.value && conflicts.value.length === 0) {
      settings.updateShortcut(editingAction.value, capturedCombo.value)
    }
    editingAction.value = null
    capturedCombo.value = null
  }

  function resetOne(action: ShortcutAction) {
    settings.resetShortcut(action)
  }

  function resetAll() {
    settings.resetAllShortcuts()
  }

  function onKeydown(e: KeyboardEvent) {
    if (editingAction.value) {
      e.preventDefault()
      e.stopPropagation()
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return
      capturedCombo.value = {
        key: e.key,
        ctrl: e.ctrlKey || e.metaKey || undefined,
        shift: e.shiftKey || undefined,
        alt: e.altKey || undefined,
      }
      if (!capturedCombo.value.ctrl) delete capturedCombo.value.ctrl
      if (!capturedCombo.value.shift) delete capturedCombo.value.shift
      if (!capturedCombo.value.alt) delete capturedCombo.value.alt
    }
  }

  onMounted(() => document.addEventListener('keydown', onKeydown, true))
  onUnmounted(() => document.removeEventListener('keydown', onKeydown, true))

  return {
    editingAction,
    capturedCombo,
    categories,
    conflicts,
    isCustomized,
    startCapture,
    cancelCapture,
    confirmCapture,
    resetOne,
    resetAll,
  }
}
