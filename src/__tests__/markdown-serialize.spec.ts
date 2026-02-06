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
  it('serializes a simple flat list with checkboxes', () => {
    const rootId = 'root'
    const nodes = buildTree([
      { text: 'First item', parentId: rootId },
      { text: 'Second item', parentId: rootId, status: 'done' },
    ], rootId)

    const md = serializeToMarkdown({ nodes, rootId, statusConfig: [...DEFAULT_STATUSES] })

    expect(md).toContain('- [ ] First item')
    expect(md).toContain('- [x] Second item')
    // Default status (todo) should NOT have a marker
    expect(md).not.toContain('!status(Todo)')
    // Done is the only final status, so !status(Done) should be omitted (implied by [x])
    expect(md).not.toContain('!status(Done)')
  })

  it('serializes nested children with indentation', () => {
    const rootId = 'root'
    const nodes = buildTree([
      { text: 'Parent', parentId: rootId },
      { text: 'Child', parentId: 'node-0' },
    ], rootId)

    const md = serializeToMarkdown({ nodes, rootId, statusConfig: [...DEFAULT_STATUSES] })

    expect(md).toContain('- [ ] Parent')
    expect(md).toContain('  - [ ] Child')
  })

  it('serializes tags', () => {
    const rootId = 'root'
    const nodes = buildTree([
      { text: 'Tagged item', parentId: rootId, tags: ['urgent', 'backend'] },
    ], rootId)

    const md = serializeToMarkdown({ nodes, rootId, statusConfig: [...DEFAULT_STATUSES] })

    expect(md).toContain('- [ ] Tagged item  #urgent #backend')
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

  it('uses minimal frontmatter with default statuses', () => {
    const rootId = 'root'
    const nodes = buildTree([
      { text: 'Item', parentId: rootId },
    ], rootId)

    const md = serializeToMarkdown({ nodes, rootId, statusConfig: [...DEFAULT_STATUSES] })

    expect(md).toContain('doc-type: strata')
    expect(md).not.toContain('statuses:')
  })

  it('includes status config in frontmatter', () => {
    const rootId = 'root'
    const nodes = buildTree([], rootId)
    const statusConfig: StatusDef[] = [
      { id: 'open', label: 'Open', color: '#aaa', icon: 'circle' },
      { id: 'closed', label: 'Closed', color: '#bbb', icon: 'circle-check' },
    ]

    const md = serializeToMarkdown({ nodes, rootId, statusConfig })

    expect(md).toContain('doc-type: strata')
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

    expect(md).toContain('- [ ] Line one')
    expect(md).toContain('  Line two')
    expect(md).toContain('  Line three')
  })

  it('includes !status() when there are multiple final statuses', () => {
    const rootId = 'root'
    const statusConfig: StatusDef[] = [
      { id: 'todo', label: 'Todo', color: '#aaa', icon: 'circle' },
      { id: 'done', label: 'Done', color: '#bbb', icon: 'circle-check', final: true },
      { id: 'archived', label: 'Archived', color: '#ccc', icon: 'archive', final: true },
    ]
    const nodes = buildTree([
      { text: 'Done item', parentId: rootId, status: 'done' },
      { text: 'Archived item', parentId: rootId, status: 'archived' },
    ], rootId)

    const md = serializeToMarkdown({ nodes, rootId, statusConfig })

    // Both are [x] but need !status() to disambiguate
    expect(md).toContain('- [x] Done item  !status(Done)')
    expect(md).toContain('- [x] Archived item  !status(Archived)')
  })

  it('includes final flag in custom status frontmatter', () => {
    const rootId = 'root'
    const nodes = buildTree([], rootId)
    const statusConfig: StatusDef[] = [
      { id: 'open', label: 'Open', color: '#aaa', icon: 'circle' },
      { id: 'closed', label: 'Closed', color: '#bbb', icon: 'circle-check', final: true },
    ]

    const md = serializeToMarkdown({ nodes, rootId, statusConfig })

    expect(md).toContain('final: true')
  })
})

