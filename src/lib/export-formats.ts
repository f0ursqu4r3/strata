import type { Node, Status } from '@/types'

function getOrderedChildren(nodes: Map<string, Node>, parentId: string): Node[] {
  const children: Node[] = []
  for (const node of nodes.values()) {
    if (node.parentId === parentId && !node.deleted) {
      children.push(node)
    }
  }
  return children.sort((a, b) => (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0))
}

const statusEmoji: Record<Status, string> = {
  todo: '[ ]',
  in_progress: '[~]',
  blocked: '[!]',
  done: '[x]',
}

const statusLabel: Record<Status, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
}

// ── Markdown ──

export function exportToMarkdown(
  nodes: Map<string, Node>,
  rootId: string,
  zoomId?: string | null,
): string {
  const lines: string[] = []
  const startId = zoomId ?? rootId

  function walk(parentId: string, depth: number) {
    const children = getOrderedChildren(nodes, parentId)
    for (const child of children) {
      const indent = '  '.repeat(depth)
      const status = statusEmoji[child.status]
      const text = child.text || '(empty)'
      const firstLine = text.split('\n')[0]!
      const tags = child.tags?.length ? ' ' + child.tags.map((t) => `#${t}`).join(' ') : ''
      lines.push(`${indent}- ${status} ${firstLine}${tags}`)

      // Additional lines as continuation
      const extraLines = text.split('\n').slice(1)
      for (const line of extraLines) {
        lines.push(`${indent}  ${line}`)
      }

      walk(child.id, depth + 1)
    }
  }

  walk(startId, 0)
  return lines.join('\n') + '\n'
}

// ── OPML ──

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function exportToOPML(
  nodes: Map<string, Node>,
  rootId: string,
  zoomId?: string | null,
): string {
  const lines: string[] = []
  const startId = zoomId ?? rootId
  const startNode = nodes.get(startId)
  const title = startNode ? escapeXml(startNode.text || 'Strata Export') : 'Strata Export'

  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<opml version="2.0">')
  lines.push('  <head>')
  lines.push(`    <title>${title}</title>`)
  lines.push('  </head>')
  lines.push('  <body>')

  function walk(parentId: string, depth: number) {
    const children = getOrderedChildren(nodes, parentId)
    const indent = '    '.repeat(depth + 1)
    for (const child of children) {
      const text = escapeXml(child.text || '(empty)')
      const status = escapeXml(child.status)
      const tags = child.tags?.length ? ` tags="${escapeXml(child.tags.join(','))}"` : ''
      const hasChildren = getOrderedChildren(nodes, child.id).length > 0

      if (hasChildren) {
        lines.push(`${indent}<outline text="${text}" status="${status}"${tags}>`)
        walk(child.id, depth + 1)
        lines.push(`${indent}</outline>`)
      } else {
        lines.push(`${indent}<outline text="${text}" status="${status}"${tags} />`)
      }
    }
  }

  walk(startId, 0)
  lines.push('  </body>')
  lines.push('</opml>')
  return lines.join('\n') + '\n'
}

// ── Plain text ──

export function exportToPlaintext(
  nodes: Map<string, Node>,
  rootId: string,
  zoomId?: string | null,
): string {
  const lines: string[] = []
  const startId = zoomId ?? rootId

  function walk(parentId: string, depth: number) {
    const children = getOrderedChildren(nodes, parentId)
    for (const child of children) {
      const indent = '  '.repeat(depth)
      const status = `[${statusLabel[child.status]}]`
      const text = child.text || '(empty)'
      const firstLine = text.split('\n')[0]!
      lines.push(`${indent}${status} ${firstLine}`)

      const extraLines = text.split('\n').slice(1)
      for (const line of extraLines) {
        lines.push(`${indent}  ${line}`)
      }

      walk(child.id, depth + 1)
    }
  }

  walk(startId, 0)
  return lines.join('\n') + '\n'
}
