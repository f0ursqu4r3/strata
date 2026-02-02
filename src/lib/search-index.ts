import type { Node } from '@/types'

const STORAGE_KEY = 'strata-search-index'

export interface SearchIndexEntry {
  docId: string
  nodeId: string
  text: string
}

export interface SearchIndex {
  version: number
  entries: SearchIndexEntry[]
  updatedAt: Record<string, number>
}

export interface SearchResult {
  docId: string
  docName: string
  nodeId: string
  text: string
  matchStart: number
  matchEnd: number
}

function defaultIndex(): SearchIndex {
  return { version: 1, entries: [], updatedAt: {} }
}

export function loadSearchIndex(): SearchIndex {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return defaultIndex()
}

export function saveSearchIndex(index: SearchIndex): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(index))
  } catch {
    // localStorage full — silently fail
  }
}

export function updateIndexForDoc(docId: string, nodes: Map<string, Node>): void {
  const index = loadSearchIndex()
  // Remove old entries for this doc
  index.entries = index.entries.filter((e) => e.docId !== docId)
  // Add new entries
  for (const node of nodes.values()) {
    if (node.deleted || node.parentId === null) continue
    if (!node.text.trim()) continue
    index.entries.push({
      docId,
      nodeId: node.id,
      text: node.text,
    })
  }
  index.updatedAt[docId] = Date.now()
  saveSearchIndex(index)
}

export function removeDocFromIndex(docId: string): void {
  const index = loadSearchIndex()
  index.entries = index.entries.filter((e) => e.docId !== docId)
  delete index.updatedAt[docId]
  saveSearchIndex(index)
}

export function searchAllDocs(
  query: string,
  docNames: Map<string, string>,
  limit = 50,
): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const index = loadSearchIndex()
  const results: SearchResult[] = []

  for (const entry of index.entries) {
    const lower = entry.text.toLowerCase()
    const idx = lower.indexOf(q)
    if (idx === -1) continue

    results.push({
      docId: entry.docId,
      docName: docNames.get(entry.docId) ?? 'Unknown',
      nodeId: entry.nodeId,
      text: entry.text,
      matchStart: idx,
      matchEnd: idx + q.length,
    })

    if (results.length >= limit) break
  }

  return results
}
