/** Predefined tag color palette with light/dark variants */

export interface TagColorDef {
  label: string
  lightBg: string
  lightText: string
  darkBg: string
  darkText: string
}

export const TAG_COLOR_PRESETS: Record<string, TagColorDef> = {
  red:    { label: 'Red',    lightBg: '#fee2e2', lightText: '#991b1b', darkBg: '#450a0a80', darkText: '#fca5a5' },
  orange: { label: 'Orange', lightBg: '#ffedd5', lightText: '#9a3412', darkBg: '#43140780', darkText: '#fdba74' },
  yellow: { label: 'Yellow', lightBg: '#fef9c3', lightText: '#854d0e', darkBg: '#42200780', darkText: '#fde047' },
  green:  { label: 'Green',  lightBg: '#dcfce7', lightText: '#166534', darkBg: '#05290e80', darkText: '#86efac' },
  teal:   { label: 'Teal',   lightBg: '#ccfbf1', lightText: '#115e59', darkBg: '#04282380', darkText: '#5eead4' },
  blue:   { label: 'Blue',   lightBg: '#dbeafe', lightText: '#1e40af', darkBg: '#17234780', darkText: '#93c5fd' },
  purple: { label: 'Purple', lightBg: '#f3e8ff', lightText: '#6b21a8', darkBg: '#2e114580', darkText: '#d8b4fe' },
  pink:   { label: 'Pink',   lightBg: '#fce7f3', lightText: '#9d174d', darkBg: '#45061f80', darkText: '#f9a8d4' },
}

export const TAG_COLOR_KEYS = Object.keys(TAG_COLOR_PRESETS)

/** Returns inline style object for a tag. Falls back to theme accent if no custom color. */
export function tagStyle(tag: string, tagColors: Record<string, string>, isDark: boolean): Record<string, string> | null {
  const colorKey = tagColors[tag]
  if (!colorKey) return null
  const preset = TAG_COLOR_PRESETS[colorKey]
  if (!preset) return null
  return {
    backgroundColor: isDark ? preset.darkBg : preset.lightBg,
    color: isDark ? preset.darkText : preset.lightText,
  }
}
