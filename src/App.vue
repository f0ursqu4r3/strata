<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import {
  Layers,
  Search,
  Sun,
  Moon,
  Download,
  Upload,
  RotateCcw,
  Keyboard,
  Settings,
  ChevronRight,
} from 'lucide-vue-next'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { useDocStore } from '@/stores/doc'
import { useSettingsStore } from '@/stores/settings'
import OutlineView from '@/components/OutlineView.vue'
import KanbanBoard from '@/components/KanbanBoard.vue'
import ShortcutsModal from '@/components/ShortcutsModal.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import type { ViewMode } from '@/types'

const store = useDocStore()
const settings = useSettingsStore()
const showShortcuts = ref(false)
const showSettings = ref(false)
const showMobileSearch = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const outlineRef = ref<InstanceType<typeof OutlineView> | null>(null)

onMounted(() => {
  settings.init()
  store.init()

  // Global ? shortcut
  document.addEventListener('keydown', onGlobalKeydown)
})

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === '?' && !store.editingId && !(e.target instanceof HTMLInputElement)) {
    showShortcuts.value = !showShortcuts.value
    e.preventDefault()
  }
}

const modes: { key: ViewMode; label: string }[] = [
  { key: 'outline', label: 'Outline' },
  { key: 'board', label: 'Board' },
  { key: 'split', label: 'Split' },
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

async function onReset() {
  if (!confirm('Reset document? This will delete all data and start fresh.')) return
  await store.resetDocument()
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
  <div v-if="store.ready" class="flex flex-col h-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
    <!-- Top bar -->
    <header class="flex flex-wrap items-center min-h-12 px-3 sm:px-4 gap-2 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
      <div class="flex items-center gap-2">
        <Layers class="w-4.5 h-4.5" style="color: var(--accent-500)" />
        <span class="font-bold text-base text-slate-900 dark:text-white tracking-tight">Strata</span>
      </div>

      <div class="flex items-center gap-2 order-3 sm:order-0 sm:ml-auto sm:mr-auto">
        <div class="flex bg-slate-100 dark:bg-slate-800 rounded-md p-0.5">
          <button
            v-for="m in modes"
            :key="m.key"
            class="border-none px-3 sm:px-3.5 py-1 text-[13px] font-medium cursor-pointer rounded transition-all"
            :class="
              store.viewMode === m.key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-(--accent-200) dark:ring-(--accent-700)'
                : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            "
            @click="store.setViewMode(m.key)"
          >
            {{ m.label }}
          </button>
        </div>
      </div>

      <div class="flex items-center gap-1.5 ml-auto">
        <!-- Search -->
        <div class="relative hidden sm:block">
          <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            class="w-36 lg:w-44 py-1 pl-8 pr-2.5 border border-slate-200 dark:border-slate-600 rounded-md text-[13px] text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-(--accent-400) focus:border-(--accent-400)"
            type="text"
            placeholder="Search..."
            :value="store.searchQuery"
            @input="store.searchQuery = ($event.target as HTMLInputElement).value"
            @keydown.escape="store.searchQuery = ''; ($event.target as HTMLInputElement).blur()"
          />
        </div>

        <!-- Mobile search toggle -->
        <button
          class="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 sm:hidden"
          title="Search"
          @click="showMobileSearch = !showMobileSearch"
        >
          <Search class="w-4 h-4" />
        </button>

        <!-- Toolbar buttons -->
        <button
          class="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hidden sm:block"
          title="Export JSON"
          @click="store.downloadExport()"
        >
          <Download class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hidden sm:block"
          title="Import JSON"
          @click="onImportClick"
        >
          <Upload class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hidden sm:block"
          title="Reset document"
          @click="onReset"
        >
          <RotateCcw class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hidden sm:block"
          title="Keyboard shortcuts (?)"
          @click="showShortcuts = true"
        >
          <Keyboard class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          title="Settings"
          @click="showSettings = true"
        >
          <Settings class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          title="Toggle dark mode"
          @click="settings.toggleDark()"
        >
          <Moon v-if="!settings.dark" class="w-4 h-4" />
          <Sun v-else class="w-4 h-4" />
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

    <!-- Mobile search bar -->
    <div
      v-if="showMobileSearch"
      class="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 sm:hidden"
    >
      <div class="relative flex-1">
        <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          class="w-full py-1 pl-8 pr-2.5 border border-slate-200 dark:border-slate-600 rounded-md text-[13px] text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-(--accent-400) focus:border-(--accent-400)"
          type="text"
          placeholder="Search..."
          :value="store.searchQuery"
          @input="store.searchQuery = ($event.target as HTMLInputElement).value"
          @keydown.escape="store.searchQuery = ''; showMobileSearch = false"
        />
      </div>
    </div>

    <!-- Zoom breadcrumb bar -->
    <div
      v-if="store.zoomId"
      class="flex items-center gap-1 px-4 py-1.5 text-xs border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
    >
      <button
        class="hover:underline"
        style="color: var(--accent-500)"
        @click="onZoomRoot"
      >
        Root
      </button>
      <template v-for="crumb in store.zoomBreadcrumbs" :key="crumb.id">
        <ChevronRight class="w-3 h-3 text-slate-400 shrink-0" />
        <button
          class="text-slate-500 dark:text-slate-400 hover:text-blue-500 hover:underline truncate max-w-32"
          :class="{ 'font-medium text-slate-700 dark:text-slate-200': crumb.id === store.zoomId }"
          @click="onZoomCrumb(crumb.id)"
        >
          {{ crumb.text }}
        </button>
      </template>
    </div>

    <!-- Main content -->
    <main class="flex-1 overflow-hidden">
      <Splitpanes v-if="store.viewMode === 'split'" class="h-full">
        <Pane :min-size="20" :size="50">
          <OutlineView ref="outlineRef" />
        </Pane>
        <Pane :min-size="20" :size="50">
          <KanbanBoard />
        </Pane>
      </Splitpanes>

      <div v-else-if="store.viewMode === 'outline'" class="h-full">
        <OutlineView ref="outlineRef" />
      </div>
      <div v-else class="h-full">
        <KanbanBoard />
      </div>
    </main>
  </div>

  <div v-else class="flex items-center justify-center h-full text-slate-400 text-sm">
    Loading...
  </div>

  <!-- Shortcuts modal -->
  <ShortcutsModal v-if="showShortcuts" @close="showShortcuts = false" />

  <!-- Settings panel -->
  <SettingsPanel v-if="showSettings" @close="showSettings = false" />
</template>

<style>
/* Splitpanes overrides */
.splitpanes__splitter {
  background: #e2e8f0 !important;
  min-width: 3px !important;
  min-height: 3px !important;
}
.splitpanes__splitter:hover {
  background: var(--accent-300) !important;
}
.dark .splitpanes__splitter {
  background: #334155 !important;
}
.dark .splitpanes__splitter:hover {
  background: var(--accent-400) !important;
}
</style>
