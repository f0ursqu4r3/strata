import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Node } from '@/types'
import { TEXT_DEBOUNCE_DELAY } from '@/lib/constants'

const sync = vi.hoisted(() => ({
  getFilePath: vi.fn(async () => null),
  saveToFile: vi.fn(async () => {}),
  scheduleFileSave: vi.fn(),
  scheduleIndexUpdate: vi.fn(),
  hasUnsavedChanges: vi.fn(() => false),
  recentlyWritten: vi.fn(() => false),
  flushPendingSave: vi.fn(async () => {}),
}))

vi.mock('@/stores/doc-sync', () => ({ useDocSync: () => sync }))

vi.mock('@/lib/idb', () => ({
  saveOp: vi.fn(async () => {}),
  saveOps: vi.fn(async () => {}),
  loadOpsAfter: vi.fn(async () => []),
  loadLatestSnapshot: vi.fn(async () => undefined),
  saveSnapshot: vi.fn(async () => {}),
  loadAllOps: vi.fn(async () => []),
  clearAll: vi.fn(async () => {}),
  flushOpBuffer: vi.fn(async () => {}),
  setCurrentDocId: vi.fn(),
  loadStatusConfig: vi.fn(async () => null),
  saveStatusConfig: vi.fn(async () => {}),
  loadTagColors: vi.fn(async () => null),
  saveTagColors: vi.fn(async () => {}),
}))

import { useDocStore } from '@/stores/doc'

function makeNode(overrides: Partial<Node>): Node {
  return {
    id: 'a',
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

function setupStore() {
  const store = useDocStore()
  store.rootId = 'root'
  store.nodes = new Map<string, Node>([
    ['root', makeNode({ id: 'root', parentId: null, text: 'Root' })],
    ['a', makeNode({ id: 'a', pos: 'a', text: 'Alpha' })],
    ['b', makeNode({ id: 'b', pos: 'b', text: 'Beta' })],
  ])
  return store
}

function addChild(store: ReturnType<typeof useDocStore>, id: string, parentId: string) {
  const map = new Map(store.nodes)
  map.set(id, makeNode({ id, parentId, pos: id, text: id }))
  store.nodes = map
}

function rowFor(store: ReturnType<typeof useDocStore>, id: string) {
  return store.visibleRows.find((r) => r.node.id === id)
}

describe('doc store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('updateText', () => {
    it('does not rebuild the tree on each keystroke', () => {
      const store = setupStore()
      const childrenBefore = store.childrenMap
      const rowsBefore = store.visibleRows

      store.updateText('a', 'Alpha 1')
      store.updateText('a', 'Alpha 12')

      expect(store.childrenMap).toBe(childrenBefore)
      expect(store.visibleRows).toBe(rowsBefore)
      expect(store.nodes.get('a')!.text).toBe('Alpha 12')
    })

    it('publishes the text to other views when the debounce commits', () => {
      const store = setupStore()
      const nodeBefore = store.nodes.get('a')
      const rowsBefore = store.visibleRows

      store.updateText('a', 'Alpha 1')
      vi.advanceTimersByTime(TEXT_DEBOUNCE_DELAY)

      expect(store.visibleRows).not.toBe(rowsBefore)
      expect(store.nodes.get('a')).not.toBe(nodeBefore)
      expect(rowFor(store, 'a')!.node.text).toBe('Alpha 1')
      expect(sync.scheduleFileSave).toHaveBeenCalledTimes(1)
    })

    it('publishes the text immediately on flush', () => {
      const store = setupStore()

      store.updateText('a', 'Alpha 1')
      store.flushTextDebounce()

      expect(rowFor(store, 'a')!.node.text).toBe('Alpha 1')
      expect(sync.scheduleFileSave).toHaveBeenCalledTimes(1)
    })
  })

  describe('undo / redo', () => {
    it('schedules a file save and index update on undo', async () => {
      const store = setupStore()
      store.setStatus('a', 'done')
      await vi.runAllTimersAsync()
      vi.clearAllMocks()

      store.undo()

      expect(store.nodes.get('a')!.status).toBe('todo')
      expect(sync.scheduleFileSave).toHaveBeenCalledTimes(1)
      expect(sync.scheduleIndexUpdate).toHaveBeenCalledTimes(1)
    })

    it('schedules a file save and index update on redo', async () => {
      const store = setupStore()
      store.setStatus('a', 'done')
      await vi.runAllTimersAsync()
      store.undo()
      vi.clearAllMocks()

      store.redo()

      expect(sync.scheduleFileSave).toHaveBeenCalledTimes(1)
      expect(sync.scheduleIndexUpdate).toHaveBeenCalledTimes(1)
    })

    it('replaces the node object on redo so rows re-render', async () => {
      const store = setupStore()
      store.setStatus('a', 'done')
      await vi.runAllTimersAsync()
      store.undo()
      const nodeBefore = store.nodes.get('a')

      store.redo()

      expect(store.nodes.get('a')).not.toBe(nodeBefore)
      expect(rowFor(store, 'a')!.node.status).toBe('done')
    })

    it('restores a deleted subtree with one undo', () => {
      const store = setupStore()
      addChild(store, 'a1', 'a')
      addChild(store, 'a2', 'a')

      store.tombstone('a')
      expect(rowFor(store, 'a')).toBeUndefined()

      store.undo()
      expect(rowFor(store, 'a')).toBeDefined()
      expect(rowFor(store, 'a1')).toBeDefined()
      expect(rowFor(store, 'a2')).toBeDefined()
    })

    it('undoes and redoes a paste of a subtree with tags as one action', () => {
      const store = setupStore()
      addChild(store, 'a1', 'a')
      store.addTag('a', 'work')
      store.selectNode('a')
      store.copyNodes()
      const before = store.visibleRows.length

      store.pasteNodes()
      expect(store.visibleRows.length).toBe(before + 2)
      const pasted = store.visibleRows.filter((r) => r.node.text === 'Alpha')
      expect(pasted.every((r) => r.node.tags.includes('work'))).toBe(true)

      store.undo()
      expect(store.visibleRows.length).toBe(before)

      store.redo()
      expect(store.visibleRows.length).toBe(before + 2)
      const redone = store.visibleRows.filter((r) => r.node.text === 'Alpha')
      expect(redone.every((r) => r.node.tags.includes('work'))).toBe(true)
    })

    it('undoes a bulk status change with one undo', () => {
      const store = setupStore()
      store.selectNode('a')
      store.toggleSelectNode('b')

      store.bulkSetStatus('done')
      expect(rowFor(store, 'a')!.node.status).toBe('done')
      expect(rowFor(store, 'b')!.node.status).toBe('done')

      store.undo()
      expect(rowFor(store, 'a')!.node.status).toBe('todo')
      expect(rowFor(store, 'b')!.node.status).toBe('todo')
    })

    it('undoes a restore that moved the node out of a deleted parent', () => {
      const store = setupStore()
      addChild(store, 'a1', 'a')
      store.tombstone('a')

      store.restoreNode('a1')
      expect(rowFor(store, 'a1')!.depth).toBe(0)

      store.undo()
      expect(store.nodes.get('a1')!.deleted).toBe(true)
      expect(store.nodes.get('a1')!.parentId).toBe('a')
    })

    it('restores text edits on undo and persists them', () => {
      const store = setupStore()
      store.updateText('a', 'Changed')
      store.flushTextDebounce()
      vi.clearAllMocks()

      store.undo()

      expect(rowFor(store, 'a')!.node.text).toBe('Alpha')
      expect(sync.scheduleFileSave).toHaveBeenCalledTimes(1)
    })
  })
})
