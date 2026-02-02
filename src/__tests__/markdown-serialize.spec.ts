import { describe, it, expect } from 'vitest'
import { serializeToMarkdown, parseMarkdown } from '@/lib/markdown-serialize'
import { DEFAULT_STATUSES } from '@/types'
import type { Node, StatusDef } from '@/types'
import { initialRank, rankAfter } from '@/lib/rank'

function makeNode(overrides: Partial<Node> & { id: string; parentId: string | null; pos: string }): Node {
  return {
    text: '',
    collapsed: false,
    status: 'todo',
    deleted: false,
    tags: [],
    dueDate: undefined,
    ...overrides,
  }
}

function buildTree(specs: { text: string; parentId: string | null; status?: string; tags?: string[]; dueDate?: number | null; collapsed?: boolean }[], rootId: string): Map<string, Node> {
  const nodes = new Map<string, Node>()
  nodes.set(rootId, makeNode({ id: rootId, parentId: null, pos: initialRank(), text: 'Root' }))

  let pos = initialRank()
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i]!
    const id = `node-${i}`
    pos = i === 0 ? initialRank() : rankAfter(pos)
    nodes.set(id, makeNode({
      id,
      parentId: s.parentId,
      pos,
      text: s.text,
      status: s.status ?? 'todo',
      tags: s.tags ?? [],
      dueDate: s.dueDate ?? undefined,
      collapsed: s.collapsed ?? false,
    }))
  }
  return nodes
}

describe('serializeToMarkdown', () => {
  it('serializes a simple flat list', () => {
    const rootId = 'root'
    const nodes = buildTree([
      { text: 'First item', parentId: rootId },
      { text: 'Second item', parentId: rootId, status: 'done' },
    ], rootId)

    const md = serializeToMarkdown({ nodes, rootId, statusConfig: [...DEFAULT_STATUSES] })

    expect(md).toContain('- First item')
    expect(md).toContain('- Second item !status(done)')
    // Default status (todo) should NOT have a marker
    expect(md).not.toContain('!status(todo)')
  })

  it('serializes nested children with indentation', () => {
    const rootId = 'root'
    const nodes = buildTree([
      { text: 'Parent', parentId: rootId },
      { text: 'Child', parentId: 'node-0' },
    ], rootId)

    const md = serializeToMarkdown({ nodes, rootId, statusConfig: [...DEFAULT_STATUSES] })

    expect(md).toContain('- Parent')
    expect(md).toContain('  - Child')
  })

  it('serializes tags', () => {
    const rootId = 'root'
    const nodes = buildTree([
      { text: 'Tagged item', parentId: rootId, tags: ['urgent', 'backend'] },
    ], rootId)

    const md = serializeToMarkdown({ nodes, rootId, statusConfig: [...DEFAULT_STATUSES] })

    expect(md).toContain('- Tagged item #urgent #backend')
  })

  it('serializes due dates', () => {
    const rootId = 'root'
    const dueDate = new Date('2026-03-15T00:00:00').getTime()
    const nodes = buildTree([
      { text: 'Due item', parentId: rootId, dueDate },
    ], rootId)

    const md = serializeToMarkdown({ nodes, rootId, statusConfig: [...DEFAULT_STATUSES] })

    expect(md).toContain('@due(2026-03-15)')
  })

  it('serializes collapsed marker', () => {
    const rootId = 'root'
    const nodes = buildTree([
      { text: 'Collapsed', parentId: rootId, collapsed: true },
    ], rootId)

    const md = serializeToMarkdown({ nodes, rootId, statusConfig: [...DEFAULT_STATUSES] })

    expect(md).toContain('!collapsed')
  })

  it('skips deleted nodes', () => {
    const rootId = 'root'
    const nodes = buildTree([
      { text: 'Visible', parentId: rootId },
      { text: 'Deleted', parentId: rootId },
    ], rootId)
    nodes.get('node-1')!.deleted = true

    const md = serializeToMarkdown({ nodes, rootId, statusConfig: [...DEFAULT_STATUSES] })

    expect(md).toContain('Visible')
    expect(md).not.toContain('Deleted')
  })

  it('includes status config in frontmatter', () => {
    const rootId = 'root'
    const nodes = buildTree([], rootId)
    const statusConfig: StatusDef[] = [
      { id: 'open', label: 'Open', color: '#aaa', icon: 'circle' },
      { id: 'closed', label: 'Closed', color: '#bbb', icon: 'circle-check' },
    ]

    const md = serializeToMarkdown({ nodes, rootId, statusConfig })

    expect(md).toContain('---')
    expect(md).toContain('id: open')
    expect(md).toContain('label: "Open"')
    expect(md).toContain('color: "#aaa"')
    expect(md).toContain('icon: circle')
  })

  it('handles multiline text', () => {
    const rootId = 'root'
    const nodes = buildTree([
      { text: 'Line one\nLine two\nLine three', parentId: rootId },
    ], rootId)

    const md = serializeToMarkdown({ nodes, rootId, statusConfig: [...DEFAULT_STATUSES] })

    expect(md).toContain('- Line one')
    expect(md).toContain('  Line two')
    expect(md).toContain('  Line three')
  })
})

