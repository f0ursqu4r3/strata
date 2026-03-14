<script setup lang="ts">
import { ref, computed, nextTick, provide, watch } from 'vue'
import { Plus, X, FolderOpen, FolderPlus, NotepadText } from 'lucide-vue-next'

const INBOX_DOC_ID = '__inbox__'
import { useDocumentsStore } from '@/stores/documents'
import { useDocStore } from '@/stores/doc'
import { useSettingsStore } from '@/stores/settings'
import { isTauri, isFileSystemMode, hasFileSystemAccess, setFileSystemActive } from '@/lib/platform'
import { useDocumentRename } from '@/composables/sidebar/useDocumentRename'
import { buildFolderTree } from '@/lib/folder-tree'
import FolderTreeItem from './FolderTreeItem.vue'
import DocumentContextMenu from './DocumentContextMenu.vue'
import FolderContextMenu from './FolderContextMenu.vue'

interface Props {
  open?: boolean
}

withDefaults(defineProps<Props>(), {
  open: true,
})

const emit = defineEmits<{ close: [] }>()
const docsStore = useDocumentsStore()
const docStore = useDocStore()
const settings = useSettingsStore()

const {
  renamingId,
  renameInputRef,
  renameText,
  renameConflict,
  startRename,
  finishRename,
  onRenameKeydown,
} = useDocumentRename()

// Provide rename ref for tree items
provide('renameInputRef', renameInputRef)

// Expand/collapse state for folders — persisted per workspace
const EXPANDED_KEY = 'strata-expanded-folders'

function loadExpanded(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const wsKey = settings.workspacePath || '_default'
      if (parsed[wsKey]) return new Set(parsed[wsKey])
    }
  } catch {
    /* ignore */
  }
  return new Set()
}

function saveExpanded(folders: Set<string>) {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY)
    const all = raw ? JSON.parse(raw) : {}
    const wsKey = settings.workspacePath || '_default'
    all[wsKey] = [...folders]
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

const expandedFolders = ref<Set<string>>(loadExpanded())
watch(expandedFolders, (v) => saveExpanded(v))
provide('expandedFolders', expandedFolders)

// Build the folder tree from documents + folders
const folderTree = computed(() => buildFolderTree(docsStore.sortedDocuments, docsStore.folders))

// Context menus
const docCtxMenu = ref<{ docId: string; x: number; y: number } | null>(null)
const folderCtxMenu = ref<{ folderPath: string; x: number; y: number } | null>(null)

function onDocContext(e: MouseEvent, docId: string) {
  folderCtxMenu.value = null
  docCtxMenu.value = { docId, x: e.clientX, y: e.clientY }
}

function onFolderContext(e: MouseEvent, folderPath: string) {
  docCtxMenu.value = null
  folderCtxMenu.value = { folderPath, x: e.clientX, y: e.clientY }
}

function onCtxRename(docId: string) {
  const doc = docsStore.documents.find((d) => d.id === docId)
  if (doc) {
    startRename(docId, doc.name, new MouseEvent('dblclick'))
  }
}

async function onCtxDelete(docId: string) {
  await onDelete(docId)
}

async function onCreateNew(folder?: string) {
  docStore.flushTextDebounce()
  const name = docsStore.nextUntitledName()
  const id = docsStore.createDocument(name, folder)
  await docsStore.switchDocument(id)
  await docStore.loadDocument(id)
  // Expand the target folder so the new doc is visible
  if (folder) {
    const newSet = new Set(expandedFolders.value)
    newSet.add(folder)
    expandedFolders.value = newSet
  }
  renamingId.value = id
  renameText.value = name
  await nextTick()
  renameInputRef.value[0]?.focus()
  renameInputRef.value[0]?.select()
}

async function onCreateFolder(parentPath: string) {
  const baseName = 'New Folder'
  let folderName = baseName
  let i = 2
  const existing = new Set(docsStore.folders)
  const fullPath = () => (parentPath ? `${parentPath}/${folderName}` : folderName)
  while (existing.has(fullPath())) {
    folderName = `${baseName} ${i}`
    i++
  }
  const newPath = fullPath()
  await docsStore.createFolder(newPath)
  // Expand parent so the new folder is visible
  if (parentPath) {
    const newSet = new Set(expandedFolders.value)
    newSet.add(parentPath)
    expandedFolders.value = newSet
  }
}

async function onSwitchDoc(docId: string) {
  if (docId === docsStore.activeId) return
  docStore.flushTextDebounce()
  await docsStore.switchDocument(docId)
  await docStore.loadDocument(docId)
}

async function onSwitchToInbox() {
  if (docsStore.activeId === INBOX_DOC_ID) return
  docStore.flushTextDebounce()
  const { setCurrentDocId } = await import('@/lib/idb')
  setCurrentDocId(INBOX_DOC_ID)
  docsStore.activeId = INBOX_DOC_ID
  await docStore.loadDocument(INBOX_DOC_ID)
}

