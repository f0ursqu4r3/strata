const REGISTRY_KEY = 'strata-doc-registry'

export interface DocumentMeta {
  id: string
  name: string
  createdAt: number
  lastModified: number
}

export interface DocumentRegistry {
  documents: DocumentMeta[]
  activeDocumentId: string | null
}

function defaultRegistry(): DocumentRegistry {
  return { documents: [], activeDocumentId: null }
}

export function loadRegistry(): DocumentRegistry {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return defaultRegistry()
}

export function saveRegistry(registry: DocumentRegistry): void {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry))
}

export function addDoc(name: string): DocumentMeta {
  const registry = loadRegistry()
  const meta: DocumentMeta = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    lastModified: Date.now(),
  }
  registry.documents.push(meta)
  registry.activeDocumentId = meta.id
  saveRegistry(registry)
  return meta
}

export function removeDoc(id: string): void {
  const registry = loadRegistry()
  registry.documents = registry.documents.filter((d) => d.id !== id)
  if (registry.activeDocumentId === id) {
    registry.activeDocumentId = registry.documents[0]?.id ?? null
  }
  saveRegistry(registry)
}

export function renameDoc(id: string, name: string): void {
  const registry = loadRegistry()
  const doc = registry.documents.find((d) => d.id === id)
  if (doc) {
    doc.name = name
    doc.lastModified = Date.now()
    saveRegistry(registry)
  }
}

export function touchDoc(id: string): void {
  const registry = loadRegistry()
  const doc = registry.documents.find((d) => d.id === id)
  if (doc) {
    doc.lastModified = Date.now()
    saveRegistry(registry)
  }
}

export function setActiveDoc(id: string): void {
  const registry = loadRegistry()
  registry.activeDocumentId = id
  saveRegistry(registry)
}

export function getActiveDocId(): string | null {
  return loadRegistry().activeDocumentId
}
