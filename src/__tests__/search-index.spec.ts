import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadSearchIndex,
  saveSearchIndex,
  updateIndexForDoc,
  removeDocFromIndex,
  searchAllDocs,
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

const STORAGE_KEY = 'strata-search-index'

describe('search-index', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('loadSearchIndex', () => {
    it('returns default index when nothing stored', () => {
      const index = loadSearchIndex()
      expect(index.version).toBe(1)
      expect(index.entries).toEqual([])
      expect(index.updatedAt).toEqual({})
    })

    it('returns parsed index from localStorage', () => {
      const stored = { version: 1, entries: [{ docId: 'd1', nodeId: 'n1', text: 'hello' }], updatedAt: { d1: 100 } }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
      const index = loadSearchIndex()
      expect(index.entries).toHaveLength(1)
      expect(index.entries[0]!.text).toBe('hello')
    })

    it('returns default index on invalid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not json')
      const index = loadSearchIndex()
      expect(index.entries).toEqual([])
    })
  })

  describe('saveSearchIndex', () => {
    it('persists index to localStorage', () => {
      const index = { version: 1, entries: [{ docId: 'd1', nodeId: 'n1', text: 'test' }], updatedAt: { d1: 123 } }
      saveSearchIndex(index)
      const raw = localStorage.getItem(STORAGE_KEY)
      expect(raw).not.toBeNull()
      expect(JSON.parse(raw!)).toEqual(index)
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
