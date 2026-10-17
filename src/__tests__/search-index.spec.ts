import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadSearchIndex,
  updateIndexForDoc,
  removeDocFromIndex,
  searchAllDocs,
  clearSearchIndexCache,
} from '@/lib/search-index'
import type { Node } from '@/types'

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'node',
    parentId: 'root',
    pos: 'n',
    text: '',
    collapsed: false,
    status: 'todo',
    deleted: false,
    tags: [],
    ...overrides,
  }
}

const KEY_PREFIX = 'strata-search-index:'
const LEGACY_KEY = 'strata-search-index'

describe('search-index', () => {
  beforeEach(() => {
    localStorage.clear()
    clearSearchIndexCache()
  })

  describe('loadSearchIndex', () => {
    it('returns an empty index when nothing stored', () => {
      const index = loadSearchIndex()
      expect(index.entries).toEqual([])
      expect(index.updatedAt).toEqual({})
    })

    it('reads per-document entries from localStorage', () => {
      localStorage.setItem(
        KEY_PREFIX + 'd1',
        JSON.stringify({ updatedAt: 100, entries: [{ nodeId: 'n1', text: 'hello' }] }),
      )
      const index = loadSearchIndex()
      expect(index.entries).toEqual([{ docId: 'd1', nodeId: 'n1', text: 'hello' }])
      expect(index.updatedAt).toEqual({ d1: 100 })
    })

    it('skips invalid per-document JSON', () => {
      localStorage.setItem(KEY_PREFIX + 'd1', 'not json')
      expect(loadSearchIndex().entries).toEqual([])
    })

    it('migrates the legacy single-key index to per-document keys', () => {
      localStorage.setItem(
        LEGACY_KEY,
        JSON.stringify({
          version: 1,
          entries: [
            { docId: 'd1', nodeId: 'n1', text: 'one' },
            { docId: 'd2', nodeId: 'n2', text: 'two' },
          ],
          updatedAt: { d1: 100, d2: 200 },
        }),
      )
      const index = loadSearchIndex()
      expect(index.entries).toHaveLength(2)
      expect(index.updatedAt).toEqual({ d1: 100, d2: 200 })
      expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
      expect(JSON.parse(localStorage.getItem(KEY_PREFIX + 'd2')!).entries).toEqual([
        { nodeId: 'n2', text: 'two' },
      ])
    })

    it('drops invalid legacy JSON', () => {
      localStorage.setItem(LEGACY_KEY, 'not json')
      expect(loadSearchIndex().entries).toEqual([])
      expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
    })
  })

  describe('storage writes', () => {
    function docWith(text: string) {
      const nodes = new Map<string, Node>()
      nodes.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))
      nodes.set('a', makeNode({ id: 'a', parentId: 'root', text }))
      return nodes
    }

    it('writes only the updated document key', () => {
      updateIndexForDoc('doc1', docWith('one'))
      updateIndexForDoc('doc2', docWith('two'))
      const setItem = vi.spyOn(Storage.prototype, 'setItem')

      updateIndexForDoc('doc2', docWith('two changed'))

      expect(setItem).toHaveBeenCalledTimes(1)
      expect(setItem.mock.calls[0]![0]).toBe(KEY_PREFIX + 'doc2')
      setItem.mockRestore()
    })

    it('skips the write when entries did not change', () => {
      updateIndexForDoc('doc1', docWith('same'))
      const setItem = vi.spyOn(Storage.prototype, 'setItem')

      updateIndexForDoc('doc1', docWith('same'))

      expect(setItem).not.toHaveBeenCalled()
      setItem.mockRestore()
    })

    it('survives a cache reset by reading back from storage', () => {
      updateIndexForDoc('doc1', docWith('persisted'))
      clearSearchIndexCache()
      expect(searchAllDocs('persisted', new Map())).toHaveLength(1)
    })
  })

  describe('updateIndexForDoc', () => {
    it('adds entries for non-deleted, non-root nodes with text', () => {
      const nodes = new Map<string, Node>()
      nodes.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))
      nodes.set('a', makeNode({ id: 'a', parentId: 'root', text: 'Task A' }))
      nodes.set('b', makeNode({ id: 'b', parentId: 'root', text: 'Task B' }))

      updateIndexForDoc('doc1', nodes)
      const index = loadSearchIndex()
      expect(index.entries).toHaveLength(2)
      expect(index.entries.map((e) => e.text).sort()).toEqual(['Task A', 'Task B'])
    })

    it('excludes deleted nodes', () => {
      const nodes = new Map<string, Node>()
      nodes.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))
      nodes.set('a', makeNode({ id: 'a', parentId: 'root', text: 'Alive' }))
      nodes.set('b', makeNode({ id: 'b', parentId: 'root', text: 'Dead', deleted: true }))

      updateIndexForDoc('doc1', nodes)
      const index = loadSearchIndex()
      expect(index.entries).toHaveLength(1)
      expect(index.entries[0]!.text).toBe('Alive')
    })

    it('excludes root node', () => {
      const nodes = new Map<string, Node>()
      nodes.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))

      updateIndexForDoc('doc1', nodes)
      const index = loadSearchIndex()
      expect(index.entries).toHaveLength(0)
    })

    it('excludes nodes with empty text', () => {
      const nodes = new Map<string, Node>()
      nodes.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))
      nodes.set('a', makeNode({ id: 'a', parentId: 'root', text: '' }))
      nodes.set('b', makeNode({ id: 'b', parentId: 'root', text: '   ' }))

      updateIndexForDoc('doc1', nodes)
      const index = loadSearchIndex()
      expect(index.entries).toHaveLength(0)
    })

    it('replaces old entries for same doc', () => {
      const nodes1 = new Map<string, Node>()
      nodes1.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))
      nodes1.set('a', makeNode({ id: 'a', parentId: 'root', text: 'Old' }))
      updateIndexForDoc('doc1', nodes1)

      const nodes2 = new Map<string, Node>()
      nodes2.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))
      nodes2.set('a', makeNode({ id: 'a', parentId: 'root', text: 'New' }))
      updateIndexForDoc('doc1', nodes2)

      const index = loadSearchIndex()
      expect(index.entries).toHaveLength(1)
      expect(index.entries[0]!.text).toBe('New')
    })

    it('preserves entries from other docs', () => {
      const nodes1 = new Map<string, Node>()
      nodes1.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))
      nodes1.set('a', makeNode({ id: 'a', parentId: 'root', text: 'Doc1 task' }))
      updateIndexForDoc('doc1', nodes1)

      const nodes2 = new Map<string, Node>()
      nodes2.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))
      nodes2.set('b', makeNode({ id: 'b', parentId: 'root', text: 'Doc2 task' }))
      updateIndexForDoc('doc2', nodes2)

      const index = loadSearchIndex()
      expect(index.entries).toHaveLength(2)
    })

    it('sets updatedAt timestamp', () => {
      const nodes = new Map<string, Node>()
      nodes.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))
      updateIndexForDoc('doc1', nodes)

      const index = loadSearchIndex()
      expect(index.updatedAt['doc1']).toBeTypeOf('number')
    })
  })

  describe('removeDocFromIndex', () => {
    it('removes entries and updatedAt for a doc', () => {
      const nodes = new Map<string, Node>()
      nodes.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))
      nodes.set('a', makeNode({ id: 'a', parentId: 'root', text: 'Task' }))
      updateIndexForDoc('doc1', nodes)

      removeDocFromIndex('doc1')
      const index = loadSearchIndex()
      expect(index.entries).toHaveLength(0)
      expect(index.updatedAt['doc1']).toBeUndefined()
      expect(localStorage.getItem(KEY_PREFIX + 'doc1')).toBeNull()
    })

    it('leaves other docs intact', () => {
      const nodes1 = new Map<string, Node>()
      nodes1.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))
      nodes1.set('a', makeNode({ id: 'a', parentId: 'root', text: 'Keep' }))
      updateIndexForDoc('doc1', nodes1)

      const nodes2 = new Map<string, Node>()
      nodes2.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))
      nodes2.set('b', makeNode({ id: 'b', parentId: 'root', text: 'Remove' }))
      updateIndexForDoc('doc2', nodes2)

      removeDocFromIndex('doc2')
      const index = loadSearchIndex()
      expect(index.entries).toHaveLength(1)
      expect(index.entries[0]!.text).toBe('Keep')
    })
  })

  describe('searchAllDocs', () => {
    beforeEach(() => {
      const nodes = new Map<string, Node>()
      nodes.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))
      nodes.set('a', makeNode({ id: 'a', parentId: 'root', text: 'Buy groceries' }))
      nodes.set('b', makeNode({ id: 'b', parentId: 'root', text: 'Write report' }))
      nodes.set('c', makeNode({ id: 'c', parentId: 'root', text: 'Buy supplies' }))
      updateIndexForDoc('doc1', nodes)
    })

    it('returns empty for empty query', () => {
      const docNames = new Map([['doc1', 'My Doc']])
      expect(searchAllDocs('', docNames)).toEqual([])
      expect(searchAllDocs('   ', docNames)).toEqual([])
    })

    it('finds matching entries case-insensitively', () => {
      const docNames = new Map([['doc1', 'My Doc']])
      const results = searchAllDocs('buy', docNames)
      expect(results).toHaveLength(2)
    })

    it('returns correct match positions', () => {
      const docNames = new Map([['doc1', 'My Doc']])
      const results = searchAllDocs('report', docNames)
      expect(results).toHaveLength(1)
      expect(results[0]!.matchStart).toBe(6)
      expect(results[0]!.matchEnd).toBe(12)
    })

    it('includes docName from docNames map', () => {
      const docNames = new Map([['doc1', 'My Doc']])
      const results = searchAllDocs('buy', docNames)
      expect(results[0]!.docName).toBe('My Doc')
    })

    it('falls back to Unknown for missing doc name', () => {
      const docNames = new Map<string, string>()
      const results = searchAllDocs('buy', docNames)
      expect(results[0]!.docName).toBe('Unknown')
    })

    it('respects limit', () => {
      const docNames = new Map([['doc1', 'My Doc']])
      const results = searchAllDocs('buy', docNames, 1)
      expect(results).toHaveLength(1)
    })

    it('returns no results for non-matching query', () => {
      const docNames = new Map([['doc1', 'My Doc']])
      expect(searchAllDocs('zzz', docNames)).toHaveLength(0)
    })
  })
})
