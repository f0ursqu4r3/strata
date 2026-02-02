import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  loadRegistry,
  saveRegistry,
  addDoc,
  removeDoc,
  renameDoc,
  touchDoc,
  setActiveDoc,
  type DocumentMeta,
  type DocumentRegistry,
} from '@/lib/doc-registry'
import { migrateOldDB, deleteDocDB, setCurrentDocId } from '@/lib/idb'
import { removeDocFromIndex } from '@/lib/search-index'

export const useDocumentsStore = defineStore('documents', () => {
  const documents = ref<DocumentMeta[]>([])
  const activeId = ref<string>('')

  const sortedDocuments = computed(() =>
    [...documents.value].sort((a, b) => b.lastModified - a.lastModified),
  )

  async function init(): Promise<string> {
    // Migrate old single-database if it exists
    const migratedId = await migrateOldDB()
    if (migratedId) {
      const registry: DocumentRegistry = {
        documents: [
          {
            id: migratedId,
            name: 'My Document',
            createdAt: Date.now(),
            lastModified: Date.now(),
          },
        ],
        activeDocumentId: migratedId,
      }
      saveRegistry(registry)
    }

    const registry = loadRegistry()
    documents.value = registry.documents

    // If no documents exist, create a default one
    if (documents.value.length === 0) {
      const meta = addDoc('My Document')
      documents.value = [meta]
      activeId.value = meta.id
    } else {
      activeId.value = registry.activeDocumentId ?? documents.value[0]!.id
    }

    setCurrentDocId(activeId.value)
    return activeId.value
  }

  function createDocument(name: string): string {
    const meta = addDoc(name)
    documents.value = loadRegistry().documents
    return meta.id
  }

  async function switchDocument(docId: string): Promise<void> {
    setActiveDoc(docId)
    setCurrentDocId(docId)
    activeId.value = docId
    touchDoc(docId)
    documents.value = loadRegistry().documents
  }

  function renameDocument(docId: string, name: string): void {
    renameDoc(docId, name)
    documents.value = loadRegistry().documents
  }

  async function deleteDocument(docId: string): Promise<void> {
    // Don't delete the last document
    if (documents.value.length <= 1) return

    // If deleting active, switch to another first
    if (activeId.value === docId) {
      const other = documents.value.find((d) => d.id !== docId)
      if (other) {
        await switchDocument(other.id)
      }
    }

    removeDoc(docId)
    removeDocFromIndex(docId)
    await deleteDocDB(docId)
    documents.value = loadRegistry().documents
  }

  function touch(): void {
    touchDoc(activeId.value)
    documents.value = loadRegistry().documents
  }

  return {
    documents,
    activeId,
    sortedDocuments,
    init,
    createDocument,
    switchDocument,
    renameDocument,
    deleteDocument,
    touch,
  }
})
