<script setup lang="ts">
import { ref, computed, nextTick, provide, watch } from 'vue'
import { Plus, X, FolderOpen, FolderPlus, FileText, Circle } from 'lucide-vue-next'
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
  isNewDoc,
  startRename,
  startNewDocRename,
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

// Separate drafts from saved documents
const savedDocuments = computed(() => docsStore.sortedDocuments.filter((d) => !docsStore.isDraft(d.id)))
const draftDocuments = computed(() => docsStore.documents.filter((d) => docsStore.isDraft(d.id)))

// Build the folder tree from saved documents + folders (exclude drafts)
const folderTree = computed(() => buildFolderTree(savedDocuments.value, docsStore.folders))

// Context menus
const docCtxMenu = ref<{ docId: string; x: number; y: number } | null>(null)
const folderCtxMenu = ref<{ folderPath: string; x: number; y: number } | null>(null)

function onDocContext(e: MouseEvent, docId: string) {
  folderCtxMenu.value = null
  docCtxMenu.value = { docId, x: e.clientX, y: e.clientY }
}

function onSidebarContext(e: MouseEvent) {
  // Skip if a doc/folder context menu was just opened by a child
  if (docCtxMenu.value || folderCtxMenu.value) return
  folderCtxMenu.value = { folderPath: '', x: e.clientX, y: e.clientY }
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

async function onRevealDoc(docId: string) {
  if (!isTauri() || !settings.workspacePath) return
  const { revealPath } = await import('@/lib/tauri-fs')
  await revealPath(`${settings.workspacePath}/${docId}`)
}

async function onSaveDraft(draftId: string) {
  if (!docsStore.isDraft(draftId)) return
  const doc = docsStore.documents.find((d) => d.id === draftId)
  const defaultName = doc?.name || 'Untitled'

  // Use Tauri dialog if available, otherwise browser prompt
  let name: string | null = null
  if (isTauri()) {
    const { ask } = await import('@tauri-apps/plugin-dialog')
    // Tauri's ask() is yes/no only; use a simple prompt approach
    name = window.prompt('Save document as:', defaultName)
  } else {
    name = window.prompt('Save document as:', defaultName)
  }

  if (!name || !name.trim()) return
  const trimmed = name.trim()

  // Check for name conflicts
  if (docsStore.nameConflicts(trimmed, draftId)) {
    window.alert(`A document named "${trimmed}" already exists.`)
    return
  }

  const newId = await docsStore.saveDraft(draftId, trimmed)
  await docStore.loadDocument(newId)
}

async function onRevealFolder(folderPath: string) {
  if (!isTauri() || !settings.workspacePath) return
  const { revealPath } = await import('@/lib/tauri-fs')
  const fullPath = folderPath ? `${settings.workspacePath}/${folderPath}` : settings.workspacePath
  await revealPath(fullPath)
}

async function onCreateNew(_folder?: string) {
  docStore.flushTextDebounce()
  const id = docsStore.createDraft()
  await docsStore.switchDocument(id)
  await docStore.loadDocument(id)
  startNewDocRename(id, '')
}

async function onCreateFolder(parentPath: string) {
  // Create a temp folder with a placeholder name
  const tempName = '_new-folder-' + Date.now()
  const tempPath = parentPath ? `${parentPath}/${tempName}` : tempName
  await docsStore.createFolder(tempPath)
  // Expand parent so the new folder is visible
  if (parentPath) {
    const newSet = new Set(expandedFolders.value)
    newSet.add(parentPath)
    expandedFolders.value = newSet
  }
  // Enter rename mode — reuse the doc rename system with the folder path
  renamingId.value = tempPath
  renameText.value = ''
  isNewDoc.value = true
  await nextTick()
  renameInputRef.value[0]?.focus()
}

async function onSwitchDoc(docId: string) {
  if (docId === docsStore.activeId) return
  docStore.flushTextDebounce()
  await docsStore.switchDocument(docId)
  await docStore.loadDocument(docId)
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

defineExpose({ startNewDocRename })
</script>

<template>
  <!-- Desktop: slide sidebar with margin; Mobile: overlay with backdrop -->
  <div
    v-if="open"
    class="fixed inset-0 z-30 bg-(--bg-overlay) sm:hidden"
    @click="emit('close')"
  />
  <div
    class="shrink-0 overflow-hidden sm:relative fixed z-40 sm:z-auto inset-y-0 left-0"
    :style="{
      width: '14rem',
      marginLeft: open ? '0' : '-14rem',
      opacity: open ? '1' : '0',
      transition: 'margin-left 120ms ease-out, opacity 100ms ease-out',
    }"
  >
    <nav class="flex flex-col h-full bg-(--bg-secondary) border-r border-(--border-primary) w-56" aria-label="Documents">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-3 border-b border-(--border-primary)">
      <span class="text-xs font-semibold text-(--text-faint) uppercase tracking-wide"
        >Documents</span
      >
      <div class="flex items-center gap-1">
        <button type="button"
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer"
          title="New folder"
          aria-label="New folder"
          @click="onCreateFolder('')"
        >
          <FolderPlus class="w-3.5 h-3.5" />
        </button>
        <button type="button"
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer"
          title="New document"
          aria-label="New document"
          @click="onCreateNew()"
        >
          <Plus class="w-3.5 h-3.5" />
        </button>
        <button type="button"
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer sm:hidden"
          title="Close sidebar"
          aria-label="Close sidebar"
          @click="emit('close')"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Document tree -->
    <div class="flex-1 overflow-y-auto py-1 min-h-0" @contextmenu.prevent="onSidebarContext">
      <!-- Draft documents -->
      <template v-if="draftDocuments.length > 0">
        <div
          v-for="draft in draftDocuments"
          :key="draft.id"
          class="flex items-center gap-2 py-1.5 cursor-pointer text-sm transition-colors group"
          :class="
            draft.id === docsStore.activeId
              ? 'bg-(--bg-active) text-(--text-primary) font-medium'
              : 'text-(--text-secondary) hover:bg-(--bg-hover)'
          "
          :style="{ paddingLeft: '12px' }"
          @click="onSwitchDoc(draft.id)"
          @contextmenu.prevent="onDocContext($event, draft.id)"
        >
          <FileText class="w-3.5 h-3.5 shrink-0 text-(--text-faint)" />
          <!-- Rename input for new drafts -->
          <div v-if="renamingId === draft.id" class="flex-1 min-w-0 relative">
            <input
              :ref="(el) => { if (el) renameInputRef = [el as HTMLInputElement] }"
              :value="renameText"
              aria-label="Document name"
              class="w-full bg-transparent border rounded px-1 py-0.5 text-sm text-(--text-primary) outline-none focus:ring-1 border-(--border-secondary) focus:ring-(--accent-400)"
              placeholder="Document name..."
              @input="renameText = ($event.target as HTMLInputElement).value"
              @blur="finishRename"
              @keydown="onRenameKeydown"
              @click.stop
            />
          </div>
          <template v-else>
            <span class="flex-1 truncate italic">{{ draft.name }}</span>
            <Circle class="w-1.5 h-1.5 shrink-0 text-(--accent-500) fill-(--accent-500) mr-2" />
          </template>
        </div>
        <div class="border-b border-(--border-primary) mx-3 my-1" />
      </template>

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
        <button type="button"
          class="text-[11px] text-(--accent-600) hover:text-(--accent-700) cursor-pointer shrink-0"
          @click="changeWorkspace"
        >
          Change
        </button>
      </div>
      <button type="button"
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
      @reveal="onRevealDoc"
      @save="onSaveDraft"
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
      @reveal="onRevealFolder"
    />
    </nav>
  </div>
</template>
