import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeName =
  | 'default'
  | 'ocean'
  | 'forest'
  | 'rose'
  | 'amber'
  | 'violet'
  | 'monochrome'

export interface ThemePreset {
  key: ThemeName
  label: string
  accent: string // preview swatch color
}

export const themes: ThemePreset[] = [
  { key: 'default', label: 'Slate Blue', accent: '#3b82f6' },
  { key: 'ocean', label: 'Ocean', accent: '#06b6d4' },
  { key: 'forest', label: 'Forest', accent: '#10b981' },
  { key: 'rose', label: 'Rose', accent: '#f43f5e' },
  { key: 'amber', label: 'Amber', accent: '#f59e0b' },
  { key: 'violet', label: 'Violet', accent: '#8b5cf6' },
  { key: 'monochrome', label: 'Mono', accent: '#64748b' },
]

const STORAGE_KEY = 'strata-settings'

interface PersistedSettings {
  theme: ThemeName
  fontSize: number
  dark: boolean
}

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  // Also migrate old dark mode key
  const oldDark = localStorage.getItem('strata-dark')
  return {
    theme: 'default',
    fontSize: 14,
    dark: oldDark === 'true' || (!oldDark && window.matchMedia('(prefers-color-scheme: dark)').matches),
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = loadSettings()
  const theme = ref<ThemeName>(saved.theme)
  const fontSize = ref(saved.fontSize)
  const dark = ref(saved.dark)

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: theme.value, fontSize: fontSize.value, dark: dark.value }),
    )
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme.value)
  }

  function applyDark() {
    document.documentElement.classList.toggle('dark', dark.value)
  }

  function applyFontSize() {
    document.documentElement.style.setProperty('--strata-font-size', fontSize.value + 'px')
  }

  function toggleDark() {
    dark.value = !dark.value
    applyDark()
    persist()
  }

  function setTheme(t: ThemeName) {
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
    applyDark()
    applyFontSize()
  }

  // Watch for changes and persist
  watch([theme, fontSize, dark], persist)

  return {
    theme,
    fontSize,
    dark,
    toggleDark,
    setTheme,
    setFontSize,
    init,
  }
})