describe('parseMarkdown', () => {
  it('parses a simple flat list', () => {
    const md = `---
statuses:
  - id: todo
    label: "Todo"
    color: "#94a3b8"
    icon: circle
  - id: done
    label: "Done"
    color: "#22c55e"
    icon: circle-check
---

- First item
- Second item !status(done)
`
    const result = parseMarkdown(md)

    const items = [...result.nodes.values()].filter((n) => n.parentId === result.rootId)
    expect(items).toHaveLength(2)
    expect(items[0]!.text).toBe('First item')
    expect(items[0]!.status).toBe('todo')
    expect(items[1]!.text).toBe('Second item')
    expect(items[1]!.status).toBe('done')
  })

  it('parses nested items', () => {
    const md = `---
statuses:
  - id: todo
    label: "Todo"
    color: "#94a3b8"
    icon: circle
---

- Parent
  - Child
    - Grandchild
`
    const result = parseMarkdown(md)

    const topLevel = [...result.nodes.values()].filter((n) => n.parentId === result.rootId)
    expect(topLevel).toHaveLength(1)
    expect(topLevel[0]!.text).toBe('Parent')

    const children = [...result.nodes.values()].filter((n) => n.parentId === topLevel[0]!.id)
    expect(children).toHaveLength(1)
    expect(children[0]!.text).toBe('Child')

    const grandchildren = [...result.nodes.values()].filter((n) => n.parentId === children[0]!.id)
    expect(grandchildren).toHaveLength(1)
    expect(grandchildren[0]!.text).toBe('Grandchild')
  })

  it('parses tags', () => {
    const md = `---
statuses:
  - id: todo
    label: "Todo"
    color: "#94a3b8"
    icon: circle
---

- Item with tags #urgent #backend
`
    const result = parseMarkdown(md)

    const items = [...result.nodes.values()].filter((n) => n.parentId === result.rootId)
    expect(items[0]!.text).toBe('Item with tags')
    expect(items[0]!.tags).toEqual(['urgent', 'backend'])
  })

  it('parses due dates', () => {
    const md = `---
statuses:
  - id: todo
    label: "Todo"
    color: "#94a3b8"
    icon: circle
---

- Due item @due(2026-03-15)
`
    const result = parseMarkdown(md)

    const items = [...result.nodes.values()].filter((n) => n.parentId === result.rootId)
    expect(items[0]!.text).toBe('Due item')
    expect(items[0]!.dueDate).toBe(new Date('2026-03-15T00:00:00').getTime())
  })

  it('parses collapsed marker', () => {
    const md = `---
statuses:
  - id: todo
    label: "Todo"
    color: "#94a3b8"
    icon: circle
---

- Collapsed item !collapsed
`
    const result = parseMarkdown(md)

    const items = [...result.nodes.values()].filter((n) => n.parentId === result.rootId)
    expect(items[0]!.collapsed).toBe(true)
  })

  it('parses custom status config from frontmatter', () => {
    const md = `---
statuses:
  - id: open
    label: "Open"
    color: "#aaa"
    icon: circle
  - id: closed
    label: "Closed"
    color: "#bbb"
    icon: circle-check
---

- Item
`
    const result = parseMarkdown(md)

    expect(result.statusConfig).toHaveLength(2)
    expect(result.statusConfig[0]!.id).toBe('open')
    expect(result.statusConfig[0]!.label).toBe('Open')
    expect(result.statusConfig[1]!.id).toBe('closed')
  })

  it('falls back to DEFAULT_STATUSES when no frontmatter', () => {
    const md = `- Item one
- Item two
`
    const result = parseMarkdown(md)

    expect(result.statusConfig).toEqual(DEFAULT_STATUSES)
  })

  it('parses all markers combined', () => {
    const md = `---
statuses:
  - id: todo
    label: "Todo"
    color: "#94a3b8"
    icon: circle
  - id: in_progress
    label: "In Progress"
    color: "#3b82f6"
    icon: circle-dot
---

- Complex item !status(in_progress) #urgent #frontend @due(2026-06-01) !collapsed
`
    const result = parseMarkdown(md)

    const items = [...result.nodes.values()].filter((n) => n.parentId === result.rootId)
    const item = items[0]!
    expect(item.text).toBe('Complex item')
    expect(item.status).toBe('in_progress')
    expect(item.tags).toEqual(['urgent', 'frontend'])
    expect(item.dueDate).toBe(new Date('2026-06-01T00:00:00').getTime())
    expect(item.collapsed).toBe(true)
  })
})

describe('round-trip', () => {
  it('serialize → parse → serialize produces stable output', () => {
    const rootId = 'root'
    const dueDate = new Date('2026-04-01T00:00:00').getTime()
    const statusConfig: StatusDef[] = [
      { id: 'todo', label: 'Todo', color: '#94a3b8', icon: 'circle' },
      { id: 'in_progress', label: 'In Progress', color: '#3b82f6', icon: 'circle-dot' },
      { id: 'done', label: 'Done', color: '#22c55e', icon: 'circle-check' },
    ]

    const nodes = buildTree([
      { text: 'Top level task', parentId: rootId, status: 'in_progress', tags: ['dev'] },
      { text: 'Child task', parentId: 'node-0', status: 'todo', dueDate },
      { text: 'Another top level', parentId: rootId, status: 'done', collapsed: true },
    ], rootId)

    const md1 = serializeToMarkdown({ nodes, rootId, statusConfig })
    const parsed = parseMarkdown(md1)
    const md2 = serializeToMarkdown({
      nodes: parsed.nodes,
      rootId: parsed.rootId,
      statusConfig: parsed.statusConfig,
    })

    expect(md2).toBe(md1)
  })
})
