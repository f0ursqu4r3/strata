<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from "vue";
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
} from "lucide-vue-next";
import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";
import { useDocStore } from "@/stores/doc";
import { useSettingsStore } from "@/stores/settings";
import { useDocumentsStore } from "@/stores/documents";
import OutlineView from "@/components/OutlineView.vue";
import KanbanBoard from "@/components/KanbanBoard.vue";
import ShortcutsModal from "@/components/ShortcutsModal.vue";
import SettingsPanel from "@/components/SettingsPanel.vue";
import DocumentSidebar from "@/components/DocumentSidebar.vue";
import TrashPanel from "@/components/TrashPanel.vue";
import ExportMenu from "@/components/ExportMenu.vue";
import StatusEditor from "@/components/StatusEditor.vue";
import GlobalSearch from "@/components/GlobalSearch.vue";
import CommandPalette from "@/components/CommandPalette.vue";
import ShortcutEditor from "@/components/ShortcutEditor.vue";
import { matchesCombo } from "@/lib/shortcuts";
import { isTauri } from "@/lib/platform";
import WorkspacePicker from "@/components/WorkspacePicker.vue";
import type { ViewMode } from "@/types";

const store = useDocStore();
const settings = useSettingsStore();
const docsStore = useDocumentsStore();
const showShortcuts = ref(false);
const showSettings = ref(false);
const showTrash = ref(false);
const showStatusEditor = ref(false);
const showGlobalSearch = ref(false);
const showCommandPalette = ref(false);
const showShortcutEditor = ref(false);
const showTagFilter = ref(false);
const showDueDateFilter = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const outlineRef = ref<InstanceType<typeof OutlineView> | null>(null);
const needsWorkspacePicker = ref(false);
const isGitWorkspace = ref(false);
const gitBranch = ref("");

const activeDocName = computed(() => {
  const doc = docsStore.documents.find((d) => d.id === docsStore.activeId);
  if (!doc) return "";
  const name = doc.name;
  const slash = name.lastIndexOf("/");
  return slash >= 0 ? name.substring(slash + 1) : name;
});

onMounted(async () => {
  settings.init();

  // In Tauri mode, auto-detect git repo or show workspace picker
  if (isTauri() && !settings.workspacePath) {
    try {
      const { findGitRoot } = await import("@/lib/tauri-fs");
      const gitRoot = await findGitRoot();
      if (gitRoot) {
        settings.setWorkspacePath(gitRoot);
        isGitWorkspace.value = true;
        const { gitBranchName } = await import("@/lib/tauri-fs");
        gitBranch.value = await gitBranchName(gitRoot);
      } else {
        needsWorkspacePicker.value = true;
        return;
      }
    } catch {
      needsWorkspacePicker.value = true;
      return;
    }
  }

  const activeDocId = await docsStore.init();
  if (!activeDocId && !settings.workspacePath) {
    needsWorkspacePicker.value = true;
    return;
  }
  if (activeDocId) {
    await store.loadDocument(activeDocId);
  } else {
    store.ready = true;
  }

  // Check git status in Tauri mode
  if (isTauri() && settings.workspacePath && !isGitWorkspace.value) {
    import("@/lib/tauri-fs").then(({ isGitRepo, gitBranchName }) => {
      isGitRepo(settings.workspacePath).then((v) => {
        isGitWorkspace.value = v;
        if (v) {
          gitBranchName(settings.workspacePath).then((b) => {
            gitBranch.value = b;
          });
        }
      });
    });
  }

  // Tauri: set up native menu handler, file watching, and window title
  if (isTauri()) {
    const { setupMenuHandler, updateWindowTitle } = await import("@/lib/menu-handler");
    await setupMenuHandler({ showShortcuts, showSettings, onOpenWorkspace: openWorkspacePicker });

    if (settings.workspacePath) {
      await docsStore.setupFileWatching(settings.workspacePath);
      await updateWindowTitle(settings.workspacePath);
    }
  }

  // Check for app updates (Tauri only, non-blocking)
  if (isTauri()) {
    import("@tauri-apps/plugin-updater").then(({ check }) => {
      check().then(async (update) => {
        if (!update) return;
        const { ask } = await import("@tauri-apps/plugin-dialog");
        const yes = await ask(
          `A new version (${update.version}) is available. Update and restart now?`,
          { title: "Update Available", kind: "info" },
        );
        if (yes) {
          await update.downloadAndInstall();
          const { relaunch } = await import("@tauri-apps/plugin-process");
          await relaunch();
        }
      }).catch(() => {});
    });
  }

  // Global ? shortcut
  document.addEventListener("keydown", onGlobalKeydown);
});

