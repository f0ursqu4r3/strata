<script setup lang="ts">
import { onMounted } from 'vue'
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
      <div class="flex-1">
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
        <input
          class="w-50 py-1 px-2.5 border border-slate-200 rounded-md text-[13px] text-slate-800 bg-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          type="text"
          placeholder="Search..."
          :value="store.searchQuery"
          @input="store.searchQuery = ($event.target as HTMLInputElement).value"
          @keydown.escape="store.searchQuery = ''; ($event.target as HTMLInputElement).blur()"
        />
      </div>
    </header>

    <!-- Main content -->
    <main class="flex-1 flex overflow-hidden">
      <div
        v-if="store.viewMode === 'outline' || store.viewMode === 'split'"
        class="flex-1 overflow-hidden min-w-75"
      >
        <OutlineView />
      </div>

      <div
        v-if="store.viewMode === 'split'"
        class="w-px bg-slate-200 shrink-0"
      />

      <div
        v-if="store.viewMode === 'board' || store.viewMode === 'split'"
        class="flex-1 overflow-hidden min-w-100"
      >
        <KanbanBoard />
      </div>
    </main>
  </div>

  <div v-else class="flex items-center justify-center h-full text-slate-400 text-sm">
    Loading...
  </div>
</template>
