import { describe, it, expect } from 'vitest'
import { exportToMarkdown, exportToOPML, exportToPlaintext } from '@/lib/export-formats'
import type { Node, StatusDef } from '@/types'

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

// Build a test tree:
// root
// ├── a (todo, tags: [urgent])
// │   └── a1 (in_progress)
// ├── b (done, multiline text)
// └── c (todo)
function makeTestTree(): { nodes: Map<string, Node>; statusMap: Map<string, StatusDef> } {
  const nodes = new Map<string, Node>()
  nodes.set('root', makeNode({ id: 'root', parentId: null, pos: 'n', text: 'Root' }))
  nodes.set('a', makeNode({ id: 'a', parentId: 'root', pos: 'a', text: 'Task A', status: 'todo', tags: ['urgent'] }))
  nodes.set('a1', makeNode({ id: 'a1', parentId: 'a', pos: 'a', text: 'Subtask A1', status: 'in_progress' }))
  nodes.set('b', makeNode({ id: 'b', parentId: 'root', pos: 'b', text: 'Task B\nExtra line', status: 'done' }))
  nodes.set('c', makeNode({ id: 'c', parentId: 'root', pos: 'c', text: 'Task C', status: 'todo' }))

  const statusMap = new Map<string, StatusDef>()
  statusMap.set('todo', { id: 'todo', label: 'Todo', color: '#94a3b8', icon: 'circle' })
  statusMap.set('in_progress', { id: 'in_progress', label: 'In Progress', color: '#3b82f6', icon: 'circle-dot' })
  statusMap.set('done', { id: 'done', label: 'Done', color: '#22c55e', icon: 'circle-check' })

  return { nodes, statusMap }
}

describe('exportToMarkdown', () => {
  it('exports hierarchical bullet list', () => {
    const { nodes, statusMap } = makeTestTree()
    const md = exportToMarkdown(nodes, 'root', statusMap)

    expect(md).toContain('- [T] Task A #urgent')
    expect(md).toContain('  - [I] Subtask A1')
    expect(md).toContain('- [D] Task B')
    expect(md).toContain('- [T] Task C')
  })

  it('handles multiline text', () => {
    const { nodes, statusMap } = makeTestTree()
    const md = exportToMarkdown(nodes, 'root', statusMap)
    const lines = md.split('\n')

    const bIdx = lines.findIndex((l) => l.includes('Task B'))
    expect(bIdx).toBeGreaterThan(-1)
    expect(lines[bIdx + 1]).toBe('  Extra line')
  })

  it('includes tags as hashtags', () => {
    const { nodes, statusMap } = makeTestTree()
    const md = exportToMarkdown(nodes, 'root', statusMap)
    expect(md).toContain('#urgent')
  })

  it('respects zoomId', () => {
    const { nodes, statusMap } = makeTestTree()
    const md = exportToMarkdown(nodes, 'root', statusMap, 'a')

    expect(md).toContain('Subtask A1')
    expect(md).not.toContain('Task B')
    expect(md).not.toContain('Task C')
  })

  it('handles empty text as (empty)', () => {
    const nodes = new Map<string, Node>()
    nodes.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))
    nodes.set('e', makeNode({ id: 'e', parentId: 'root', pos: 'a', text: '' }))
    const statusMap = new Map<string, StatusDef>()
    statusMap.set('todo', { id: 'todo', label: 'Todo', color: '#000', icon: 'circle' })

    const md = exportToMarkdown(nodes, 'root', statusMap)
    expect(md).toContain('(empty)')
  })

  it('excludes deleted nodes', () => {
    const { nodes, statusMap } = makeTestTree()
    nodes.get('c')!.deleted = true
    const md = exportToMarkdown(nodes, 'root', statusMap)
    expect(md).not.toContain('Task C')
  })
})

describe('exportToOPML', () => {
  it('produces valid XML structure', () => {
    const { nodes, statusMap } = makeTestTree()
    const opml = exportToOPML(nodes, 'root', statusMap)

    expect(opml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(opml).toContain('<opml version="2.0">')
    expect(opml).toContain('</opml>')
    expect(opml).toContain('<body>')
    expect(opml).toContain('</body>')
  })

  it('includes node text as outline attributes', () => {
    const { nodes, statusMap } = makeTestTree()
    const opml = exportToOPML(nodes, 'root', statusMap)

    expect(opml).toContain('text="Task A"')
    expect(opml).toContain('text="Subtask A1"')
    expect(opml).toContain('status="todo"')
  })

  it('includes tags attribute', () => {
    const { nodes, statusMap } = makeTestTree()
    const opml = exportToOPML(nodes, 'root', statusMap)
    expect(opml).toContain('tags="urgent"')
  })

  it('nests children correctly', () => {
    const { nodes, statusMap } = makeTestTree()
    const opml = exportToOPML(nodes, 'root', statusMap)

    // Task A has children so should not be self-closing
    expect(opml).toMatch(/<outline text="Task A"[^/]*>/)
    // Task C has no children so should be self-closing
    expect(opml).toMatch(/<outline text="Task C"[^>]*\/>/)
  })

  it('escapes XML special characters', () => {
    const nodes = new Map<string, Node>()
    nodes.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))
    nodes.set('x', makeNode({ id: 'x', parentId: 'root', pos: 'a', text: 'A & B <c> "d"' }))
    const statusMap = new Map<string, StatusDef>()
    statusMap.set('todo', { id: 'todo', label: 'Todo', color: '#000', icon: 'circle' })

    const opml = exportToOPML(nodes, 'root', statusMap)
    expect(opml).toContain('&amp;')
    expect(opml).toContain('&lt;')
    expect(opml).toContain('&gt;')
    expect(opml).toContain('&quot;')
  })

  it('respects zoomId', () => {
    const { nodes, statusMap } = makeTestTree()
    const opml = exportToOPML(nodes, 'root', statusMap, 'a')

    expect(opml).toContain('Subtask A1')
    expect(opml).not.toContain('Task B')
  })
})

describe('exportToPlaintext', () => {
  it('exports indented text', () => {
    const { nodes, statusMap } = makeTestTree()
    const txt = exportToPlaintext(nodes, 'root', statusMap)

    expect(txt).toContain('[Todo] Task A')
    expect(txt).toContain('  [In Progress] Subtask A1')
    expect(txt).toContain('[Done] Task B')
  })

  it('handles multiline text', () => {
    const { nodes, statusMap } = makeTestTree()
    const txt = exportToPlaintext(nodes, 'root', statusMap)
    const lines = txt.split('\n')

    const bIdx = lines.findIndex((l) => l.includes('Task B'))
    expect(bIdx).toBeGreaterThan(-1)
    expect(lines[bIdx + 1]).toBe('  Extra line')
  })

  it('respects zoomId', () => {
    const { nodes, statusMap } = makeTestTree()
    const txt = exportToPlaintext(nodes, 'root', statusMap, 'a')

    expect(txt).toContain('Subtask A1')
    expect(txt).not.toContain('Task B')
  })

  it('uses status label for unknown status', () => {
    const nodes = new Map<string, Node>()
    nodes.set('root', makeNode({ id: 'root', parentId: null, text: 'Root' }))
    nodes.set('x', makeNode({ id: 'x', parentId: 'root', pos: 'a', text: 'Test', status: 'custom' }))
    const statusMap = new Map<string, StatusDef>()

    const txt = exportToPlaintext(nodes, 'root', statusMap)
    expect(txt).toContain('[custom] Test')
  })
})
