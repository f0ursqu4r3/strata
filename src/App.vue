<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import {
  Layers,
  Search,
  Upload,
  Keyboard,
  Settings,
  ChevronRight,
  Tag,
  X,
  PanelLeft,
  Trash2,
  Calendar,
  GitBranch,
  FileText,
} from 'lucide-vue-next'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { useDocStore } from '@/stores/doc'
import { useSettingsStore } from '@/stores/settings'
import { useDocumentsStore } from '@/stores/documents'
import OutlineView from '@/components/outline/OutlineView.vue'
import KanbanBoard from '@/components/board/KanbanBoard.vue'
import ShortcutsModal from '@/components/settings/ShortcutsModal.vue'
import SettingsPanel from '@/components/settings/SettingsPanel.vue'
import DocumentSidebar from '@/components/sidebar/DocumentSidebar.vue'
import TrashPanel from '@/components/overlays/TrashPanel.vue'
import ExportMenu from '@/components/overlays/ExportMenu.vue'
import StatusEditor from '@/components/settings/StatusEditor.vue'
import DocumentSettingsPanel from '@/components/settings/DocumentSettingsPanel.vue'
import GlobalSearch from '@/components/overlays/GlobalSearch.vue'
import CommandPalette from '@/components/overlays/CommandPalette.vue'
import ShortcutEditor from '@/components/settings/ShortcutEditor.vue'
import {
  isTauri,
  isSingleFileMode,
  isFileSystemMode,
  setFileSystemActive,
  setSingleFileMode,
} from '@/lib/platform'
import WorkspacePicker from '@/components/overlays/WorkspacePicker.vue'
import { useAppInit } from '@/composables/useAppInit'
import { useGlobalKeyboard } from '@/composables/useGlobalKeyboard'
import type { ViewMode } from '@/types'
import { tagStyle } from '@/lib/tag-colors'

const store = useDocStore()
const settings = useSettingsStore()
const docsStore = useDocumentsStore()
const showShortcuts = ref(false)
const showSettings = ref(false)
const showTrash = ref(false)
const showStatusEditor = ref(false)
const showDocSettings = ref(false)
const showGlobalSearch = ref(false)
const showCommandPalette = ref(false)
const showShortcutEditor = ref(false)
const showTagFilter = ref(false)
const showDueDateFilter = ref(false)
const tagFilterQuery = ref('')
const tagFilterRef = ref<HTMLElement | null>(null)
const tagFilterInputRef = ref<HTMLInputElement | null>(null)
const dueDateFilterRef = ref<HTMLElement | null>(null)

const filteredTags = computed(() => {
  const q = tagFilterQuery.value.trim().toLowerCase()
  if (!q) return store.allTags
  return store.allTags.filter((t) => t.toLowerCase().includes(q))
})

function openTagFilter() {
  showTagFilter.value = !showTagFilter.value
  if (showTagFilter.value) {
    tagFilterQuery.value = ''
    nextTick(() => tagFilterInputRef.value?.focus())
  }
}

function applyTagFilter(tag: string | null) {
  store.filters.tag = tag
  showTagFilter.value = false
}

function onTagFilterKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    const q = tagFilterQuery.value.trim()
    if (q) {
      // Use the first matching tag or the typed value
      const match = filteredTags.value[0]
      applyTagFilter(match ?? q)
    }
  } else if (e.key === 'Escape') {
    showTagFilter.value = false
  }
}

function clearDueDateFilter() {
  store.filters.dueDate = 'all'
  showDueDateFilter.value = false
}

function setDueDateFilter(key: string) {
  store.filters.dueDate = key as 'all' | 'overdue' | 'today' | 'week'
  showDueDateFilter.value = false
}

function openCustomizeShortcuts() {
  showShortcuts.value = false
  showShortcutEditor.value = true
}

function openStatusEditorFromDoc() {
  showDocSettings.value = false
  showStatusEditor.value = true
}

function openFromPalette(target: 'settings' | 'docSettings' | 'shortcuts' | 'trash' | 'search') {
  showCommandPalette.value = false
  if (target === 'settings') showSettings.value = true
  else if (target === 'docSettings') showDocSettings.value = true
  else if (target === 'shortcuts') showShortcuts.value = true
  else if (target === 'trash') showTrash.value = true
  else if (target === 'search') showGlobalSearch.value = true
}

