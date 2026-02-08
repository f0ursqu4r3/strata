import { ref, computed, nextTick } from 'vue'
import { useDocumentsStore } from '@/stores/documents'

export function useDocumentRename() {
  const docsStore = useDocumentsStore()

  const renamingId = ref<string | null>(null)
  const renameInputRef = ref<HTMLInputElement[]>([])
  const renameText = ref('')

  const renameConflict = computed(() => {
    if (!renamingId.value || !renameText.value.trim()) return false
    return docsStore.nameConflicts(renameText.value.trim(), renamingId.value)
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
    nextTick(() => {
      renameInputRef.value[0]?.focus()
      renameInputRef.value[0]?.select()
    })
  }

  function finishRename() {
    if (renamingId.value && renameText.value.trim() && !renameConflict.value) {
      docsStore.renameDocument(renamingId.value, renameText.value.trim())
    }
    renamingId.value = null
  }

  function onRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      finishRename()
    } else if (e.key === 'Escape') {
      renamingId.value = null
    }
  }

  return {
    renamingId,
    renameInputRef,
    renameText,
    renameConflict,
    baseName,
    dirPrefix,
    startRename,
    finishRename,
    onRenameKeydown,
  }
}
