import { type Ref, type ShallowRef } from 'vue'
import type { Node, StatusDef } from '@/types'
import { FILE_SAVE_DELAY, WRITE_COOLDOWN, INDEX_UPDATE_DELAY } from '@/lib/constants'
import { updateIndexForDoc } from '@/lib/search-index'
import { isFileSystemMode, isSingleFileMode } from '@/lib/platform'
import { serializeToMarkdown } from '@/lib/markdown-serialize'

interface DocSyncDeps {
  nodes: ShallowRef<Map<string, Node>>
  rootId: Ref<string>
  statusConfig: Ref<StatusDef[]>
  tagColors: Ref<Record<string, string>>
  currentDocId: Ref<string>
  flushTextDebounce: () => void
}

export function useDocSync(deps: DocSyncDeps) {
  let _fileSaveTimer: ReturnType<typeof setTimeout> | null = null
  let _lastWriteAt = 0
  let _indexTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleIndexUpdate() {
    if (_indexTimer) clearTimeout(_indexTimer)
    _indexTimer = setTimeout(() => {
      _indexTimer = null
      if (deps.currentDocId.value) {
        updateIndexForDoc(deps.currentDocId.value, deps.nodes.value)
      }
    }, INDEX_UPDATE_DELAY)
  }

  function scheduleFileSave() {
    if (!isFileSystemMode()) return
    if (_fileSaveTimer) clearTimeout(_fileSaveTimer)
    _fileSaveTimer = setTimeout(() => {
      _fileSaveTimer = null
      saveToFile()
    }, FILE_SAVE_DELAY)
  }

  function hasUnsavedChanges(): boolean {
    return _fileSaveTimer !== null
  }

  function recentlyWritten(): boolean {
    return Date.now() - _lastWriteAt < WRITE_COOLDOWN
  }

  async function getFilePath(): Promise<string | null> {
    const { useSettingsStore } = await import('@/stores/settings')
    const settings = useSettingsStore()
    if (isSingleFileMode()) {
      return settings.singleFilePath || null
    }
    if (!settings.workspacePath || !deps.currentDocId.value) return null
    return `${settings.workspacePath}/${deps.currentDocId.value}`
  }

  async function saveToFile() {
    if (!isFileSystemMode() || !deps.currentDocId.value) return
    deps.flushTextDebounce()
    const filePath = await getFilePath()
    if (!filePath) return
    const { writeFile } = await import('@/lib/fs')
    const content = serializeToMarkdown({
      nodes: deps.nodes.value,
      rootId: deps.rootId.value,
      statusConfig: deps.statusConfig.value,
      tagColors: deps.tagColors.value,
    })
    await writeFile(filePath, content)
    _lastWriteAt = Date.now()
  }

  /** Cancel any pending debounced save and write immediately. */
  async function flushPendingSave() {
    if (_fileSaveTimer) {
      clearTimeout(_fileSaveTimer)
      _fileSaveTimer = null
      await saveToFile()
    }
  }

  return {
    getFilePath,
    saveToFile,
    scheduleFileSave,
    scheduleIndexUpdate,
    hasUnsavedChanges,
    recentlyWritten,
    flushPendingSave,
  }
}
