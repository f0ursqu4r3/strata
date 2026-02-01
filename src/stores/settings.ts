import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { themeRegistry, getTheme, getPairedTheme } from '@/data/theme-registry'
import type { ThemeKey } from '@/data/theme-registry'

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
}

function loadSettings(): { theme: string; fontSize: number } {
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

      return { theme: themeKey, fontSize: parsed.fontSize ?? 14 }
    }
  } catch {
    // ignore
  }

  // Fresh install: respect system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return {
    theme: prefersDark ? 'github-dark' : 'github-light',
    fontSize: 14,
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = loadSettings()
  const theme = ref<ThemeKey>(saved.theme)
  const fontSize = ref(saved.fontSize)

  const dark = computed(() => getTheme(theme.value).appearance === 'dark')

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: theme.value, fontSize: fontSize.value }),
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

  function init() {
    applyTheme()
    applyFontSize()
  }

  watch([theme, fontSize], persist)

  return {
    theme,
    fontSize,
    dark,
    toggleAppearance,
    setTheme,
    setFontSize,
    init,
  }
})
