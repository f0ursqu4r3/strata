import { describe, it, expect } from 'vitest'
import {
  matchesCombo,
  comboToString,
  stringToCombo,
  findConflicts,
  DEFAULT_SHORTCUTS,
  type KeyCombo,
  type ShortcutDef,
} from '@/lib/shortcuts'

function makeEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key: '',
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...overrides,
  } as KeyboardEvent
}

describe('matchesCombo', () => {
  it('matches a simple key', () => {
    const combo: KeyCombo = { key: 'Enter' }
    expect(matchesCombo(makeEvent({ key: 'Enter' }), combo)).toBe(true)
    expect(matchesCombo(makeEvent({ key: 'Escape' }), combo)).toBe(false)
  })

  it('matches Ctrl modifier', () => {
    const combo: KeyCombo = { key: 'z', ctrl: true }
    expect(matchesCombo(makeEvent({ key: 'z', ctrlKey: true }), combo)).toBe(true)
    expect(matchesCombo(makeEvent({ key: 'z' }), combo)).toBe(false)
  })

  it('matches Ctrl via metaKey (Mac Cmd)', () => {
    const combo: KeyCombo = { key: 'z', ctrl: true }
    expect(matchesCombo(makeEvent({ key: 'z', metaKey: true }), combo)).toBe(true)
  })

  it('rejects when Ctrl pressed but not expected', () => {
    const combo: KeyCombo = { key: 'z' }
    expect(matchesCombo(makeEvent({ key: 'z', ctrlKey: true }), combo)).toBe(false)
  })

  it('matches Shift modifier', () => {
    const combo: KeyCombo = { key: 'Enter', shift: true }
    expect(matchesCombo(makeEvent({ key: 'Enter', shiftKey: true }), combo)).toBe(true)
    expect(matchesCombo(makeEvent({ key: 'Enter' }), combo)).toBe(false)
  })

  it('matches Alt modifier', () => {
    const combo: KeyCombo = { key: 'a', alt: true }
    expect(matchesCombo(makeEvent({ key: 'a', altKey: true }), combo)).toBe(true)
    expect(matchesCombo(makeEvent({ key: 'a' }), combo)).toBe(false)
  })

  it('matches Ctrl+Shift combo', () => {
    const combo: KeyCombo = { key: 'z', ctrl: true, shift: true }
    expect(matchesCombo(makeEvent({ key: 'z', ctrlKey: true, shiftKey: true }), combo)).toBe(true)
    expect(matchesCombo(makeEvent({ key: 'z', ctrlKey: true }), combo)).toBe(false)
  })

  it('rejects wrong key with correct modifiers', () => {
    const combo: KeyCombo = { key: 'z', ctrl: true }
    expect(matchesCombo(makeEvent({ key: 'x', ctrlKey: true }), combo)).toBe(false)
  })
})

describe('comboToString', () => {
  it('formats simple key', () => {
    expect(comboToString({ key: 'a' })).toBe('A')
  })

  it('formats Ctrl combo', () => {
    expect(comboToString({ key: 'z', ctrl: true })).toBe('Ctrl+Z')
  })

  it('formats Ctrl+Shift combo', () => {
    expect(comboToString({ key: 'z', ctrl: true, shift: true })).toBe('Ctrl+Shift+Z')
  })

  it('formats all modifiers', () => {
    expect(comboToString({ key: 'a', ctrl: true, shift: true, alt: true, meta: true })).toBe('Ctrl+Shift+Alt+Meta+A')
  })

  it('maps special key names', () => {
    expect(comboToString({ key: 'ArrowUp' })).toBe('↑')
    expect(comboToString({ key: 'ArrowDown' })).toBe('↓')
    expect(comboToString({ key: ' ' })).toBe('Space')
    expect(comboToString({ key: 'Escape' })).toBe('Esc')
    expect(comboToString({ key: 'Delete' })).toBe('Del')
    expect(comboToString({ key: 'Backspace' })).toBe('⌫')
    expect(comboToString({ key: 'Tab' })).toBe('Tab')
    expect(comboToString({ key: 'Enter' })).toBe('Enter')
  })

  it('formats Shift+Tab', () => {
    expect(comboToString({ key: 'Tab', shift: true })).toBe('Shift+Tab')
  })
})