async function openWorkspacePicker() {
  // Tear down current file watching before switching
  await docsStore.teardownFileWatching();
  needsWorkspacePicker.value = true;
}

async function onWorkspaceSelected() {
  needsWorkspacePicker.value = false;
  const activeDocId = await docsStore.init();
  if (activeDocId) {
    await store.loadDocument(activeDocId);
  } else {
    store.ready = true;
  }
  if (isTauri() && settings.workspacePath) {
    await docsStore.setupFileWatching(settings.workspacePath);
    import("@/lib/menu-handler").then(({ updateWindowTitle }) => {
      updateWindowTitle(settings.workspacePath);
    });
  }

  // Check git status after manual workspace selection
  if (isTauri() && settings.workspacePath) {
    import("@/lib/tauri-fs").then(({ isGitRepo, gitBranchName }) => {
      isGitRepo(settings.workspacePath).then((v) => {
        isGitWorkspace.value = v;
        if (v) {
          gitBranchName(settings.workspacePath).then((b) => {
            gitBranch.value = b;
          });
        }
      });
    });
  }

  document.addEventListener("keydown", onGlobalKeydown);
}

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === "?" && !store.editingId && !(e.target instanceof HTMLInputElement)) {
    showShortcuts.value = !showShortcuts.value;
    e.preventDefault();
  }
  const searchDef = settings.resolvedShortcuts.find((s) => s.action === "globalSearch");
  if (searchDef && matchesCombo(e, searchDef.combo)) {
    showGlobalSearch.value = !showGlobalSearch.value;
    store.searchQuery = "";
    e.preventDefault();
  }
  const paletteDef = settings.resolvedShortcuts.find((s) => s.action === "commandPalette");
  if (paletteDef && matchesCombo(e, paletteDef.combo)) {
    showCommandPalette.value = !showCommandPalette.value;
    e.preventDefault();
  }
}

async function onGlobalSearchNavigate(docId: string, nodeId: string) {
  if (docsStore.activeId !== docId) {
    await docsStore.switchDocument(docId);
    await store.loadDocument(docId);
  }
  store.navigateToNode(nodeId);
}

const modes: { key: ViewMode; label: string }[] = [
  { key: "outline", label: "Outline" },
  { key: "split", label: "Split" },
  { key: "board", label: "Board" },
];

// Focus management: focus outline when switching to outline/split
watch(
  () => store.viewMode,
  async () => {
    if (store.viewMode === "outline" || store.viewMode === "split") {
      await nextTick();
      const el = document.querySelector(".outline-focus-target") as HTMLElement | null;
      el?.focus();
    }
  },
);

// Import
function onImportClick() {
  fileInputRef.value?.click();
}

async function onFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    await store.importJSON(text);
  } catch (err) {
    alert("Failed to import: " + (err as Error).message);
  }
  // Reset input
  if (fileInputRef.value) fileInputRef.value.value = "";
}


function onZoomCrumb(id: string) {
  store.zoomIn(id);
}

function onZoomRoot() {
  store.zoomIn(store.rootId);
  // Actually just clear zoom
  store.zoomOut();
  // Force clear
  while (store.zoomId) store.zoomOut();
}
</script>

