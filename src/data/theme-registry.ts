export interface ThemeDefinition {
  key: string
  label: string
  appearance: 'light' | 'dark'
  pair: string
  preview: {
    bg: string
    fg: string
    accent: string
  }
}

export const themeRegistry: ThemeDefinition[] = [
  {
    key: 'github-light',
    label: 'GitHub Light',
    appearance: 'light',
    pair: 'github-dark',
    preview: { bg: '#ffffff', fg: '#1f2328', accent: '#0969da' },
  },
  {
    key: 'github-dark',
    label: 'GitHub Dark',
    appearance: 'dark',
    pair: 'github-light',
    preview: { bg: '#0d1117', fg: '#e6edf3', accent: '#58a6ff' },
  },
  {
    key: 'monokai',
    label: 'Monokai',
    appearance: 'dark',
    pair: 'github-light',
    preview: { bg: '#272822', fg: '#f8f8f2', accent: '#a6e22e' },
  },
  {
    key: 'nord',
    label: 'Nord',
    appearance: 'dark',
    pair: 'github-light',
    preview: { bg: '#2e3440', fg: '#eceff4', accent: '#88c0d0' },
  },
  {
    key: 'dracula',
    label: 'Dracula',
    appearance: 'dark',
    pair: 'github-light',
    preview: { bg: '#282a36', fg: '#f8f8f2', accent: '#bd93f9' },
  },
  {
    key: 'solarized-light',
    label: 'Solarized Light',
    appearance: 'light',
    pair: 'solarized-dark',
    preview: { bg: '#fdf6e3', fg: '#657b83', accent: '#268bd2' },
  },
  {
    key: 'solarized-dark',
    label: 'Solarized Dark',
    appearance: 'dark',
    pair: 'solarized-light',
    preview: { bg: '#002b36', fg: '#839496', accent: '#268bd2' },
  },
  {
    key: 'one-dark',
    label: 'One Dark',
    appearance: 'dark',
    pair: 'github-light',
    preview: { bg: '#282c34', fg: '#abb2bf', accent: '#61afef' },
  },
  {
    key: 'catppuccin-mocha',
    label: 'Catppuccin',
    appearance: 'dark',
    pair: 'github-light',
    preview: { bg: '#1e1e2e', fg: '#cdd6f4', accent: '#cba6f7' },
  },
  {
    key: 'gruvbox-dark',
    label: 'Gruvbox',
    appearance: 'dark',
    pair: 'github-light',
    preview: { bg: '#282828', fg: '#ebdbb2', accent: '#fabd2f' },
  },
  {
    key: 'tokyo-night',
    label: 'Tokyo Night',
    appearance: 'dark',
    pair: 'github-light',
    preview: { bg: '#1a1b26', fg: '#c0caf5', accent: '#7aa2f7' },
  },
]

export type ThemeKey = (typeof themeRegistry)[number]['key']

export function getTheme(key: string): ThemeDefinition {
  return themeRegistry.find((t) => t.key === key) ?? themeRegistry[0]!
}

export function getPairedTheme(key: string): ThemeDefinition {
  const current = getTheme(key)
  return getTheme(current.pair)
}