function onGlobalClick(e: MouseEvent) {
  if (
    showTagFilter.value &&
    tagFilterRef.value &&
    !tagFilterRef.value.contains(e.target as HTMLElement)
  ) {
    showTagFilter.value = false
  }
  if (
    showDueDateFilter.value &&
    dueDateFilterRef.value &&
    !dueDateFilterRef.value.contains(e.target as HTMLElement)
  ) {
    showDueDateFilter.value = false
  }
}
const fileInputRef = ref<HTMLInputElement | null>(null)
const outlineRef = ref<InstanceType<typeof OutlineView> | null>(null)
const needsWorkspacePicker = ref(false)
const isGitWorkspace = ref(false)
const gitBranch = ref('')

const activeDocName = computed(() => {
  const doc = docsStore.documents.find((d) => d.id === docsStore.activeId)
  if (!doc) return ''
  const name = doc.name
  const slash = name.lastIndexOf('/')
  return slash >= 0 ? name.substring(slash + 1) : name
})

useAppInit({
  showShortcuts,
  showSettings,
  needsWorkspacePicker,
  isGitWorkspace,
  gitBranch,
  onGlobalClick,
  openWorkspacePicker,
  openFilePicker,
})

useGlobalKeyboard({
  showShortcuts,
  showGlobalSearch,
  showCommandPalette,
})

async function openWorkspacePicker() {
  // Tear down current file watching before switching
  await docsStore.teardownFileWatching()
  setSingleFileMode(false)
  needsWorkspacePicker.value = true
}

async function openFilePicker() {
  await docsStore.teardownFileWatching()
  needsWorkspacePicker.value = true
}

async function onWorkspaceSelected() {
  needsWorkspacePicker.value = false

  try {
    const activeDocId = await docsStore.init()
    if (activeDocId) {
      await store.loadDocument(activeDocId)
    } else {
      store.ready = true
    }
  } catch (err) {
    console.error('[strata] Failed to initialize:', err)
    setFileSystemActive(false)
    setSingleFileMode(false)
    settings.setWorkspacePath('')
    settings.setSingleFilePath('')
    settings.setOpenMode('folder')
    needsWorkspacePicker.value = true
    return
  }

  // Set up file watching
  if (isFileSystemMode()) {
    const watchPath = isSingleFileMode() ? settings.singleFilePath : settings.workspacePath
    if (watchPath) {
      try {
        await docsStore.setupFileWatching(watchPath)
      } catch (err) {
        console.warn('[strata] File watching setup failed:', err)
      }
    }
  }

  if (isTauri()) {
    const titlePath = isSingleFileMode()
      ? settings.singleFilePath.includes('/')
        ? settings.singleFilePath.substring(settings.singleFilePath.lastIndexOf('/') + 1)
        : settings.singleFilePath
      : settings.workspacePath
    if (titlePath) {
      import('@/lib/menu-handler').then(({ updateWindowTitle }) => {
        updateWindowTitle(titlePath)
      })
    }
  }

  // Check git status after manual workspace selection
  if (isFileSystemMode() && settings.workspacePath) {
    import('@/lib/fs').then(({ isGitRepo, gitBranchName }) => {
      isGitRepo(settings.workspacePath)
        .then((v) => {
          isGitWorkspace.value = v
          if (v) {
            gitBranchName(settings.workspacePath).then((b) => {
              gitBranch.value = b
            })
          }
        })
        .catch(() => {})
    })
  }
}

async function onGlobalSearchNavigate(docId: string, nodeId: string) {
  if (docsStore.activeId !== docId) {
    await docsStore.switchDocument(docId)
    await store.loadDocument(docId)
  }
  store.navigateToNode(nodeId)
}

const modes: { key: ViewMode; label: string }[] = [
  { key: 'outline', label: 'Outline' },
  { key: 'split', label: 'Split' },
  { key: 'board', label: 'Board' },
]

// Focus management: focus outline when switching to outline/split
watch(
  () => store.viewMode,
  async () => {
    if (store.viewMode === 'outline' || store.viewMode === 'split') {
      await nextTick()
      const el = document.querySelector('.outline-focus-target') as HTMLElement | null
      el?.focus()
    }
  },
)

// Import
function onImportClick() {
  fileInputRef.value?.click()
}

async function onFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const text = await file.text()
  try {
    await store.importJSON(text)
  } catch (err) {
    alert('Failed to import: ' + (err as Error).message)
  }
  // Reset input
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function onZoomCrumb(id: string) {
  store.zoomIn(id)
}

