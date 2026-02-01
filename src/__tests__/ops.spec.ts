import { describe, it, expect, beforeEach } from 'vitest'
import { makeOp, applyOp, rebuildState, setSeq } from '@/lib/ops'
import type { Node, Op } from '@/types'

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'node-1',
    parentId: 'root',
    pos: 'n',
    text: 'Test',
    collapsed: false,
    status: 'todo',
    deleted: false,
    ...overrides,
  }
}

describe('ops', () => {
  beforeEach(() => {
    setSeq(0)
  })

  describe('makeOp', () => {
    it('creates an op with incrementing sequence numbers', () => {
      const op1 = makeOp('create', {
        type: 'create',
        id: 'a',
        parentId: null,
        pos: 'n',
        text: 'Hello',
        status: 'todo',
      })
      const op2 = makeOp('create', {
        type: 'create',
        id: 'b',
        parentId: null,
        pos: 'p',
        text: 'World',
        status: 'todo',
      })
      expect(op1.seq).toBe(1)
      expect(op2.seq).toBe(2)
      expect(op1.opId).not.toBe(op2.opId)
      expect(op1.type).toBe('create')
    })
  })

  describe('applyOp', () => {
    it('creates a node', () => {
      const nodes = new Map<string, Node>()
      const op = makeOp('create', {
        type: 'create',
        id: 'n1',
        parentId: null,
        pos: 'n',
        text: 'Root',
        status: 'todo',
      })
      const result = applyOp(nodes, op)
      expect(result).toBe('n1')
      expect(nodes.has('n1')).toBe(true)
      const node = nodes.get('n1')!
      expect(node.text).toBe('Root')
      expect(node.status).toBe('todo')
      expect(node.deleted).toBe(false)
      expect(node.collapsed).toBe(false)
    })

    it('updates text', () => {
      const nodes = new Map<string, Node>()
      nodes.set('n1', makeNode({ id: 'n1', text: 'Old' }))

      const op = makeOp('updateText', { type: 'updateText', id: 'n1', text: 'New' })
      applyOp(nodes, op)
      expect(nodes.get('n1')!.text).toBe('New')
    })

    it('returns null for updateText on nonexistent node', () => {
      const nodes = new Map<string, Node>()
      const op = makeOp('updateText', { type: 'updateText', id: 'missing', text: 'x' })
      expect(applyOp(nodes, op)).toBeNull()
    })

    it('moves a node', () => {
      const nodes = new Map<string, Node>()
      nodes.set('n1', makeNode({ id: 'n1', parentId: 'root', pos: 'a' }))

      const op = makeOp('move', { type: 'move', id: 'n1', parentId: 'other', pos: 'z' })
      applyOp(nodes, op)
      expect(nodes.get('n1')!.parentId).toBe('other')
      expect(nodes.get('n1')!.pos).toBe('z')
    })

    it('sets status', () => {
      const nodes = new Map<string, Node>()
      nodes.set('n1', makeNode({ id: 'n1', status: 'todo' }))

      const op = makeOp('setStatus', { type: 'setStatus', id: 'n1', status: 'done' })
      applyOp(nodes, op)
      expect(nodes.get('n1')!.status).toBe('done')
    })

    it('toggles collapsed', () => {
      const nodes = new Map<string, Node>()
      nodes.set('n1', makeNode({ id: 'n1', collapsed: false }))

      const op = makeOp('toggleCollapsed', { type: 'toggleCollapsed', id: 'n1' })
      applyOp(nodes, op)
      expect(nodes.get('n1')!.collapsed).toBe(true)

      const op2 = makeOp('toggleCollapsed', { type: 'toggleCollapsed', id: 'n1' })
      applyOp(nodes, op2)
      expect(nodes.get('n1')!.collapsed).toBe(false)
    })

    it('tombstones a node', () => {
      const nodes = new Map<string, Node>()
      nodes.set('n1', makeNode({ id: 'n1', deleted: false }))

      const op = makeOp('tombstone', { type: 'tombstone', id: 'n1' })
      applyOp(nodes, op)
      expect(nodes.get('n1')!.deleted).toBe(true)
    })
  })

  describe('rebuildState', () => {
    it('builds state from ops alone', () => {
      setSeq(0)
      const ops: Op[] = [
        makeOp('create', {
          type: 'create',
          id: 'root',
          parentId: null,
          pos: 'n',
          text: 'Root',
          status: 'todo',
        }),
        makeOp('create', {
          type: 'create',
          id: 'child1',
          parentId: 'root',
          pos: 'a',
          text: 'Child 1',
          status: 'todo',
        }),
        makeOp('create', {
          type: 'create',
          id: 'child2',
          parentId: 'root',
          pos: 'b',
          text: 'Child 2',
          status: 'in_progress',
        }),
      ]
      const state = rebuildState([], ops)
      expect(state.size).toBe(3)
      expect(state.get('root')!.text).toBe('Root')
      expect(state.get('child1')!.parentId).toBe('root')
      expect(state.get('child2')!.status).toBe('in_progress')
    })

    it('applies ops on top of snapshot', () => {
      const snapshotNodes: Node[] = [
        makeNode({ id: 'root', parentId: null, text: 'Root' }),
        makeNode({ id: 'c1', parentId: 'root', text: 'Old Text' }),
      ]
      setSeq(10)
      const ops: Op[] = [
        makeOp('updateText', { type: 'updateText', id: 'c1', text: 'New Text' }),
      ]
      const state = rebuildState(snapshotNodes, ops)
      expect(state.get('c1')!.text).toBe('New Text')
    })

    it('handles out-of-order ops by sorting', () => {
      setSeq(0)
      const op1 = makeOp('create', {
        type: 'create',
        id: 'n1',
        parentId: null,
        pos: 'n',
        text: 'First',
        status: 'todo',
      })
      const op2 = makeOp('updateText', { type: 'updateText', id: 'n1', text: 'Updated' })

      // Pass ops in reverse order
      const state = rebuildState([], [op2, op1])
      expect(state.get('n1')!.text).toBe('Updated')
    })
  })
})
