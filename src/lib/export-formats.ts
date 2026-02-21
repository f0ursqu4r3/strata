import type { Node, StatusDef } from '@/types'
import { getOrderedChildren } from '@/lib/tree-utils'

function getStatusLabel(statusId: string, statusMap: Map<string, StatusDef>): string {
  return statusMap.get(statusId)?.label ?? statusId
}

function getStatusEmoji(statusId: string, statusMap: Map<string, StatusDef>): string {
  const label = getStatusLabel(statusId, statusMap)
  // Use first char in brackets for compact display
  return `[${label.charAt(0)}]`
}

// ── Markdown ──

export function exportToMarkdown(
  nodes: Map<string, Node>,
  rootId: string,
  statusMap: Map<string, StatusDef>,
  zoomId?: string | null,
): string {
  const lines: string[] = []
  const startId = zoomId ?? rootId

  function walk(parentId: string, depth: number) {
    const children = getOrderedChildren(nodes, parentId)
    for (const child of children) {
      const indent = '  '.repeat(depth)
      const status = getStatusEmoji(child.status, statusMap)
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
  statusMap: Map<string, StatusDef>,
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
  statusMap: Map<string, StatusDef>,
  zoomId?: string | null,
): string {
  const lines: string[] = []
  const startId = zoomId ?? rootId

  function walk(parentId: string, depth: number) {
    const children = getOrderedChildren(nodes, parentId)
    for (const child of children) {
      const indent = '  '.repeat(depth)
      const status = `[${getStatusLabel(child.status, statusMap)}]`
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