describe('stringToCombo', () => {
  it('parses simple key', () => {
    expect(stringToCombo('A')).toEqual({ key: 'a' })
  })

  it('parses Ctrl combo', () => {
    expect(stringToCombo('Ctrl+Z')).toEqual({ key: 'z', ctrl: true })
  })

  it('parses Ctrl+Shift combo', () => {
    expect(stringToCombo('Ctrl+Shift+Z')).toEqual({ key: 'z', ctrl: true, shift: true })
  })

  it('parses special key names', () => {
    expect(stringToCombo('↑').key).toBe('ArrowUp')
    expect(stringToCombo('↓').key).toBe('ArrowDown')
    expect(stringToCombo('Space').key).toBe(' ')
    expect(stringToCombo('Esc').key).toBe('Escape')
    expect(stringToCombo('Del').key).toBe('Delete')
    expect(stringToCombo('Tab').key).toBe('Tab')
  })

  it('roundtrips with comboToString', () => {
    const combos: KeyCombo[] = [
      { key: 'z', ctrl: true },
      { key: 'z', ctrl: true, shift: true },
      { key: 'Tab', shift: true },
      { key: 'ArrowUp' },
      { key: ' ' },
      { key: 'Escape' },
      { key: 'F', ctrl: true, shift: true },
    ]
    for (const combo of combos) {
      const str = comboToString(combo)
      const parsed = stringToCombo(str)
      expect(parsed.key.toLowerCase()).toBe(combo.key.toLowerCase())
      expect(parsed.ctrl ?? false).toBe(combo.ctrl ?? false)
      expect(parsed.shift ?? false).toBe(combo.shift ?? false)
      expect(parsed.alt ?? false).toBe(combo.alt ?? false)
    }
  })
})

describe('findConflicts', () => {
  const shortcuts: ShortcutDef[] = [
    { action: 'undo', combo: { key: 'z', ctrl: true }, label: 'Undo', category: 'General', context: 'global' },
    { action: 'moveUp', combo: { key: 'ArrowUp' }, label: 'Move up', category: 'Nav', context: 'outline' },
    { action: 'stopEditing', combo: { key: 'Escape' }, label: 'Stop editing', category: 'Nav', context: 'editing' },
  ]

  it('finds conflict in same context', () => {
    const conflicts = findConflicts(shortcuts, { key: 'ArrowUp' }, 'outline', 'moveDown')
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]!.action).toBe('moveUp')
  })

  it('excludes self from conflicts', () => {
    const conflicts = findConflicts(shortcuts, { key: 'ArrowUp' }, 'outline', 'moveUp')
    expect(conflicts).toHaveLength(0)
  })

  it('finds conflict with global context', () => {
    const conflicts = findConflicts(shortcuts, { key: 'z', ctrl: true }, 'outline', 'indent')
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]!.action).toBe('undo')
  })

  it('global shortcut conflicts with any context', () => {
    const conflicts = findConflicts(shortcuts, { key: 'z', ctrl: true }, 'global', 'redo')
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]!.action).toBe('undo')
  })

  it('returns empty for no conflicts', () => {
    const conflicts = findConflicts(shortcuts, { key: 'x', ctrl: true }, 'outline', 'moveUp')
    expect(conflicts).toHaveLength(0)
  })

  it('outline and editing contexts do not conflict with each other', () => {
    const conflicts = findConflicts(shortcuts, { key: 'Escape' }, 'outline', 'toggleCollapse')
    expect(conflicts).toHaveLength(0)
  })
})