describe('parseMarkdown', () => {
  it('parses a simple flat list with checkboxes', () => {
    const md = `---
doc-type: strata
---

- [ ] First item
- [x] Second item
`
    const result = parseMarkdown(md)

    const items = [...result.nodes.values()].filter((n) => n.parentId === result.rootId)
    expect(items).toHaveLength(2)
    expect(items[0]!.text).toBe('First item')
    expect(items[0]!.status).toBe('todo')
    expect(items[1]!.text).toBe('Second item')
    expect(items[1]!.status).toBe('done') // [x] maps to first final status
  })

  it('parses explicit status that overrides checkbox', () => {
    const md = `---
doc-type: strata
---

- [x] Item with explicit status  !status(In Progress)
`
    const result = parseMarkdown(md)

    const items = [...result.nodes.values()].filter((n) => n.parentId === result.rootId)
    expect(items[0]!.text).toBe('Item with explicit status')
    expect(items[0]!.status).toBe('in_progress') // Explicit status wins over [x]
  })

  it('parses nested items with checkboxes', () => {
    const md = `---
doc-type: strata
---

- [ ] Parent
  - [ ] Child
    - [x] Grandchild
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
    expect(grandchildren[0]!.status).toBe('done')
  })

  it('parses items without checkboxes (backwards compat)', () => {
    const md = `---
doc-type: strata
---

- Item without checkbox
- Another item  !status(Done)
`
    const result = parseMarkdown(md)

    const items = [...result.nodes.values()].filter((n) => n.parentId === result.rootId)
    expect(items[0]!.text).toBe('Item without checkbox')
    expect(items[0]!.status).toBe('todo')
    expect(items[1]!.text).toBe('Another item')
    expect(items[1]!.status).toBe('done')
  })

  it('parses tags', () => {
    const md = `---
doc-type: strata
---

- [ ] Item with tags  #urgent #backend
`
    const result = parseMarkdown(md)

    const items = [...result.nodes.values()].filter((n) => n.parentId === result.rootId)
    expect(items[0]!.text).toBe('Item with tags')
    expect(items[0]!.tags).toEqual(['urgent', 'backend'])
  })

  it('parses due dates', () => {
    const md = `---
doc-type: strata
---

- [ ] Due item  @due(2026-03-15)
`
    const result = parseMarkdown(md)

    const items = [...result.nodes.values()].filter((n) => n.parentId === result.rootId)
    expect(items[0]!.text).toBe('Due item')
    expect(items[0]!.dueDate).toBe(new Date('2026-03-15T00:00:00').getTime())
  })

  it('parses collapsed marker', () => {
    const md = `---
doc-type: strata
---

- [ ] Collapsed item  !collapsed
`
    const result = parseMarkdown(md)

    const items = [...result.nodes.values()].filter((n) => n.parentId === result.rootId)
    expect(items[0]!.collapsed).toBe(true)
  })

  it('parses custom status config with final flag from frontmatter', () => {
    const md = `---
doc-type: strata
statuses:
  - id: open
    label: "Open"
    color: "#aaa"
    icon: circle
  - id: closed
    label: "Closed"
    color: "#bbb"
    icon: circle-check
    final: true
---

- [ ] Item
`
    const result = parseMarkdown(md)

    expect(result.statusConfig).toHaveLength(2)
    expect(result.statusConfig[0]!.id).toBe('open')
    expect(result.statusConfig[0]!.label).toBe('Open')
    expect(result.statusConfig[0]!.final).toBeFalsy()
    expect(result.statusConfig[1]!.id).toBe('closed')
    expect(result.statusConfig[1]!.final).toBe(true)
  })

  it('falls back to DEFAULT_STATUSES when no frontmatter', () => {
    const md = `- [ ] Item one
- [ ] Item two
`
    const result = parseMarkdown(md)

    expect(result.statusConfig).toEqual(DEFAULT_STATUSES)
  })

  it('parses all markers combined', () => {
    const md = `---
doc-type: strata
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

- [ ] Complex item  !status(In Progress)  #urgent #frontend  @due(2026-06-01)  !collapsed
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
      { id: 'done', label: 'Done', color: '#22c55e', icon: 'circle-check', final: true },
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

  it('round-trips with checkbox checked items', () => {
    const md = `---
doc-type: strata
---

- [ ] Unchecked item
- [x] Checked item
- [ ] Item with status  !status(In Progress)
`
    const parsed = parseMarkdown(md)
    const md2 = serializeToMarkdown({
      nodes: parsed.nodes,
      rootId: parsed.rootId,
      statusConfig: parsed.statusConfig,
    })

    // Verify the structure is preserved
    expect(md2).toContain('- [ ] Unchecked item')
    expect(md2).toContain('- [x] Checked item')
    expect(md2).toContain('- [ ] Item with status  !status(In Progress)')
  })
})
