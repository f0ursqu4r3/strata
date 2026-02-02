<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from "vue";
import {
  Layers,
  Search,
  Upload,
  RotateCcw,
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
const showShortcutEditor = ref(false);
const showTagFilter = ref(false);
const showDueDateFilter = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const outlineRef = ref<InstanceType<typeof OutlineView> | null>(null);
const needsWorkspacePicker = ref(false);
const isGitWorkspace = ref(false);

onMounted(async () => {
  settings.init();

  // In Tauri mode, check if workspace is set
  if (isTauri() && !settings.workspacePath) {
    needsWorkspacePicker.value = true;
    return;
  }

  await docsStore.init();
  await store.init();

  // Check git status in Tauri mode
  if (isTauri() && settings.workspacePath) {
    import("@/lib/tauri-fs").then(({ isGitRepo }) => {
      isGitRepo(settings.workspacePath).then((v) => {
        isGitWorkspace.value = v;
      });
    });
  }

  // Global ? shortcut
  document.addEventListener("keydown", onGlobalKeydown);
});

async function onWorkspaceSelected() {
  needsWorkspacePicker.value = false;
  await docsStore.init();
  await store.init();
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

async function onReset() {
  if (!confirm("Reset document? This will delete all data and start fresh.")) return;
  await store.resetDocument();
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
      class="flex flex-wrap items-center min-h-12 px-3 sm:px-4 gap-2 py-2 border-b border-(--border-primary) bg-(--bg-primary) shrink-0"
    >
      <div class="flex items-center gap-2">
        <button
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer"
          title="Toggle sidebar"
          @click="settings.setSidebarOpen(!settings.sidebarOpen)"
        >
          <PanelLeft class="w-4 h-4" />
        </button>
        <Layers class="w-4.5 h-4.5" style="color: var(--accent-500)" />
        <span class="font-bold text-base text-(--text-primary) tracking-tight">Strata</span>
        <span
          v-if="isGitWorkspace"
          class="flex items-center gap-1 text-[11px] text-(--text-faint) bg-(--bg-hover) rounded px-1.5 py-0.5"
          title="Workspace is a git repository"
        >
          <GitBranch class="w-3 h-3" />
          git
        </span>
      </div>

      <div class="flex items-center gap-2 order-3 sm:order-0 sm:ml-auto sm:mr-auto">
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

      <div class="flex items-center gap-1.5 ml-auto">
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
            class="flex items-center gap-1 px-2 py-1 rounded-md border text-[13px] cursor-pointer"
            :class="
              store.tagFilter
                ? 'border-(--accent-500) bg-(--accent-50) text-(--accent-700)'
                : 'border-(--border-secondary) text-(--text-muted) hover:text-(--text-secondary) bg-(--bg-tertiary)'
            "
            @click="showTagFilter = !showTagFilter"
          >
            <Tag class="w-3.5 h-3.5" />
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
            class="flex items-center gap-1 px-2 py-1 rounded-md border text-[13px] cursor-pointer"
            :class="
              store.dueDateFilter !== 'all'
                ? 'border-(--accent-500) bg-(--accent-50) text-(--accent-700)'
                : 'border-(--border-secondary) text-(--text-muted) hover:text-(--text-secondary) bg-(--bg-tertiary)'
            "
            @click="showDueDateFilter = !showDueDateFilter"
          >
            <Calendar class="w-3.5 h-3.5" />
            <span v-if="store.dueDateFilter !== 'all'">{{ { overdue: 'Overdue', today: 'Due Today', week: 'This Week' }[store.dueDateFilter] }}</span>
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

        <!-- Toolbar buttons -->
        <div class="hidden sm:block">
          <ExportMenu />
        </div>
        <button
          class="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) hidden sm:block"
          title="Import JSON"
          @click="onImportClick"
        >
          <Upload class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) hidden sm:block"
          title="Reset document"
          @click="onReset"
        >
          <RotateCcw class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer"
          title="Trash"
          @click="showTrash = true"
        >
          <Trash2 class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) hidden sm:block"
          title="Keyboard shortcuts (?)"
          @click="showShortcuts = true"
        >
          <Keyboard class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary)"
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
        <Splitpanes v-if="store.viewMode === 'split'" class="h-full">
          <Pane :min-size="20" :size="50">
            <OutlineView ref="outlineRef" />
          </Pane>
          <Pane :min-size="20" :size="50">
            <KanbanBoard @open-status-editor="showStatusEditor = true" />
          </Pane>
        </Splitpanes>

        <div v-else-if="store.viewMode === 'outline'" class="h-full">
          <OutlineView ref="outlineRef" />
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
