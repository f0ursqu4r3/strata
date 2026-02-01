<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useDocStore } from '@/stores/doc'
import type { Node } from '@/types'

const props = defineProps<{
  node: Node
  depth: number
}>()

const store = useDocStore()
const inputRef = ref<HTMLInputElement | null>(null)

const isSelected = computed(() => store.selectedId === props.node.id)
const isEditing = computed(() => store.editingId === props.node.id)
const hasChildren = computed(() => store.getChildren(props.node.id).length > 0)

const localText = ref(props.node.text)

watch(
  () => props.node.text,
  (v) => {
    if (!isEditing.value) localText.value = v
  },
)

watch(isEditing, async (editing) => {
  if (editing) {
    localText.value = props.node.text
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  }
})

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  localText.value = val
  store.updateText(props.node.id, val)
}

function onBlur() {
  if (isEditing.value) {
    store.stopEditing()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    store.stopEditing()
    e.preventDefault()
  } else if (e.key === 'Enter' && !e.shiftKey) {
    store.stopEditing()
    store.createSiblingBelow()
    e.preventDefault()
  } else if (e.key === 'ArrowUp' && !e.shiftKey) {
    store.stopEditing()
    store.moveSelectionUp()
    e.preventDefault()
  } else if (e.key === 'ArrowDown' && !e.shiftKey) {
    store.stopEditing()
    store.moveSelectionDown()
    e.preventDefault()
  } else if (e.key === 'Tab' && !e.shiftKey) {
    store.stopEditing()
    store.indentNode()
    store.startEditing(store.selectedId)
    e.preventDefault()
  } else if (e.key === 'Tab' && e.shiftKey) {
    store.stopEditing()
    store.outdentNode()
    store.startEditing(store.selectedId)
    e.preventDefault()
  }
}

function onClick() {
  store.selectNode(props.node.id)
}

function onDblClick() {
  store.selectNode(props.node.id)
  store.startEditing(props.node.id)
}

function onToggleCollapse(e: MouseEvent) {
  e.stopPropagation()
  store.toggleCollapsed(props.node.id)
}

const statusDot: Record<string, string> = {
  todo: '#94a3b8',
  in_progress: '#3b82f6',
  blocked: '#ef4444',
  done: '#22c55e',
}
</script>

<template>
  <div
    class="outline-row"
    :class="{ selected: isSelected, editing: isEditing }"
    :style="{ paddingLeft: depth * 24 + 8 + 'px' }"
    @click="onClick"
    @dblclick="onDblClick"
  >
    <!-- Collapse toggle -->
    <span
      class="collapse-toggle"
      :class="{ 'has-children': hasChildren }"
      @click="onToggleCollapse"
    >
      <template v-if="hasChildren">
        {{ node.collapsed ? '▸' : '▾' }}
      </template>
      <template v-else>
        <span class="bullet">•</span>
      </template>
    </span>

    <!-- Status dot -->
    <span
      class="status-dot"
      :style="{ backgroundColor: statusDot[node.status] }"
      :title="node.status"
    />

    <!-- Text -->
    <template v-if="isEditing">
      <input
        ref="inputRef"
        class="row-input"
        :value="localText"
        @input="onInput"
        @blur="onBlur"
        @keydown="onKeydown"
        spellcheck="false"
      />
    </template>
    <template v-else>
      <span class="row-text" :class="{ empty: !node.text }">
        {{ node.text || '(empty)' }}
      </span>
    </template>
  </div>
</template>

<style scoped>
.outline-row {
  display: flex;
  align-items: center;
  height: 32px;
  cursor: pointer;
  user-select: none;
  border-radius: 4px;
  gap: 6px;
}

.outline-row:hover {
  background: #f1f5f9;
}

.outline-row.selected {
  background: #e2e8f0;
}

.outline-row.editing {
  background: #dbeafe;
}

.collapse-toggle {
  width: 16px;
  flex-shrink: 0;
  text-align: center;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
}

.collapse-toggle.has-children:hover {
  color: #1e293b;
}

.bullet {
  color: #94a3b8;
  font-size: 14px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.row-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: #1e293b;
}

.row-text.empty {
  color: #94a3b8;
  font-style: italic;
}

.row-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  font-family: inherit;
  color: #1e293b;
  padding: 0;
}
</style>
