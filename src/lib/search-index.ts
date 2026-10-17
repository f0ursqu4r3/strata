import type { Node } from '@/types'

// Each document's entries live under their own key, so an edit rewrites
// only that document's index instead of the whole workspace's.
const KEY_PREFIX = 'strata-search-index:'
// Single-key format used before per-document storage; migrated on first load
const LEGACY_KEY = 'strata-search-index'

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

interface StoredDocIndex {
  updatedAt: number
  entries: { nodeId: string; text: string }[]
}

interface CachedDocIndex {
  updatedAt: number
  entries: SearchIndexEntry[]
  // Lowercased text, parallel to entries — avoids toLowerCase per entry per keystroke
  lower: string[]
  // Serialized entries, to skip writes when nothing changed
  entriesRaw: string
}

// In-memory cache — avoids JSON.parse on every search keystroke
let cache: Map<string, CachedDocIndex> | null = null

/** Clear the in-memory cache (used by tests). */
export function clearSearchIndexCache(): void {
  cache = null
}

function toCached(docId: string, stored: StoredDocIndex, entriesRaw: string): CachedDocIndex {
  const entries = stored.entries.map((e) => ({ docId, nodeId: e.nodeId, text: e.text }))
  return {
    updatedAt: stored.updatedAt,
    entries,
    lower: entries.map((e) => e.text.toLowerCase()),
    entriesRaw,
  }
}

function writeDoc(
  docId: string,
  stored: StoredDocIndex,
  entriesRaw = JSON.stringify(stored.entries),
): CachedDocIndex {
  try {
    localStorage.setItem(
      KEY_PREFIX + docId,
      `{"updatedAt":${stored.updatedAt},"entries":${entriesRaw}}`,
    )
  } catch {
    // localStorage full — silently fail
  }
  return toCached(docId, stored, entriesRaw)
}

function migrateLegacy(map: Map<string, CachedDocIndex>): void {
  let legacy: SearchIndex | null = null
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (raw) legacy = JSON.parse(raw)
  } catch {
    // ignore invalid legacy data
  }
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // ignore
  }
  if (!legacy || !Array.isArray(legacy.entries)) return

  const byDoc = new Map<string, StoredDocIndex>()
  for (const e of legacy.entries) {
    let doc = byDoc.get(e.docId)
    if (!doc) {
      doc = { updatedAt: legacy.updatedAt?.[e.docId] ?? Date.now(), entries: [] }
      byDoc.set(e.docId, doc)
    }
    doc.entries.push({ nodeId: e.nodeId, text: e.text })
  }
  for (const [docId, stored] of byDoc) {
    if (!map.has(docId)) map.set(docId, writeDoc(docId, stored))
  }
}

function loadCache(): Map<string, CachedDocIndex> {
  if (cache) return cache
  const map = new Map<string, CachedDocIndex>()
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(KEY_PREFIX)) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const docId = key.slice(KEY_PREFIX.length)
        const stored = JSON.parse(raw) as StoredDocIndex
        map.set(docId, toCached(docId, stored, JSON.stringify(stored.entries)))
      } catch {
        // skip invalid document entry
      }
    }
    migrateLegacy(map)
  } catch {
    // localStorage unavailable
  }
  cache = map
  return cache
}

/** Combined view of all documents' entries. */
export function loadSearchIndex(): SearchIndex {
  const index: SearchIndex = { version: 2, entries: [], updatedAt: {} }
  for (const [docId, doc] of loadCache()) {
    index.entries.push(...doc.entries)
    index.updatedAt[docId] = doc.updatedAt
  }
  return index
}

export function updateIndexForDoc(docId: string, nodes: Map<string, Node>): void {
  const map = loadCache()
  const entries: StoredDocIndex['entries'] = []
  for (const node of nodes.values()) {
    if (node.deleted || node.parentId === null) continue
    if (!node.text.trim()) continue
    entries.push({ nodeId: node.id, text: node.text })
  }
  // Skip the write when this document's entries did not change
  const entriesRaw = JSON.stringify(entries)
  if (map.get(docId)?.entriesRaw === entriesRaw) return
  map.set(docId, writeDoc(docId, { updatedAt: Date.now(), entries }, entriesRaw))
}

export function removeDocFromIndex(docId: string): void {
  loadCache().delete(docId)
  try {
    localStorage.removeItem(KEY_PREFIX + docId)
  } catch {
    // ignore
  }
}

export function searchAllDocs(
  query: string,
  docNames: Map<string, string>,
  limit = 50,
): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const results: SearchResult[] = []

  for (const [docId, doc] of loadCache()) {
    for (let i = 0; i < doc.entries.length; i++) {
      const idx = doc.lower[i]!.indexOf(q)
      if (idx === -1) continue
      const entry = doc.entries[i]!

      results.push({
        docId,
        docName: docNames.get(docId) ?? 'Unknown',
        nodeId: entry.nodeId,
        text: entry.text,
        matchStart: idx,
        matchEnd: idx + q.length,
      })

      if (results.length >= limit) return results
    }
  }

  return results
}
