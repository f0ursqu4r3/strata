const STORAGE_KEY = 'strata-view-state'
const MAX_DOCS = 50

interface DocViewState {
  collapsed: string[]
  zoomId: string | null
}

interface StoredState {
  docs: Record<string, DocViewState & { ts: number }>
}

function load(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return { docs: {} }
}

function persist(state: StoredState) {
  const entries = Object.entries(state.docs)
  if (entries.length > MAX_DOCS) {
    entries.sort((a, b) => a[1].ts - b[1].ts)
    const toRemove = entries.length - MAX_DOCS
    for (let i = 0; i < toRemove; i++) {
      delete state.docs[entries[i]![0]]
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function saveViewState(
  docId: string,
  collapsed: string[],
  zoomId: string | null,
): void {
  const state = load()
  state.docs[docId] = { collapsed, zoomId, ts: Date.now() }
  persist(state)
}

export function loadViewState(docId: string): DocViewState | null {
  const state = load()
  const entry = state.docs[docId]
  if (!entry) return null
  return { collapsed: entry.collapsed, zoomId: entry.zoomId }
}

export function clearViewState(docId: string): void {
  const state = load()
  delete state.docs[docId]
  persist(state)
}
