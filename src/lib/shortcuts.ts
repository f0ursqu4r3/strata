export type ShortcutAction =
  | 'moveUp'
  | 'moveDown'
  | 'startEditing'
  | 'stopEditing'
  | 'toggleCollapse'
  | 'indent'
  | 'outdent'
  | 'delete'
  | 'newSibling'
  | 'zoomIn'
  | 'zoomOut'
  | 'undo'
  | 'redo'
  | 'globalSearch'
  | 'commandPalette'

export interface KeyCombo {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
}

export type ShortcutContext = 'outline' | 'editing' | 'global'

export interface ShortcutDef {
  action: ShortcutAction
  combo: KeyCombo
  label: string
  category: string
  context: ShortcutContext
}

export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  // Global
  { action: 'undo', combo: { key: 'z', ctrl: true }, label: 'Undo', category: 'General', context: 'global' },
  { action: 'redo', combo: { key: 'z', ctrl: true, shift: true }, label: 'Redo', category: 'General', context: 'global' },
  { action: 'globalSearch', combo: { key: 'F', ctrl: true, shift: true }, label: 'Search all documents', category: 'General', context: 'global' },
  { action: 'commandPalette', combo: { key: 'k', ctrl: true }, label: 'Command palette', category: 'General', context: 'global' },
  // Outline (not editing)
  { action: 'moveUp', combo: { key: 'ArrowUp' }, label: 'Move selection up', category: 'Navigation', context: 'outline' },
  { action: 'moveDown', combo: { key: 'ArrowDown' }, label: 'Move selection down', category: 'Navigation', context: 'outline' },
  { action: 'startEditing', combo: { key: 'Enter' }, label: 'Start editing', category: 'Navigation', context: 'outline' },
  { action: 'toggleCollapse', combo: { key: ' ' }, label: 'Toggle collapse', category: 'Navigation', context: 'outline' },
  { action: 'zoomIn', combo: { key: 'ArrowRight', alt: true }, label: 'Zoom into node', category: 'Navigation', context: 'outline' },
  { action: 'zoomOut', combo: { key: 'ArrowLeft', alt: true }, label: 'Zoom out to parent', category: 'Navigation', context: 'outline' },
  { action: 'indent', combo: { key: 'Tab' }, label: 'Indent', category: 'Editing', context: 'outline' },
  { action: 'outdent', combo: { key: 'Tab', shift: true }, label: 'Outdent', category: 'Editing', context: 'outline' },
  { action: 'delete', combo: { key: 'Delete' }, label: 'Delete node', category: 'Editing', context: 'outline' },
  // Editing context
  { action: 'stopEditing', combo: { key: 'Escape' }, label: 'Stop editing', category: 'Navigation', context: 'editing' },
  { action: 'newSibling', combo: { key: 'Enter', shift: true }, label: 'New sibling below', category: 'Editing', context: 'editing' },
  { action: 'indent', combo: { key: 'Tab' }, label: 'Indent', category: 'Editing', context: 'editing' },
  { action: 'outdent', combo: { key: 'Tab', shift: true }, label: 'Outdent', category: 'Editing', context: 'editing' },
]

/**
 * Check if a KeyboardEvent matches a KeyCombo.
 * `ctrl` matches both Ctrl and Meta (Cmd on Mac).
 */
export function matchesCombo(e: KeyboardEvent, combo: KeyCombo): boolean {
  const wantCtrl = combo.ctrl ?? false
  const wantShift = combo.shift ?? false
  const wantAlt = combo.alt ?? false

  const hasCtrl = e.ctrlKey || e.metaKey
  if (wantCtrl !== hasCtrl) return false
  if (wantShift !== e.shiftKey) return false
  if (wantAlt !== e.altKey) return false

  return e.key === combo.key
}

/**
 * Convert a KeyCombo to a human-readable string.
 */
export function comboToString(combo: KeyCombo): string {
  const parts: string[] = []
  if (combo.ctrl) parts.push('Ctrl')
  if (combo.shift) parts.push('Shift')
  if (combo.alt) parts.push('Alt')
  if (combo.meta) parts.push('Meta')

  // Friendly key names
  const keyNames: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    ' ': 'Space',
    Escape: 'Esc',
    Delete: 'Del',
    Backspace: '⌫',
    Enter: 'Enter',
    Tab: 'Tab',
  }
  parts.push(keyNames[combo.key] ?? combo.key.toUpperCase())
  return parts.join('+')
}

/**
 * Parse a display string back into a KeyCombo.
 */
export function stringToCombo(s: string): KeyCombo {
  const parts = s.split('+')
  const combo: KeyCombo = { key: '' }

  const reverseKeyNames: Record<string, string> = {
    '↑': 'ArrowUp',
    '↓': 'ArrowDown',
    '←': 'ArrowLeft',
    '→': 'ArrowRight',
    Space: ' ',
    Esc: 'Escape',
    Del: 'Delete',
    '⌫': 'Backspace',
    Enter: 'Enter',
    Tab: 'Tab',
  }

  for (const part of parts) {
    const p = part.trim()
    if (p === 'Ctrl') combo.ctrl = true
    else if (p === 'Shift') combo.shift = true
    else if (p === 'Alt') combo.alt = true
    else if (p === 'Meta') combo.meta = true
    else combo.key = reverseKeyNames[p] ?? p.toLowerCase()
  }

  return combo
}

/**
 * Find shortcuts that conflict with a given combo (same context and same combo).
 */
export function findConflicts(
  shortcuts: ShortcutDef[],
  combo: KeyCombo,
  context: ShortcutContext,
  excludeAction: ShortcutAction,
): ShortcutDef[] {
  return shortcuts.filter((s) => {
    if (s.action === excludeAction) return false
    // Conflicts can occur within the same context, or with global context
    if (s.context !== context && s.context !== 'global' && context !== 'global') return false
    return combosEqual(s.combo, combo)
  })
}

function combosEqual(a: KeyCombo, b: KeyCombo): boolean {
  return (
    a.key === b.key &&
    (a.ctrl ?? false) === (b.ctrl ?? false) &&
    (a.shift ?? false) === (b.shift ?? false) &&
    (a.alt ?? false) === (b.alt ?? false) &&
    (a.meta ?? false) === (b.meta ?? false)
  )
}
