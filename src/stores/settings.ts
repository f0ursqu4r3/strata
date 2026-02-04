import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { themeRegistry, getTheme, getPairedTheme } from '@/data/theme-registry'
import type { ThemeKey } from '@/data/theme-registry'
import { DEFAULT_SHORTCUTS, type ShortcutAction, type KeyCombo, type ShortcutDef } from '@/lib/shortcuts'

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
}

function loadSettings(): { theme: string; fontSize: number; showTags: boolean; showBoardTags: boolean; sidebarOpen: boolean; shortcuts: Record<string, KeyCombo>; workspacePath: string; vimMode: boolean } {
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

      return { theme: themeKey, fontSize: parsed.fontSize ?? 14, showTags: parsed.showTags ?? true, showBoardTags: parsed.showBoardTags ?? true, sidebarOpen: parsed.sidebarOpen ?? false, shortcuts: parsed.shortcuts ?? {}, workspacePath: parsed.workspacePath ?? '', vimMode: parsed.vimMode ?? false }
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
  }

  function resetShortcut(action: ShortcutAction) {
    const { [action]: _, ...rest } = shortcutOverrides.value
    shortcutOverrides.value = rest
    persist()
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

  function init() {
    applyTheme()
    applyFontSize()
  }

  watch([theme, fontSize, showTags, showBoardTags, sidebarOpen, shortcutOverrides, workspacePath, vimMode], persist)

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
    updateShortcut,
    resetShortcut,
    resetAllShortcuts,
    setWorkspacePath,
    init,
  }
})
