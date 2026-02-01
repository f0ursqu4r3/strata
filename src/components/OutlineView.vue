<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useDocStore } from '@/stores/doc'
import OutlineRow from './OutlineRow.vue'

const store = useDocStore()
const containerRef = ref<HTMLElement | null>(null)

function onKeydown(e: KeyboardEvent) {
  // Don't handle if editing (row handles its own keys)
  if (store.editingId) return

  switch (e.key) {
    case 'ArrowUp':
      store.moveSelectionUp()
      e.preventDefault()
      scrollSelectedIntoView()
      break
    case 'ArrowDown':
      store.moveSelectionDown()
      e.preventDefault()
      scrollSelectedIntoView()
      break
    case 'Enter':
      if (store.selectedId) {
        store.startEditing(store.selectedId)
        e.preventDefault()
      }
      break
    case 'Tab':
      if (e.shiftKey) {
        store.outdentNode()
      } else {
        store.indentNode()
      }
      e.preventDefault()
      break
    case 'Delete':
    case 'Backspace':
      if (store.selectedId) {
        const rows = store.visibleRows
        const idx = rows.findIndex((r) => r.node.id === store.selectedId)
        const nextId =
          rows[idx + 1]?.node.id ?? rows[idx - 1]?.node.id ?? null
        store.tombstone(store.selectedId)
        if (nextId) store.selectNode(nextId)
        e.preventDefault()
      }
      break
    case ' ':
      if (store.selectedId) {
        const node = store.nodes.get(store.selectedId)
        if (node && store.getChildren(node.id).length > 0) {
          store.toggleCollapsed(node.id)
          e.preventDefault()
        }
      }
      break
    case 'z':
      if (e.ctrlKey || e.metaKey) {
        // placeholder for undo
        e.preventDefault()
      }
      break
  }
}

function scrollSelectedIntoView() {
  nextTick(() => {
    const el = containerRef.value?.querySelector('.outline-row.selected')
    el?.scrollIntoView({ block: 'nearest' })
  })
}

// Scroll into view when selectedId changes externally (e.g., from kanban click)
watch(
  () => store.selectedId,
  () => {
    scrollSelectedIntoView()
  },
)

const zoomNode = ref<string | null>(null)
watch(
  () => store.zoomId,
  (id) => {
    zoomNode.value = id
  },
)
</script>

<template>
  <div
    class="outline-view"
    ref="containerRef"
    tabindex="0"
    @keydown="onKeydown"
  >
    <!-- Zoom breadcrumb -->
    <div v-if="store.zoomId" class="zoom-bar">
      <button class="zoom-back" @click="store.zoomOut()">← Back</button>
      <span class="zoom-path">
        {{ store.nodes.get(store.zoomId)?.text ?? 'Zoomed' }}
      </span>
    </div>

    <!-- Rows -->
    <div class="rows">
      <OutlineRow
        v-for="row in store.visibleRows"
        :key="row.node.id"
        :node="row.node"
        :depth="row.depth"
      />
      <div
        v-if="store.visibleRows.length === 0"
        class="empty-state"
      >
        No items. Press Enter to create one.
      </div>
    </div>
  </div>
</template>

<style scoped>
.outline-view {
  height: 100%;
  overflow-y: auto;
  outline: none;
  padding: 8px 0;
}

.outline-view:focus-within {
  /* subtle indicator */
}

.zoom-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 8px;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 4px;
}

.zoom-back {
  background: none;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  color: #475569;
}

.zoom-back:hover {
  background: #f1f5f9;
}

.zoom-path {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

.rows {
  padding: 0 4px;
}

.empty-state {
  padding: 24px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}
</style>