function onZoomRoot() {
  store.zoomIn(store.rootId)
  // Actually just clear zoom
  store.zoomOut()
  // Force clear
  while (store.zoomId) store.zoomOut()
}
</script>

<template>
  <!-- Workspace picker -->
  <WorkspacePicker v-if="needsWorkspacePicker" @selected="onWorkspaceSelected" />

  <div
    v-else-if="store.ready"
    class="flex flex-col h-full bg-(--bg-primary) text-(--text-secondary)"
  >
    <!-- Top bar -->
    <header
      class="grid grid-cols-[1fr_auto_1fr] items-center min-h-11 px-3 sm:px-4 py-1.5 border-b border-(--border-primary) bg-(--bg-primary) shrink-0"
    >
      <!-- Left: branding + doc context -->
      <div class="flex items-center gap-2 min-w-0">
        <button
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer shrink-0"
          title="Toggle sidebar"
          @click="settings.setSidebarOpen(!settings.sidebarOpen)"
        >
          <PanelLeft class="w-4 h-4" />
        </button>
        <Layers class="w-4 h-4 shrink-0" style="color: var(--accent-500)" />
        <span class="font-semibold text-sm text-(--text-primary) tracking-tight shrink-0"
          >Strata</span
        >
        <template v-if="isGitWorkspace || activeDocName">
          <span class="text-(--text-faint) text-xs shrink-0">/</span>
          <span
            v-if="isGitWorkspace && gitBranch"
            class="text-xs text-(--text-faint) shrink-0"
            :title="`Branch: ${gitBranch}`"
          >
            <GitBranch class="w-3 h-3 inline -mt-px" />
            {{ gitBranch }}
          </span>
          <span
            v-if="isGitWorkspace && gitBranch && activeDocName"
            class="text-(--text-faint) text-xs shrink-0"
            >/</span
          >
          <span v-if="activeDocName" class="text-sm text-(--text-secondary) truncate">{{
            activeDocName
          }}</span>
        </template>
      </div>

      <!-- Center: view mode selector -->
      <div class="flex items-center justify-center">
        <div class="flex bg-(--bg-hover) rounded-md p-0.5">
          <button
            v-for="m in modes"
            :key="m.key"
            class="border-none px-3 sm:px-3.5 py-1 text-[13px] font-medium cursor-pointer rounded transition-all"
            :class="
              store.viewMode === m.key
                ? 'bg-(--bg-secondary) text-(--text-primary) shadow-sm ring-1 ring-(--accent-200)'
                : 'bg-transparent text-(--text-muted) hover:text-(--text-secondary)'
            "
            @click="store.setViewMode(m.key)"
          >
            {{ m.label }}
          </button>
        </div>
      </div>

      <!-- Right: actions -->
      <div class="flex items-center gap-1 justify-end">
        <!-- Search -->
        <button
          class="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer"
          title="Search (Ctrl+Shift+F)"
          @click="showGlobalSearch = true"
        >
          <Search class="w-4 h-4" />
        </button>

        <!-- Tag filter -->
        <div v-if="store.allTags.length > 0" ref="tagFilterRef" class="relative hidden sm:block">
          <button
            class="flex items-center gap-1 px-1.5 py-1 rounded-md border text-[12px] cursor-pointer"
            :class="
              store.filters.tag
                ? 'border-(--accent-500) bg-(--accent-50) text-(--accent-700)'
                : 'border-(--border-secondary) text-(--text-muted) hover:text-(--text-secondary) bg-(--bg-tertiary)'
            "
            @click="openTagFilter"
          >
            <Tag class="w-3 h-3" />
            <span v-if="store.filters.tag">{{ store.filters.tag }}</span>
            <span v-else>Tags</span>
            <button
              v-if="store.filters.tag"
              class="ml-0.5 hover:text-(--color-danger) cursor-pointer"
              @click.stop="applyTagFilter(null)"
            >
              <X class="w-3 h-3" />
            </button>
          </button>
          <div
            v-if="showTagFilter"
            class="strata-popup absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden"
          >
            <div class="px-2 pt-2 pb-1">
              <input
                ref="tagFilterInputRef"
                v-model="tagFilterQuery"
                class="w-full bg-(--bg-tertiary) border border-(--border-primary) rounded px-2 py-1 text-[12px] text-(--text-secondary) placeholder:text-(--text-faint) outline-none focus:border-(--accent-400)"
                placeholder="Filter or type tag..."
                @keydown="onTagFilterKeydown"
              />
            </div>
            <div class="max-h-52 overflow-y-auto py-1">
              <button
                class="w-full text-left px-3 py-1.5 text-[13px] hover:bg-(--bg-hover) cursor-pointer"
                :class="
                  !store.filters.tag ? 'text-(--accent-600) font-medium' : 'text-(--text-secondary)'
                "
                @click="applyTagFilter(null)"
              >
                All
              </button>
              <button
                v-for="tag in filteredTags"
                :key="tag"
                class="w-full text-left px-3 py-1.5 text-[13px] hover:bg-(--bg-hover) cursor-pointer flex items-center gap-2"
                :class="
                  store.filters.tag === tag
                    ? 'text-(--accent-600) font-medium bg-(--bg-hover)'
                    : 'text-(--text-secondary)'
                "
                @click="applyTagFilter(tag)"
              >
                <span
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  :class="tagStyle(tag, store.tagColors, settings.dark) ? '' : 'bg-(--accent-300)'"
                  :style="
                    tagStyle(tag, store.tagColors, settings.dark)
                      ? {
                          backgroundColor: (
                            tagStyle(tag, store.tagColors, settings.dark) as Record<string, string>
                          ).color,
                        }
                      : {}
                  "
                />
                {{ tag }}
              </button>
              <button
                v-if="tagFilterQuery.trim() && !filteredTags.includes(tagFilterQuery.trim())"
                class="w-full text-left px-3 py-1.5 text-[13px] hover:bg-(--bg-hover) cursor-pointer text-(--text-muted) italic"
                @click="applyTagFilter(tagFilterQuery.trim())"
              >
                Filter by "{{ tagFilterQuery.trim() }}"
              </button>
            </div>
          </div>
        </div>

        <!-- Due date filter -->
        <div ref="dueDateFilterRef" class="relative hidden sm:block">
          <button
            class="flex items-center gap-1 px-1.5 py-1 rounded-md border text-[12px] cursor-pointer"
            :class="
              store.filters.dueDate !== 'all'
                ? 'border-(--accent-500) bg-(--accent-50) text-(--accent-700)'
                : 'border-(--border-secondary) text-(--text-muted) hover:text-(--text-secondary) bg-(--bg-tertiary)'
            "
            @click="showDueDateFilter = !showDueDateFilter"
          >
            <Calendar class="w-3 h-3" />
            <span v-if="store.filters.dueDate !== 'all'">{{
              { overdue: 'Overdue', today: 'Today', week: 'Week' }[store.filters.dueDate]
            }}</span>
            <span v-else>Due</span>
            <button
              v-if="store.filters.dueDate !== 'all'"
              class="ml-0.5 hover:text-(--color-danger) cursor-pointer"
              @click.stop="clearDueDateFilter"
            >
              <X class="w-3 h-3" />
            </button>
          </button>
          <div
            v-if="showDueDateFilter"
            class="strata-popup absolute right-0 top-full z-50 mt-1 w-40 py-1"
          >
            <button
              v-for="opt in [
                { key: 'all', label: 'All' },
                { key: 'overdue', label: 'Overdue' },
                { key: 'today', label: 'Due Today' },
                { key: 'week', label: 'This Week' },
              ]"
              :key="opt.key"
              class="w-full text-left px-3 py-1.5 text-[13px] hover:bg-(--bg-hover) cursor-pointer"
              :class="
                store.filters.dueDate === opt.key
                  ? 'text-(--accent-600) font-medium bg-(--bg-hover)'
                  : 'text-(--text-secondary)'
              "
              @click="setDueDateFilter(opt.key)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="hidden sm:block">
          <ExportMenu />
        </div>
        <button
          class="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer hidden sm:block"
          title="Import JSON"
          @click="onImportClick"
        >
          <Upload class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer"
          title="Trash"
          @click="showTrash = true"
        >
          <Trash2 class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer hidden sm:block"
          title="Keyboard shortcuts (?)"
          @click="showShortcuts = true"
        >
          <Keyboard class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer"
          title="Document settings"
          @click="showDocSettings = true"
        >
          <FileText class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer"
          title="Settings"
          @click="showSettings = true"
        >
          <Settings class="w-4 h-4" />
        </button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json"
          class="hidden"
          @change="onFileSelected"
        />
      </div>
    </header>

    <!-- Zoom breadcrumb bar -->
    <div
      v-if="store.zoomId"
      class="flex items-center gap-1 px-4 py-1.5 text-xs border-b border-(--border-primary) bg-(--bg-tertiary)"
    >
      <button class="hover:underline" style="color: var(--accent-500)" @click="onZoomRoot">
        Root
      </button>
      <template v-for="crumb in store.zoomBreadcrumbs" :key="crumb.id">
        <ChevronRight class="w-3 h-3 text-(--text-faint) shrink-0" />
        <button
          class="text-(--text-muted) hover:text-(--accent-500) hover:underline truncate max-w-32"
          :class="{ 'font-medium text-(--text-secondary)': crumb.id === store.zoomId }"
          @click="onZoomCrumb(crumb.id)"
        >
          {{ crumb.text }}
        </button>
      </template>
    </div>

    <!-- Main content with optional sidebar -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Document sidebar (hidden in single-file mode) -->
      <DocumentSidebar
        v-if="!isSingleFileMode()"
        :open="settings.sidebarOpen"
        @close="settings.setSidebarOpen(false)"
      />

      <main class="flex-1 overflow-hidden">
        <div
          v-if="!docsStore.activeId"
          class="flex items-center justify-center h-full text-(--text-muted) text-sm"
        >
          <div class="text-center">
            <p>No documents found in this workspace.</p>
            <p class="mt-1 text-xs text-(--text-faint)">
              Press
              <kbd
                class="px-1.5 py-0.5 rounded bg-(--bg-hover) text-(--text-secondary) text-[11px] font-mono"
                >{{ isTauri() ? '⌘' : 'Ctrl' }}+N</kbd
              >
              to create one.
            </p>
          </div>
        </div>
        <Splitpanes v-else-if="store.viewMode === 'split'" class="h-full">
          <Pane :min-size="20" :size="50">
            <OutlineView ref="outlineRef" @openSearch="showGlobalSearch = true" />
          </Pane>
          <Pane :min-size="20" :size="50">
            <KanbanBoard @open-status-editor="showStatusEditor = true" />
          </Pane>
        </Splitpanes>

        <div v-else-if="store.viewMode === 'outline'" class="h-full">
          <OutlineView ref="outlineRef" @openSearch="showGlobalSearch = true" />
        </div>
        <div v-else class="h-full">
          <KanbanBoard @open-status-editor="showStatusEditor = true" />
        </div>
      </main>
    </div>
  </div>

  <div v-else class="flex items-center justify-center h-full text-(--text-faint) text-sm">
    Loading...
  </div>

  <!-- Shortcuts modal -->
  <ShortcutsModal
    v-if="showShortcuts"
    @close="showShortcuts = false"
    @customize="openCustomizeShortcuts"
  />

  <!-- Settings panel -->
  <SettingsPanel v-if="showSettings" @close="showSettings = false" />

  <!-- Trash panel -->
  <TrashPanel v-if="showTrash" @close="showTrash = false" />

  <!-- Document settings -->
  <DocumentSettingsPanel
    v-if="showDocSettings"
    @close="showDocSettings = false"
    @open-status-editor="openStatusEditorFromDoc"
  />

  <!-- Status editor -->
  <StatusEditor v-if="showStatusEditor" @close="showStatusEditor = false" />

  <!-- Shortcut editor -->
  <ShortcutEditor v-if="showShortcutEditor" @close="showShortcutEditor = false" />

  <!-- Command palette -->
  <Transition name="overlay-top">
    <CommandPalette
      v-if="showCommandPalette"
      @close="showCommandPalette = false"
      @openSettings="openFromPalette('settings')"
      @openDocSettings="openFromPalette('docSettings')"
      @openShortcuts="openFromPalette('shortcuts')"
      @openTrash="openFromPalette('trash')"
      @openSearch="openFromPalette('search')"
    />
  </Transition>

  <!-- Global search -->
  <Transition name="overlay-top">
    <GlobalSearch
      v-if="showGlobalSearch"
      @close="showGlobalSearch = false"
      @navigate="onGlobalSearchNavigate"
    />
  </Transition>
</template>

<style>
/* Splitpanes overrides */
.splitpanes__splitter {
  background: var(--border-primary) !important;
  min-width: 3px !important;
  min-height: 3px !important;
}
.splitpanes__splitter:hover {
  background: var(--accent-300) !important;
}
</style>
