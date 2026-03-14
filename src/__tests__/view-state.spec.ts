import { describe, it, expect, beforeEach } from 'vitest'
import { saveViewState, loadViewState, clearViewState } from '@/lib/view-state'

describe('view-state', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null for unknown doc', () => {
    expect(loadViewState('unknown')).toBeNull()
  })

  it('saves and loads collapsed set and zoomId', () => {
    saveViewState('doc-1', ['n-0', 'n-1-2'], 'n-3')
    const state = loadViewState('doc-1')
    expect(state).toEqual({ collapsed: ['n-0', 'n-1-2'], zoomId: 'n-3' })
  })

  it('saves null zoomId', () => {
    saveViewState('doc-1', ['n-0'], null)
    const state = loadViewState('doc-1')
    expect(state!.zoomId).toBeNull()
  })

  it('isolates state per document', () => {
    saveViewState('doc-1', ['n-0'], null)
    saveViewState('doc-2', ['n-1'], 'n-5')

    expect(loadViewState('doc-1')!.collapsed).toEqual(['n-0'])
    expect(loadViewState('doc-2')!.collapsed).toEqual(['n-1'])
  })

  it('clears state for a document', () => {
    saveViewState('doc-1', ['n-0'], null)
    clearViewState('doc-1')
    expect(loadViewState('doc-1')).toBeNull()
  })

  it('evicts oldest entries when exceeding max docs', () => {
    for (let i = 0; i < 51; i++) {
      saveViewState(`doc-${i}`, [`n-${i}`], null)
    }
    expect(loadViewState('doc-0')).toBeNull()
    expect(loadViewState('doc-50')).not.toBeNull()
  })
})
