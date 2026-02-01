<script setup lang="ts">
import { ref } from 'vue'
import { useDocStore } from '@/stores/doc'
import type { Node, Status } from '@/types'

const store = useDocStore()

const columns: { key: Status; label: string; color: string }[] = [
  { key: 'todo', label: 'Todo', color: '#94a3b8' },
  { key: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { key: 'blocked', label: 'Blocked', color: '#ef4444' },
  { key: 'done', label: 'Done', color: '#22c55e' },
]

// Drag state
const dragNodeId = ref<string | null>(null)
const dragOverColumn = ref<Status | null>(null)

function onDragStart(e: DragEvent, node: Node) {
  dragNodeId.value = node.id
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', node.id)
}

function onDragOver(e: DragEvent, status: Status) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  dragOverColumn.value = status
}

function onDragLeave(_e: DragEvent, status: Status) {
  if (dragOverColumn.value === status) {
    dragOverColumn.value = null
  }
}

function onDrop(e: DragEvent, status: Status) {
  e.preventDefault()
  const nodeId = dragNodeId.value ?? e.dataTransfer!.getData('text/plain')
  if (nodeId) {
    store.setStatus(nodeId, status)
  }
  dragNodeId.value = null
  dragOverColumn.value = null
}

function onDragEnd() {
  dragNodeId.value = null
  dragOverColumn.value = null
}

function onCardClick(node: Node) {
  store.selectNode(node.id)
}

function childCount(node: Node): number {
  return store.getChildren(node.id).length
}
</script>

<template>
  <div class="kanban-board">
    <div
      v-for="col in columns"
      :key="col.key"
      class="kanban-column"
      :class="{ 'drag-over': dragOverColumn === col.key }"
      @dragover="onDragOver($event, col.key)"
      @dragleave="onDragLeave($event, col.key)"
      @drop="onDrop($event, col.key)"
    >
      <div class="column-header">
        <span
          class="column-dot"
          :style="{ backgroundColor: col.color }"
        />
        <span class="column-title">{{ col.label }}</span>
        <span class="column-count">{{ store.kanbanColumns[col.key].length }}</span>
      </div>

      <div class="column-cards">
        <div
          v-for="node in store.kanbanColumns[col.key]"
          :key="node.id"
          class="kanban-card"
          :class="{
            selected: store.selectedId === node.id,
            dragging: dragNodeId === node.id,
          }"
          draggable="true"
          @dragstart="onDragStart($event, node)"
          @dragend="onDragEnd"
          @click="onCardClick(node)"
        >
          <div class="card-title">{{ node.text || '(empty)' }}</div>
          <div class="card-meta">
            <span v-if="store.breadcrumb(node.id)" class="card-breadcrumb">
              {{ store.breadcrumb(node.id) }}
            </span>
            <span v-if="childCount(node) > 0" class="card-children">
              {{ childCount(node) }} children
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kanban-board {
  display: flex;
  gap: 12px;
  height: 100%;
  padding: 12px;
  overflow-x: auto;
}

.kanban-column {
  flex: 1;
  min-width: 200px;
  max-width: 320px;
  background: #f8fafc;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  border: 2px solid transparent;
  transition: border-color 0.15s;
}

.kanban-column.drag-over {
  border-color: #93c5fd;
  background: #eff6ff;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 8px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.column-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.column-count {
  margin-left: auto;
  background: #e2e8f0;
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
}

.column-cards {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kanban-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px 12px;
  cursor: grab;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.kanban-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.kanban-card.selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

.kanban-card.dragging {
  opacity: 0.4;
}

.kanban-card:active {
  cursor: grabbing;
}

.card-title {
  font-size: 14px;
  color: #1e293b;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  font-size: 11px;
  color: #94a3b8;
}

.card-breadcrumb {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
