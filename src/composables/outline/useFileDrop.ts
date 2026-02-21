import { ref, type Ref } from 'vue'
import { useDocStore } from '@/stores/doc'

export function useFileDrop(dragNodeId: Ref<string | null>) {
  const store = useDocStore()
  const fileDragOver = ref(false)

  function onFileDragOver(e: DragEvent) {
    if (!e.dataTransfer?.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    fileDragOver.value = true
  }

  function onFileDragLeave() {
    fileDragOver.value = false
  }

  async function onFileDrop(e: DragEvent) {
    fileDragOver.value = false
    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return
    // Only handle file drops (not row drags)
    if (dragNodeId.value) return
    e.preventDefault()

    const { parseMarkdownImport, parseOPMLImport, parsePlainTextImport, flattenImportNodes } =
      await import('@/lib/import-formats')

    const targetParentId = store.selection.current
      ? (store.nodes.get(store.selection.current)?.parentId ?? store.effectiveZoomId)
      : store.effectiveZoomId
    const defaultStatus = store.statusDefs[0]?.id ?? 'todo'

    // Find last child pos for ordering after existing children
    const siblings = store.getChildren(targetParentId)
    const afterPos = siblings.length > 0 ? siblings[siblings.length - 1]!.pos : undefined

    for (const file of Array.from(files)) {
      const text = await file.text()
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      let trees

      if (ext === 'json') {
        // Use existing full JSON import
        try {
          await store.importJSON(text)
        } catch (err) {
          alert('Failed to import JSON: ' + (err as Error).message)
        }
        continue
      } else if (ext === 'opml') {
        trees = parseOPMLImport(text)
      } else if (ext === 'md' || ext === 'markdown') {
        trees = parseMarkdownImport(text)
      } else {
        // Plain text fallback
        trees = parsePlainTextImport(text)
      }

      if (trees && trees.length > 0) {
        const flat = flattenImportNodes(trees, targetParentId, defaultStatus, afterPos)
        await store.importNodes(flat)
      }
    }
  }

  return { fileDragOver, onFileDragOver, onFileDragLeave, onFileDrop }
}