async function changeWorkspace() {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      directory: true,
      title: 'Choose Strata Workspace',
    })
    if (selected) {
      settings.setWorkspacePath(selected as string)
      window.location.reload()
    }
  } else if (hasFileSystemAccess()) {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      const { setHandle } = await import('@/lib/web-fs')
      await setHandle(handle)
      const { setWorkspacePrefix } = await import('@/lib/fs')
      setFileSystemActive(true)
      setWorkspacePrefix(handle.name + '/')
      settings.setWorkspacePath(handle.name)
      window.location.reload()
    } catch {
      // User cancelled
    }
  }
}

async function onDelete(docId: string, e?: MouseEvent) {
  e?.stopPropagation()

  let confirmed = false
  if (isTauri()) {
    const { ask } = await import('@tauri-apps/plugin-dialog')
    confirmed = await ask('Delete this document? This cannot be undone.', {
      title: 'Delete Document',
      kind: 'warning',
    })
  } else {
    confirmed = confirm('Delete this document? This cannot be undone.')
  }
  if (!confirmed) return

  await docsStore.deleteDocument(docId)
  docStore.clearSavedHistory(docId)
  if (docsStore.activeId) {
    await docStore.loadDocument(docsStore.activeId)
  } else {
    docStore.clearToEmpty()
  }
}
</script>

<template>
  <div
    class="shrink-0 overflow-hidden"
    :style="{
      width: '14rem',
      marginLeft: open ? '0' : '-14rem',
      opacity: open ? '1' : '0',
      transition: 'margin-left 120ms ease-out, opacity 100ms ease-out',
    }"
  >
    <div class="flex flex-col h-full bg-(--bg-secondary) border-r border-(--border-primary) w-56">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-3 border-b border-(--border-primary)">
      <span class="text-xs font-semibold text-(--text-faint) uppercase tracking-wide"
        >Documents</span
      >
      <div class="flex items-center gap-1">
        <button
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer"
          title="New folder"
          @click="onCreateFolder('')"
        >
          <FolderPlus class="w-3.5 h-3.5" />
        </button>
        <button
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer"
          title="New document"
          @click="onCreateNew()"
        >
          <Plus class="w-3.5 h-3.5" />
        </button>
        <button
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer sm:hidden"
          title="Close sidebar"
          @click="emit('close')"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Inbox -->
    <div class="px-1 py-1 border-b border-(--border-primary)">
      <button
        class="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm cursor-pointer"
        :class="docsStore.activeId === INBOX_DOC_ID
          ? 'bg-(--bg-hover) text-(--text-primary) font-medium'
          : 'text-(--text-secondary) hover:bg-(--bg-hover)'"
        @click="onSwitchToInbox"
      >
        <NotepadText class="w-3.5 h-3.5 shrink-0" />
        <span>Scratch Pad</span>
      </button>
    </div>

    <!-- Document tree -->
    <div class="flex-1 overflow-y-auto py-1 min-h-0">
      <FolderTreeItem
        v-for="child in folderTree.children"
        :key="child.path"
        :node="child"
        :depth="0"
        :active-doc-id="docsStore.activeId"
        :renaming-id="renamingId"
        :rename-text="renameText"
        :rename-conflict="renameConflict"
        @switch-doc="onSwitchDoc"
        @create-doc="onCreateNew"
        @create-folder="onCreateFolder"
        @delete-doc="onDelete"
        @start-rename="startRename"
        @folder-context="onFolderContext"
        @doc-context="onDocContext"
        @update:rename-text="renameText = $event"
        @finish-rename="finishRename"
        @rename-keydown="onRenameKeydown"
      />
    </div>

    <!-- Workspace footer -->
    <div
      v-if="isFileSystemMode() || hasFileSystemAccess()"
      class="shrink-0 border-t border-(--border-primary) px-3 py-2"
    >
      <div v-if="isFileSystemMode()" class="flex items-center gap-1.5">
        <FolderOpen class="w-3 h-3 shrink-0 text-(--text-faint)" />
        <span
          class="flex-1 text-[11px] text-(--text-faint) truncate"
          :title="settings.workspacePath"
        >
          {{ settings.workspacePath || '(not set)' }}
        </span>
        <button
          class="text-[11px] text-(--accent-600) hover:text-(--accent-700) cursor-pointer shrink-0"
          @click="changeWorkspace"
        >
          Change
        </button>
      </div>
      <button
        v-else
        class="flex items-center gap-1.5 text-[11px] text-(--accent-600) hover:text-(--accent-700) cursor-pointer w-full"
        @click="changeWorkspace"
      >
        <FolderOpen class="w-3 h-3" />
        Open workspace folder
      </button>
    </div>

    <!-- Document context menu -->
    <DocumentContextMenu
      v-if="docCtxMenu"
      :doc-id="docCtxMenu.docId"
      :x="docCtxMenu.x"
      :y="docCtxMenu.y"
      @close="docCtxMenu = null"
      @rename="onCtxRename"
      @delete="onCtxDelete"
    />

    <!-- Folder context menu -->
    <FolderContextMenu
      v-if="folderCtxMenu"
      :folder-path="folderCtxMenu.folderPath"
      :x="folderCtxMenu.x"
      :y="folderCtxMenu.y"
      @close="folderCtxMenu = null"
      @create-doc="onCreateNew"
      @create-folder="onCreateFolder"
    />
    </div>
  </div>
</template>
