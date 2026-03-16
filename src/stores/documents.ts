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
import { isTauri, isFileSystemMode, isSingleFileMode } from '@/lib/platform'
import { serializeToMarkdown } from '@/lib/markdown-serialize'
import { DEFAULT_STATUSES } from '@/types'

function emptyStrataDoc(): string {
  return serializeToMarkdown({
    nodes: new Map(),
    rootId: 'root',
    statusConfig: [...DEFAULT_STATUSES],
  })
}

export const useDocumentsStore = defineStore('documents', () => {
  const documents = ref<DocumentMeta[]>([])
  const activeId = ref<string>('')
  const folders = ref<string[]>([])

  /** Generate a unique document name like "Untitled", "Untitled 2", etc. */
  function nextUntitledName(): string {
    const names = new Set(
      documents.value.map((d) => {
        // Use base name without directory prefix or .md extension
        const n = d.name
        const slash = n.lastIndexOf('/')
        return slash >= 0 ? n.substring(slash + 1) : n
      }),
    )
    if (!names.has('Untitled')) return 'Untitled'
    let i = 2
    while (names.has(`Untitled ${i}`)) i++
    return `Untitled ${i}`
  }

  const sortedDocuments = computed(() =>
    [...documents.value].sort((a, b) => a.name.localeCompare(b.name)),
  )

  async function init(): Promise<string> {
    if (isSingleFileMode()) {
      return initSingleFile()
    }
    if (isFileSystemMode()) {
      return initFromFilesystem()
    }
    return initFromRegistry()
  }

  // ── Single-file mode ──

  async function initSingleFile(): Promise<string> {
    const { useSettingsStore } = await import('@/stores/settings')
    const settings = useSettingsStore()
    const filePath = settings.singleFilePath
    if (!filePath) return ''

    // Extract filename for display
    const fileName = filePath.includes('/')
      ? filePath.substring(filePath.lastIndexOf('/') + 1)
      : filePath

    const docId = fileName
    documents.value = [
      {
        id: docId,
        name: fileName.replace(/\.md$/, ''),
        createdAt: 0,
        lastModified: 0,
      },
    ]
    activeId.value = docId
    return docId
  }

  // ── Web mode: localStorage registry (existing behavior) ──

  async function initFromRegistry(): Promise<string> {
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

  // ── Filesystem mode (Tauri native or browser File System Access API) ──

  async function initFromFilesystem(): Promise<string> {
    const { useSettingsStore } = await import('@/stores/settings')
    const settings = useSettingsStore()
    const workspace = settings.workspacePath

    if (!workspace) {
      // No workspace chosen yet — UI will show WorkspacePicker
      return ''
    }

    let files: string[]
    try {
      const fs = await import('@/lib/fs')
      files = await fs.listWorkspaceFiles(workspace)
    } catch (err) {
      console.error('[strata] Failed to list workspace files:', err)
      files = []
    }

    // Also load draft files from .strata/drafts/
    let draftFiles: string[] = []
    if (isTauri()) {
      try {
        const { listDraftFiles } = await import('@/lib/tauri-fs')
        draftFiles = await listDraftFiles(workspace)
      } catch {
        // .strata/drafts/ doesn't exist yet — that's fine
      }
    }

    documents.value = [
      ...files.map((relPath) => ({
        id: relPath,
        name: relPath.replace(/\.md$/, ''),
        createdAt: 0,
        lastModified: 0,
      })),
      ...draftFiles.map((relPath) => ({
        id: relPath,
        name: draftDisplayName(relPath),
        createdAt: Date.now(),
        lastModified: Date.now(),
      })),
    ]
    activeId.value = files[0] ?? draftFiles[0] ?? ''

    await loadFolders()

    return activeId.value
  }

  function createDocument(name: string, folder?: string): string {
    if (isFileSystemMode()) {
      return createDocumentFile(name, folder)
    }
    const meta = addDoc(name)
    documents.value = loadRegistry().documents
    return meta.id
  }

  function createDocumentFile(name: string, folder?: string): string {
    const relPath = folder ? `${folder}/${name}.md` : `${name}.md`
    const displayName = folder ? `${folder}/${name}` : name
    // Write is async but we return the id synchronously; the file will be created when the doc store inits
    import('@/lib/fs').then(({ writeFile, ensureDir }) => {
      import('@/stores/settings').then(({ useSettingsStore }) => {
        const settings = useSettingsStore()
        const promise = folder
          ? ensureDir(`${settings.workspacePath}/${folder}`)
          : Promise.resolve()
        promise.then(() => {
          writeFile(`${settings.workspacePath}/${relPath}`, emptyStrataDoc())
        })
      })
    })
    documents.value = [
      ...documents.value,
      {
        id: relPath,
        name: displayName,
        createdAt: Date.now(),
        lastModified: Date.now(),
      },
    ]
    return relPath
  }

  // ── Draft documents ──

  const DRAFT_PREFIX = '.strata/drafts/'

  function isDraft(docId: string): boolean {
    return docId.startsWith(DRAFT_PREFIX)
  }

  function draftDisplayName(relPath: string): string {
    // Show "Untitled" style name, not the UUID filename
    return relPath.replace(DRAFT_PREFIX, '').replace(/\.md$/, '')
  }

  function createDraft(): string {
    const uuid = crypto.randomUUID().slice(0, 8)
    const name = nextUntitledName()
    const relPath = `${DRAFT_PREFIX}${uuid}.md`

    // Write the draft file asynchronously
    import('@/lib/fs').then(({ writeFile, ensureDir }) => {
      import('@/stores/settings').then(({ useSettingsStore }) => {
        const settings = useSettingsStore()
        ensureDir(`${settings.workspacePath}/.strata/drafts`).then(() => {
          writeFile(`${settings.workspacePath}/${relPath}`, emptyStrataDoc())
        })
      })
    })

    documents.value = [
      ...documents.value,
      {
        id: relPath,
        name,
        createdAt: Date.now(),
        lastModified: Date.now(),
      },
    ]
    return relPath
  }

  async function saveDraft(draftId: string, name: string, folder?: string): Promise<string> {
    if (!isDraft(draftId)) return draftId

    const { readFile, writeFile, deleteFile, ensureDir } = await import('@/lib/fs')
    const { useSettingsStore } = await import('@/stores/settings')
    const settings = useSettingsStore()
    const workspace = settings.workspacePath

    // Read existing draft content
    const content = await readFile(`${workspace}/${draftId}`)

    // Build new path in workspace
    const newRelPath = folder ? `${folder}/${name}.md` : `${name}.md`

    // Ensure target folder exists
    if (folder) {
      await ensureDir(`${workspace}/${folder}`)
    }

    // Write to new location
    await writeFile(`${workspace}/${newRelPath}`, content)

    // Delete draft file
    await deleteFile(`${workspace}/${draftId}`)

    // Update documents list
    documents.value = documents.value.map((d) =>
      d.id === draftId
        ? { ...d, id: newRelPath, name: newRelPath.replace(/\.md$/, '') }
        : d,
    )

    // Update active ID if this was the active doc
    if (activeId.value === draftId) {
      activeId.value = newRelPath
    }

    return newRelPath
  }

  async function discardDraft(draftId: string): Promise<void> {
    if (!isDraft(draftId)) return
    await deleteDocument(draftId)
  }

  async function renameFolder(oldPath: string, newPath: string): Promise<void> {
    if (!isFileSystemMode()) return
    const { renameFile, ensureDir } = await import('@/lib/fs')
    const { useSettingsStore } = await import('@/stores/settings')
    const settings = useSettingsStore()
    const workspace = settings.workspacePath

    // Ensure parent of new path exists
    const parentOfNew = newPath.includes('/') ? newPath.substring(0, newPath.lastIndexOf('/')) : ''
    if (parentOfNew) {
      await ensureDir(`${workspace}/${parentOfNew}`)
    }

    await renameFile(`${workspace}/${oldPath}`, `${workspace}/${newPath}`)

    // Update folders list
    folders.value = folders.value.map((f) =>
      f === oldPath ? newPath : f.startsWith(oldPath + '/') ? newPath + f.substring(oldPath.length) : f,
    )
    if (!folders.value.includes(newPath)) {
      folders.value = [...folders.value, newPath]
    }

    // Update any documents that were inside this folder
    documents.value = documents.value.map((d) => {
      if (d.id.startsWith(oldPath + '/')) {
        const newId = newPath + d.id.substring(oldPath.length)
        return { ...d, id: newId, name: newId.replace(/\.md$/, '') }
      }
      return d
    })
  }

  async function deleteFolder(folderPath: string): Promise<void> {
    if (!isFileSystemMode()) return
    const { deleteFile } = await import('@/lib/fs')
    const { useSettingsStore } = await import('@/stores/settings')
    const settings = useSettingsStore()
    try {
      await deleteFile(`${settings.workspacePath}/${folderPath}`)
    } catch {
      // Folder might not exist on disk if it was just created
    }
    folders.value = folders.value.filter((f) => f !== folderPath && !f.startsWith(folderPath + '/'))
  }

  async function loadFolders(): Promise<void> {
    if (!isFileSystemMode() || isSingleFileMode()) return
    const { useSettingsStore } = await import('@/stores/settings')
    const settings = useSettingsStore()
    if (!settings.workspacePath) return
    try {
      const { listSubdirs } = await import('@/lib/fs')
      folders.value = await listSubdirs(settings.workspacePath)
    } catch (err) {
      console.error('[strata] Failed to list subdirs:', err)
      folders.value = []
    }
  }

  async function createFolder(folderPath: string): Promise<void> {
    const { ensureDir } = await import('@/lib/fs')
    const { useSettingsStore } = await import('@/stores/settings')
    const settings = useSettingsStore()
    await ensureDir(`${settings.workspacePath}/${folderPath}`)
    await loadFolders()
  }

  async function switchDocument(docId: string): Promise<void> {
    if (!isFileSystemMode()) {
      setActiveDoc(docId)
      setCurrentDocId(docId)
    }
    activeId.value = docId
    if (!isFileSystemMode()) {
      touchDoc(docId)
      documents.value = loadRegistry().documents
    }
  }

  /** Check if a document name already exists (case-insensitive for filesystem safety). */
  function nameConflicts(name: string, excludeId?: string): boolean {
    return documents.value.some((d) => {
      if (excludeId && d.id === excludeId) return false
      const n = d.name
      const slash = n.lastIndexOf('/')
      const base = slash >= 0 ? n.substring(slash + 1) : n
      return base.toLowerCase() === name.toLowerCase()
    })
  }

  function renameDocument(docId: string, name: string): void {
    if (nameConflicts(name, docId)) return // silently skip if name taken
    if (isFileSystemMode()) {
      renameDocumentFile(docId, name)
      return
    }
    renameDoc(docId, name)
    documents.value = loadRegistry().documents
  }

  async function renameDocumentFile(oldId: string, newName: string): Promise<void> {
    const { renameFile } = await import('@/lib/fs')
    const { useSettingsStore } = await import('@/stores/settings')
    const settings = useSettingsStore()
    // Preserve directory prefix from old ID (e.g., "notes/Old.md" → "notes/")
    const dirPrefix = oldId.includes('/') ? oldId.substring(0, oldId.lastIndexOf('/') + 1) : ''
    const newRelPath = `${dirPrefix}${newName}.md`
    await renameFile(
      `${settings.workspacePath}/${oldId}`,
      `${settings.workspacePath}/${newRelPath}`,
    )
    documents.value = documents.value.map((d) =>
      d.id === oldId ? { ...d, id: newRelPath, name: newRelPath.replace(/\.md$/, '') } : d,
    )
    if (activeId.value === oldId) {
      activeId.value = newRelPath
    }
  }

  async function deleteDocument(docId: string): Promise<void> {
    if (activeId.value === docId) {
      const other = documents.value.find((d) => d.id !== docId)
      if (other) {
        await switchDocument(other.id)
      } else {
        activeId.value = ''
      }
    }

    if (isFileSystemMode()) {
      const { deleteFile } = await import('@/lib/fs')
      const { useSettingsStore } = await import('@/stores/settings')
      const settings = useSettingsStore()
      await deleteFile(`${settings.workspacePath}/${docId}`)
      documents.value = documents.value.filter((d) => d.id !== docId)
    } else {
      removeDoc(docId)
      removeDocFromIndex(docId)
      await deleteDocDB(docId)
      documents.value = loadRegistry().documents
    }
  }

  function touch(): void {
    if (isFileSystemMode()) return // no-op in file mode
    touchDoc(activeId.value)
    documents.value = loadRegistry().documents
  }

  // ── File watching ──

  let unlistenHandles: Array<() => void> = []

  async function setupFileWatching(pathOrWorkspace: string) {
    if (isSingleFileMode()) {
      await setupSingleFileWatching(pathOrWorkspace)
      return
    }
    if (isTauri()) {
      await setupTauriFileWatching(pathOrWorkspace)
    } else {
      await setupWebFileWatching()
    }
  }

  async function setupSingleFileWatching(filePath: string) {
    if (isTauri()) {
      const { startWatchingFile } = await import('@/lib/tauri-fs')
      const { listen } = await import('@tauri-apps/api/event')
      await startWatchingFile(filePath)
      unlistenHandles.push(
        await listen<{ relPath: string }>('fs:modified', (e) => onFileModified(e.payload.relPath)),
      )
    } else {
      const { startWatchingSingleFile, onFsEvent } = await import('@/lib/web-fs')
      await startWatchingSingleFile()
      unlistenHandles.push(onFsEvent('modified', onFileModified))
    }
  }

  function onFileCreated(relPath: string) {
    if (!documents.value.find((d) => d.id === relPath)) {
      documents.value = [
        ...documents.value,
        {
          id: relPath,
          name: relPath.replace(/\.md$/, ''),
          createdAt: Date.now(),
          lastModified: Date.now(),
        },
      ]
    }
  }

  function onFileDeleted(relPath: string) {
    documents.value = documents.value.filter((d) => d.id !== relPath)
    if (activeId.value === relPath) {
      const other = documents.value[0]
      if (other) switchDocument(other.id)
    }
  }

  async function onFileModified(relPath: string) {
    if (relPath === activeId.value) {
      const { useDocStore } = await import('@/stores/doc')
      const docStore = useDocStore()
      if (!docStore.hasUnsavedChanges() && !docStore.recentlyWritten()) {
        docStore.refreshFromFile()
      }
    }
  }

  async function setupTauriFileWatching(workspace: string) {
    const { startWatching } = await import('@/lib/tauri-fs')
    const { listen } = await import('@tauri-apps/api/event')

    await startWatching(workspace)

    unlistenHandles.push(
      await listen<{ relPath: string }>('fs:created', (e) => onFileCreated(e.payload.relPath)),
      await listen<{ relPath: string }>('fs:deleted', (e) => onFileDeleted(e.payload.relPath)),
      await listen<{ relPath: string }>('fs:modified', (e) => onFileModified(e.payload.relPath)),
    )
  }

  async function setupWebFileWatching() {
    const { startWatching, onFsEvent } = await import('@/lib/web-fs')

    await startWatching()

    unlistenHandles.push(
      onFsEvent('created', onFileCreated),
      onFsEvent('deleted', onFileDeleted),
      onFsEvent('modified', onFileModified),
    )
  }

  async function teardownFileWatching() {
    for (const unlisten of unlistenHandles) {
      unlisten()
    }
    unlistenHandles = []
    const { stopWatching } = await import('@/lib/fs')
    await stopWatching()
  }

  return {
    documents,
    activeId,
    folders,
    sortedDocuments,
    init,
    createDocument,
    createDraft,
    saveDraft,
    discardDraft,
    isDraft,
    renameFolder,
    deleteFolder,
    switchDocument,
    renameDocument,
    nameConflicts,
    nextUntitledName,
    deleteDocument,
    touch,
    loadFolders,
    createFolder,
    setupFileWatching,
    teardownFileWatching,
  }
})
