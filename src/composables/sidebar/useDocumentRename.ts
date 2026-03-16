import { ref, computed, nextTick } from 'vue'
import { useDocumentsStore } from '@/stores/documents'

const TEMP_FOLDER_PREFIX = '_new-folder-'

function isTempFolder(id: string): boolean {
  const name = id.includes('/') ? id.substring(id.lastIndexOf('/') + 1) : id
  return name.startsWith(TEMP_FOLDER_PREFIX)
}

export function useDocumentRename() {
  const docsStore = useDocumentsStore()

  const renamingId = ref<string | null>(null)
  const renameInputRef = ref<HTMLInputElement[]>([])
  const renameText = ref('')
  // When true, finishing with an empty name discards the item
  const isNewDoc = ref(false)

  const renameConflict = computed(() => {
    if (!renamingId.value || !renameText.value.trim()) return false
    const id = renamingId.value
    if (isTempFolder(id) || docsStore.isDraft(id)) {
      // Check if a doc/folder with this name already exists
      return docsStore.nameConflicts(renameText.value.trim(), id)
    }
    return docsStore.nameConflicts(renameText.value.trim(), id)
  })

  function baseName(name: string): string {
    const slash = name.lastIndexOf('/')
    return slash >= 0 ? name.substring(slash + 1) : name
  }

  function dirPrefix(name: string): string {
    const slash = name.lastIndexOf('/')
    return slash >= 0 ? name.substring(0, slash + 1) : ''
  }

  function startRename(docId: string, name: string, e: MouseEvent) {
    e.stopPropagation()
    renamingId.value = docId
    renameText.value = baseName(name)
    isNewDoc.value = false
    nextTick(() => {
      renameInputRef.value[0]?.focus()
      renameInputRef.value[0]?.select()
    })
  }

  function startNewDocRename(docId: string, name: string) {
    renamingId.value = docId
    renameText.value = name
    isNewDoc.value = true
    nextTick(() => {
      renameInputRef.value[0]?.focus()
      renameInputRef.value[0]?.select()
    })
  }

  async function finishRename() {
    const id = renamingId.value
    const newItem = isNewDoc.value
    const trimmed = renameText.value.trim()

    renamingId.value = null
    isNewDoc.value = false

    if (!id) return

    if (newItem && isTempFolder(id)) {
      // New folder flow: rename temp folder or delete it
      if (trimmed) {
        const parentPath = id.includes('/') ? id.substring(0, id.lastIndexOf('/')) : ''
        const newPath = parentPath ? `${parentPath}/${trimmed}` : trimmed
        await docsStore.renameFolder(id, newPath)
      } else {
        await docsStore.deleteFolder(id)
      }
    } else if (newItem && docsStore.isDraft(id)) {
      // New doc flow: save draft to workspace or discard
      if (trimmed && !renameConflict.value) {
        await docsStore.saveDraft(id, trimmed)
      } else if (!trimmed) {
        await docsStore.discardDraft(id)
      }
    } else {
      // Regular rename
      if (trimmed && !renameConflict.value) {
        docsStore.renameDocument(id, trimmed)
      }
    }
  }

  async function onRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      await finishRename()
    } else if (e.key === 'Escape') {
      const id = renamingId.value
      const newItem = isNewDoc.value
      renamingId.value = null
      isNewDoc.value = false
      if (id && newItem) {
        if (isTempFolder(id)) {
          await docsStore.deleteFolder(id)
        } else if (docsStore.isDraft(id)) {
          await docsStore.discardDraft(id)
        }
      }
    }
  }

  return {
    renamingId,
    renameInputRef,
    renameText,
    renameConflict,
    isNewDoc,
    baseName,
    dirPrefix,
    startRename,
    startNewDocRename,
    finishRename,
    onRenameKeydown,
  }
}
