import { onMounted, onUnmounted, type Ref } from 'vue'
import { useDocStore } from '@/stores/doc'
import { useSettingsStore } from '@/stores/settings'
import { matchesCombo, type ShortcutDef } from '@/lib/shortcuts'

export interface GlobalKeyboardOptions {
  showShortcuts: Ref<boolean>
  showGlobalSearch: Ref<boolean>
  showCommandPalette: Ref<boolean>
}

export function useGlobalKeyboard(options: GlobalKeyboardOptions) {
  const store = useDocStore()
  const settings = useSettingsStore()

  const { showShortcuts, showGlobalSearch, showCommandPalette } = options

  function onGlobalKeydown(e: KeyboardEvent) {
    if (e.key === '?' && !store.editing.id && !(e.target instanceof HTMLInputElement)) {
      showShortcuts.value = !showShortcuts.value
      e.preventDefault()
    }
    const searchDef = settings.resolvedShortcuts.find(
      (s: ShortcutDef) => s.action === 'globalSearch',
    )
    if (searchDef && matchesCombo(e, searchDef.combo)) {
      showGlobalSearch.value = !showGlobalSearch.value
      store.filters.search = ''
      e.preventDefault()
    }
    const paletteDef = settings.resolvedShortcuts.find(
      (s: ShortcutDef) => s.action === 'commandPalette',
    )
    if (paletteDef && matchesCombo(e, paletteDef.combo)) {
      showCommandPalette.value = !showCommandPalette.value
      e.preventDefault()
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', onGlobalKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', onGlobalKeydown)
  })

  return { onGlobalKeydown }
}
