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
  <div class="app-shell" v-if="store.ready">
    <!-- Top bar -->
    <header class="top-bar">
      <div class="top-left">
        <span class="app-name">Strata</span>
      </div>

      <div class="top-center">
        <div class="view-toggle">
          <button
            v-for="m in modes"
            :key="m.key"
            class="toggle-btn"
            :class="{ active: store.viewMode === m.key }"
            @click="store.setViewMode(m.key)"
          >
            {{ m.label }}
          </button>
        </div>
      </div>

      <div class="top-right">
        <input
          class="search-box"
          type="text"
          placeholder="Search..."
          disabled
        />
      </div>
    </header>

    <!-- Main content -->
    <main class="main-content">
      <div
        v-if="store.viewMode === 'outline' || store.viewMode === 'split'"
        class="panel outline-panel"
        :class="{ full: store.viewMode === 'outline' }"
      >
        <OutlineView />
      </div>

      <div
        v-if="store.viewMode === 'split'"
        class="panel-divider"
      />

      <div
        v-if="store.viewMode === 'board' || store.viewMode === 'split'"
        class="panel board-panel"
        :class="{ full: store.viewMode === 'board' }"
      >
        <KanbanBoard />
      </div>
    </main>
  </div>

  <div v-else class="loading">
    Loading...
  </div>
</template>

<style>
/* Global reset */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#app {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
  color: #1e293b;
  background: #fff;
}
</style>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.top-bar {
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
  flex-shrink: 0;
}

.top-left {
  flex: 1;
}

.app-name {
  font-weight: 700;
  font-size: 16px;
  color: #0f172a;
  letter-spacing: -0.3px;
}

.top-center {
  flex: 0 0 auto;
}

.view-toggle {
  display: flex;
  background: #f1f5f9;
  border-radius: 6px;
  padding: 2px;
}

.toggle-btn {
  border: none;
  background: transparent;
  padding: 4px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}

.toggle-btn.active {
  background: #fff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.toggle-btn:hover:not(.active) {
  color: #475569;
}

.top-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
}

.search-box {
  width: 200px;
  padding: 5px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #94a3b8;
  background: #f8fafc;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.panel {
  flex: 1;
  overflow: hidden;
}

.panel.full {
  flex: 1;
}

.outline-panel {
  min-width: 300px;
}

.board-panel {
  min-width: 400px;
}

.panel-divider {
  width: 1px;
  background: #e2e8f0;
  flex-shrink: 0;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
  font-size: 14px;
}
</style>
