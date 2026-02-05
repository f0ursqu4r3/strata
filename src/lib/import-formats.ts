import { initialRank, rankAfter } from '@/lib/rank'

/** A lightweight tree node used during import parsing. */
export interface ImportNode {
  text: string
  status?: string
  tags?: string[]
  children: ImportNode[]
}

// ── Markdown ──

/**
 * Parse a plain markdown list into ImportNode trees.
 * Handles `- ` bullet lists with 2-space indentation.
 */
export function parseMarkdownImport(content: string): ImportNode[] {
  const lines = content.split('\n')
  const root: ImportNode[] = []
  const stack: { node: ImportNode; depth: number }[] = []

  for (const rawLine of lines) {
    const match = rawLine.match(/^(\s*)[-*] (.*)$/)
    if (!match) continue

    const depth = Math.floor(match[1]!.length / 2)
    let text = match[2]!

    // Extract tags
    const tags: string[] = []
    const tagMatches = text.matchAll(/#([\w-]+)/g)
    for (const tm of tagMatches) tags.push(tm[1]!)
    if (tags.length) text = text.replace(/\s*#[\w-]+/g, '').trimEnd()

    const node: ImportNode = { text, tags, children: [] }

    // Find parent
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= depth) {
      stack.pop()
    }

    if (stack.length === 0) {
      root.push(node)
    } else {
      stack[stack.length - 1]!.node.children.push(node)
    }

    stack.push({ node, depth })
  }

  return root
}

// ── OPML ──

/**
 * Parse OPML XML into ImportNode trees.
 * Uses DOMParser for reliable XML handling.
 */
export function parseOPMLImport(content: string): ImportNode[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/xml')
  const body = doc.querySelector('body')
  if (!body) return []

  function walkOutlines(parent: Element): ImportNode[] {
    const nodes: ImportNode[] = []
    for (const outline of parent.querySelectorAll(':scope > outline')) {
      const text = outline.getAttribute('text') ?? ''
      const status = outline.getAttribute('status') ?? undefined
      const tagsAttr = outline.getAttribute('tags')
      const tags = tagsAttr ? tagsAttr.split(',').map((t) => t.trim()).filter(Boolean) : undefined
      const children = walkOutlines(outline)
      nodes.push({ text, status, tags, children })
    }
    return nodes
  }

  return walkOutlines(body)
}

// ── Plain text ──

/**
 * Parse plain text into ImportNode trees.
 * Each non-empty line becomes a node; indentation (2 spaces) creates hierarchy.
 */
export function parsePlainTextImport(content: string): ImportNode[] {
  const lines = content.split('\n')
  const root: ImportNode[] = []
  const stack: { node: ImportNode; depth: number }[] = []

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue
    const stripped = rawLine.replace(/^\s*/, '')
    const depth = Math.floor((rawLine.length - stripped.length) / 2)
    const text = stripped

    const node: ImportNode = { text, children: [] }

    while (stack.length > 0 && stack[stack.length - 1]!.depth >= depth) {
      stack.pop()
    }

    if (stack.length === 0) {
      root.push(node)
    } else {
      stack[stack.length - 1]!.node.children.push(node)
    }

    stack.push({ node, depth })
  }

  return root
}

// ── Flatten into create-ready list ──

export interface FlatImportNode {
  id: string
  parentId: string
  pos: string
  text: string
  status: string
  tags: string[]
}

/**
 * Flatten ImportNode trees into a list suitable for creating ops.
 * All nodes get parentId relative to the given `targetParentId`.
 * Returns nodes in creation order (parents before children).
 */
export function flattenImportNodes(
  trees: ImportNode[],
  targetParentId: string,
  defaultStatus: string,
  afterPos?: string,
): FlatImportNode[] {
  const result: FlatImportNode[] = []
  let lastPos = afterPos

  function walk(nodes: ImportNode[], parentId: string) {
    let siblingPos: string | undefined
    for (const node of nodes) {
      const pos = siblingPos ? rankAfter(siblingPos) : (parentId === targetParentId && lastPos ? rankAfter(lastPos) : initialRank())
      siblingPos = pos
      if (parentId === targetParentId) lastPos = pos

      const id = crypto.randomUUID()
      result.push({
        id,
        parentId,
        pos,
        text: node.text,
        status: node.status ?? defaultStatus,
        tags: node.tags ?? [],
      })

      if (node.children.length > 0) {
        walk(node.children, id)
      }
    }
  }

  walk(trees, targetParentId)
  return result
}
