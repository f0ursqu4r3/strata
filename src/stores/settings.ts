import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { themeRegistry, getTheme, getPairedTheme } from '@/data/theme-registry'
import type { ThemeKey } from '@/data/theme-registry'
import {
  DEFAULT_SHORTCUTS,
  type ShortcutAction,
  type KeyCombo,
  type ShortcutDef,
} from '@/lib/shortcuts'
import { isTauri } from '@/lib/platform'

const STORAGE_KEY = 'strata-settings'

// Map old accent-only theme keys to new full themes
const LEGACY_THEME_MAP: Record<string, string> = {
  default: 'github-light',
  ocean: 'github-light',
  forest: 'github-light',
  rose: 'github-light',
  amber: 'github-light',
  violet: 'github-light',
  monochrome: 'github-light',
}

export type OpenMode = 'folder' | 'single-file'

interface PersistedSettings {
  theme: string
  fontSize: number
  dark?: boolean // legacy field, used for migration only
  showTags?: boolean
  showBoardTags?: boolean
  sidebarOpen?: boolean
  shortcuts?: Record<string, KeyCombo>
  workspacePath?: string
  vimMode?: boolean
  openMode?: OpenMode
  singleFilePath?: string
}

function loadSettings(): {
  theme: string
  fontSize: number
  showTags: boolean
  showBoardTags: boolean
  sidebarOpen: boolean
  shortcuts: Record<string, KeyCombo>
  workspacePath: string
  vimMode: boolean
  openMode: OpenMode
  singleFilePath: string
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: PersistedSettings = JSON.parse(raw)
      let themeKey = parsed.theme

      // Migrate old theme keys
      if (LEGACY_THEME_MAP[themeKey]) {
        themeKey = LEGACY_THEME_MAP[themeKey]!
        // If user had dark mode on, pick the dark variant
        if (parsed.dark) {
          themeKey = getPairedTheme(themeKey).key
        }
      }

      // Validate that the theme key actually exists
      const valid = themeRegistry.some((t) => t.key === themeKey)
      if (!valid) themeKey = 'github-light'

      return {
        theme: themeKey,
        fontSize: parsed.fontSize ?? 14,
        showTags: parsed.showTags ?? true,
        showBoardTags: parsed.showBoardTags ?? true,
        sidebarOpen: parsed.sidebarOpen ?? false,
        shortcuts: parsed.shortcuts ?? {},
        workspacePath: parsed.workspacePath ?? '',
        vimMode: parsed.vimMode ?? false,
        openMode: parsed.openMode ?? 'folder',
        singleFilePath: parsed.singleFilePath ?? '',
      }
    }
  } catch {
    // ignore
  }

  // Fresh install: respect system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return {
    theme: prefersDark ? 'github-dark' : 'github-light',
    fontSize: 14,
    showTags: true,
    showBoardTags: true,
    sidebarOpen: false,
    shortcuts: {},
    workspacePath: '',
    vimMode: false,
    openMode: 'folder' as OpenMode,
    singleFilePath: '',
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = loadSettings()
  const theme = ref<ThemeKey>(saved.theme)
  const fontSize = ref(saved.fontSize)
  const showTags = ref(saved.showTags)
  const showBoardTags = ref(saved.showBoardTags)
  const sidebarOpen = ref(saved.sidebarOpen)
  const shortcutOverrides = ref<Record<string, KeyCombo>>(saved.shortcuts)
  const workspacePath = ref(saved.workspacePath)
  const vimMode = ref(saved.vimMode)
  const openMode = ref<OpenMode>(saved.openMode)
  const singleFilePath = ref(saved.singleFilePath)

  const resolvedShortcuts = computed<ShortcutDef[]>(() => {
    return DEFAULT_SHORTCUTS.map((def) => {
      const override = shortcutOverrides.value[def.action]
      if (override) return { ...def, combo: override }
      return def
    })
  })

  const dark = computed(() => getTheme(theme.value).appearance === 'dark')

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        theme: theme.value,
        fontSize: fontSize.value,
        showTags: showTags.value,
        showBoardTags: showBoardTags.value,
        sidebarOpen: sidebarOpen.value,
        shortcuts: shortcutOverrides.value,
        workspacePath: workspacePath.value,
        vimMode: vimMode.value,
        openMode: openMode.value,
        singleFilePath: singleFilePath.value,
      }),
    )
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme.value)
    document.documentElement.classList.toggle('dark', dark.value)
  }

  function applyFontSize() {
    document.documentElement.style.setProperty('--strata-font-size', fontSize.value + 'px')
  }

  function toggleAppearance() {
    const paired = getPairedTheme(theme.value)
    theme.value = paired.key
    applyTheme()
    persist()
  }

  function setTheme(t: ThemeKey) {
    theme.value = t
    applyTheme()
    persist()
  }

  function setFontSize(size: number) {
    fontSize.value = Math.max(11, Math.min(20, size))
    applyFontSize()
    persist()
  }

  function setShowTags(v: boolean) {
    showTags.value = v
    persist()
  }

  function setShowBoardTags(v: boolean) {
    showBoardTags.value = v
    persist()
  }

  function setSidebarOpen(v: boolean) {
    sidebarOpen.value = v
    persist()
  }

  function updateShortcut(action: ShortcutAction, combo: KeyCombo) {
    shortcutOverrides.value = { ...shortcutOverrides.value, [action]: combo }
    persist()
    if (action === 'quickCapture' && isTauri()) {
      syncCaptureShortcut(combo)
    }
  }

  function resetShortcut(action: ShortcutAction) {
    const { [action]: _, ...rest } = shortcutOverrides.value
    shortcutOverrides.value = rest
    persist()
    if (action === 'quickCapture' && isTauri()) {
      // Reset to default
      const def = DEFAULT_SHORTCUTS.find((s) => s.action === 'quickCapture')
      if (def) syncCaptureShortcut(def.combo)
    }
  }

  async function syncCaptureShortcut(combo: KeyCombo) {
    const { invoke } = await import('@tauri-apps/api/core')
    const parts: string[] = []
    if (combo.ctrl) parts.push('CmdOrCtrl')
    if (combo.shift) parts.push('Shift')
    if (combo.alt) parts.push('Alt')
    const keyMap: Record<string, string> = { ' ': 'Space' }
    parts.push(keyMap[combo.key] ?? combo.key.toUpperCase())
    await invoke('set_capture_shortcut', { shortcutStr: parts.join('+') })
  }

  function resetAllShortcuts() {
    shortcutOverrides.value = {}
    persist()
  }

  function setVimMode(v: boolean) {
    vimMode.value = v
    persist()
  }

  function setWorkspacePath(path: string) {
    workspacePath.value = path
    persist()
  }

  function setOpenMode(mode: OpenMode) {
    openMode.value = mode
    persist()
  }

  function setSingleFilePath(path: string) {
    singleFilePath.value = path
    persist()
  }

  function init() {
    applyTheme()
    applyFontSize()
  }

  watch(
    [
      theme,
      fontSize,
      showTags,
      showBoardTags,
      sidebarOpen,
      shortcutOverrides,
      workspacePath,
      vimMode,
      openMode,
      singleFilePath,
    ],
    persist,
  )

  return {
    theme,
    fontSize,
    showTags,
    showBoardTags,
    sidebarOpen,
    dark,
    resolvedShortcuts,
    toggleAppearance,
    setTheme,
    setFontSize,
    setShowTags,
    setShowBoardTags,
    setSidebarOpen,
    vimMode,
    setVimMode,
    workspacePath,
    openMode,
    singleFilePath,
    updateShortcut,
    resetShortcut,
    resetAllShortcuts,
    setWorkspacePath,
    setOpenMode,
    setSingleFilePath,
    init,
  }
})