<template>
  <!-- Workspace picker (Tauri first-run) -->
  <WorkspacePicker v-if="needsWorkspacePicker" @selected="onWorkspaceSelected" />

  <div v-else-if="store.ready" class="flex flex-col h-full bg-(--bg-primary) text-(--text-secondary)">
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
        <span class="font-semibold text-sm text-(--text-primary) tracking-tight shrink-0">Strata</span>
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
          <span v-if="isGitWorkspace && gitBranch && activeDocName" class="text-(--text-faint) text-xs shrink-0">/</span>
          <span
            v-if="activeDocName"
            class="text-sm text-(--text-secondary) truncate"
          >{{ activeDocName }}</span>
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
        <div v-if="store.allTags.length > 0" class="relative hidden sm:block">
          <button
            class="flex items-center gap-1 px-1.5 py-1 rounded-md border text-[12px] cursor-pointer"
            :class="
              store.tagFilter
                ? 'border-(--accent-500) bg-(--accent-50) text-(--accent-700)'
                : 'border-(--border-secondary) text-(--text-muted) hover:text-(--text-secondary) bg-(--bg-tertiary)'
            "
            @click="showTagFilter = !showTagFilter"
          >
            <Tag class="w-3 h-3" />
            <span v-if="store.tagFilter">{{ store.tagFilter }}</span>
            <span v-else>Tags</span>
            <button
              v-if="store.tagFilter"
              class="ml-0.5 hover:text-(--color-danger) cursor-pointer"
              @click.stop="store.tagFilter = null; showTagFilter = false"
            >
              <X class="w-3 h-3" />
            </button>
          </button>
          <div
            v-if="showTagFilter"
            class="absolute right-0 top-full z-50 mt-1 w-48 bg-(--bg-secondary) border border-(--border-primary) rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto"
          >
            <button
              class="w-full text-left px-3 py-1.5 text-[13px] hover:bg-(--bg-hover) cursor-pointer"
              :class="!store.tagFilter ? 'text-(--accent-600) font-medium' : 'text-(--text-secondary)'"
              @click="store.tagFilter = null; showTagFilter = false"
            >
              All
            </button>
            <button
              v-for="tag in store.allTags"
              :key="tag"
              class="w-full text-left px-3 py-1.5 text-[13px] hover:bg-(--bg-hover) cursor-pointer"
              :class="store.tagFilter === tag ? 'text-(--accent-600) font-medium bg-(--bg-hover)' : 'text-(--text-secondary)'"
              @click="store.tagFilter = tag; showTagFilter = false"
            >
              {{ tag }}
            </button>
          </div>
        </div>

        <!-- Due date filter -->
        <div class="relative hidden sm:block">
          <button
            class="flex items-center gap-1 px-1.5 py-1 rounded-md border text-[12px] cursor-pointer"
            :class="
              store.dueDateFilter !== 'all'
                ? 'border-(--accent-500) bg-(--accent-50) text-(--accent-700)'
                : 'border-(--border-secondary) text-(--text-muted) hover:text-(--text-secondary) bg-(--bg-tertiary)'
            "
            @click="showDueDateFilter = !showDueDateFilter"
          >
            <Calendar class="w-3 h-3" />
            <span v-if="store.dueDateFilter !== 'all'">{{ { overdue: 'Overdue', today: 'Today', week: 'Week' }[store.dueDateFilter] }}</span>
            <span v-else>Due</span>
            <button
              v-if="store.dueDateFilter !== 'all'"
              class="ml-0.5 hover:text-(--color-danger) cursor-pointer"
              @click.stop="store.dueDateFilter = 'all'; showDueDateFilter = false"
            >
              <X class="w-3 h-3" />
            </button>
          </button>
          <div
            v-if="showDueDateFilter"
            class="absolute right-0 top-full z-50 mt-1 w-40 bg-(--bg-secondary) border border-(--border-primary) rounded-lg shadow-lg py-1"
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
              :class="store.dueDateFilter === opt.key ? 'text-(--accent-600) font-medium bg-(--bg-hover)' : 'text-(--text-secondary)'"
              @click="store.dueDateFilter = opt.key as 'all' | 'overdue' | 'today' | 'week'; showDueDateFilter = false"
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
      <!-- Document sidebar -->
      <DocumentSidebar
        v-if="settings.sidebarOpen"
        @close="settings.setSidebarOpen(false)"
      />

      <main class="flex-1 overflow-hidden">
        <div v-if="!docsStore.activeId" class="flex items-center justify-center h-full text-(--text-muted) text-sm">
          <div class="text-center">
            <p>No documents found in this workspace.</p>
            <p class="mt-1 text-xs text-(--text-faint)">Press <kbd class="px-1.5 py-0.5 rounded bg-(--bg-hover) text-(--text-secondary) text-[11px] font-mono">{{ isTauri() ? '⌘' : 'Ctrl' }}+N</kbd> to create one.</p>
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
  <ShortcutsModal v-if="showShortcuts" @close="showShortcuts = false" @customize="showShortcuts = false; showShortcutEditor = true" />

  <!-- Settings panel -->
  <SettingsPanel v-if="showSettings" @close="showSettings = false" @open-status-editor="showSettings = false; showStatusEditor = true" />

  <!-- Trash panel -->
  <TrashPanel v-if="showTrash" @close="showTrash = false" />

  <!-- Status editor -->
  <StatusEditor v-if="showStatusEditor" @close="showStatusEditor = false" />

  <!-- Shortcut editor -->
  <ShortcutEditor v-if="showShortcutEditor" @close="showShortcutEditor = false" />

  <!-- Command palette -->
  <CommandPalette
    v-if="showCommandPalette"
    @close="showCommandPalette = false"
    @openSettings="showCommandPalette = false; showSettings = true"
    @openShortcuts="showCommandPalette = false; showShortcuts = true"
    @openTrash="showCommandPalette = false; showTrash = true"
    @openSearch="showCommandPalette = false; showGlobalSearch = true"
  />

  <!-- Global search -->
  <GlobalSearch
    v-if="showGlobalSearch"
    @close="showGlobalSearch = false"
    @navigate="onGlobalSearchNavigate"
  />
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
