<script setup lang="ts">
import { onMounted } from 'vue'
import { Layers, Search } from 'lucide-vue-next'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { useDocStore } from '@/stores/doc'
import OutlineView from '@/components/OutlineView.vue'
import KanbanBoard from '@/components/KanbanBoard.vue'
import type { ViewMode } from '@/types'

const store = useDocStore()

onMounted(() => {
  store.init()
})

const modes: { key: ViewMode; label: string }[] = [
  { key: 'outline', label: 'Outline' },
  { key: 'board', label: 'Board' },
  { key: 'split', label: 'Split' },
]
</script>

<template>
  <div v-if="store.ready" class="flex flex-col h-full">
    <!-- Top bar -->
    <header class="flex items-center h-12 px-4 border-b border-slate-200 bg-white shrink-0">
      <div class="flex-1 flex items-center gap-2">
        <Layers class="w-4.5 h-4.5 text-blue-500" />
        <span class="font-bold text-base text-slate-900 tracking-tight">Strata</span>
      </div>

      <div class="flex-none">
        <div class="flex bg-slate-100 rounded-md p-0.5">
          <button
            v-for="m in modes"
            :key="m.key"
            class="border-none px-3.5 py-1 text-[13px] font-medium cursor-pointer rounded transition-all"
            :class="
              store.viewMode === m.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-transparent text-slate-500 hover:text-slate-700'
            "
            @click="store.setViewMode(m.key)"
          >
            {{ m.label }}
          </button>
        </div>
      </div>

      <div class="flex-1 flex justify-end">
        <div class="relative">
          <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            class="w-50 py-1 pl-8 pr-2.5 border border-slate-200 rounded-md text-[13px] text-slate-800 bg-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            type="text"
            placeholder="Search..."
            :value="store.searchQuery"
            @input="store.searchQuery = ($event.target as HTMLInputElement).value"
            @keydown.escape="store.searchQuery = ''; ($event.target as HTMLInputElement).blur()"
          />
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="flex-1 overflow-hidden">
      <!-- Split mode with resizable panes -->
      <Splitpanes v-if="store.viewMode === 'split'" class="h-full">
        <Pane :min-size="20" :size="50">
          <OutlineView />
        </Pane>
        <Pane :min-size="20" :size="50">
          <KanbanBoard />
        </Pane>
      </Splitpanes>

      <!-- Single pane modes -->
      <div v-else-if="store.viewMode === 'outline'" class="h-full">
        <OutlineView />
      </div>
      <div v-else class="h-full">
        <KanbanBoard />
      </div>
    </main>
  </div>

  <div v-else class="flex items-center justify-center h-full text-slate-400 text-sm">
    Loading...
  </div>
</template>

<style>
/* Splitpanes overrides for clean look */
.splitpanes__splitter {
  background: #e2e8f0 !important;
  min-width: 3px !important;
  min-height: 3px !important;
}
.splitpanes__splitter:hover {
  background: #93c5fd !important;
}
</style>
