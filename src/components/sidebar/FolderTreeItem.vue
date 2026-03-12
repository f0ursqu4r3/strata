<script setup lang="ts">
import { inject, type Ref } from 'vue'
import { SIDEBAR_DEPTH_INDENT, SIDEBAR_BASE_PADDING } from '@/lib/constants'
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  Plus,
  Trash2,
  FolderPlus,
} from 'lucide-vue-next'
import type { FolderTreeNode } from '@/lib/folder-tree'

const props = defineProps<{
  node: FolderTreeNode
  depth: number
  activeDocId: string
  renamingId: string | null
  renameText: string
  renameConflict: boolean
}>()

const emit = defineEmits<{
  'switch-doc': [docId: string]
  'create-doc': [folder: string]
  'create-folder': [parentPath: string]
  'delete-doc': [docId: string, e?: MouseEvent]
  'start-rename': [docId: string, name: string, e: MouseEvent]
  'folder-context': [e: MouseEvent, folderPath: string]
  'doc-context': [e: MouseEvent, docId: string]
  'update:renameText': [value: string]
  'finish-rename': []
  'rename-keydown': [e: KeyboardEvent]
}>()

const expandedFolders = inject<Ref<Set<string>>>('expandedFolders')!

const renameInputRef = inject<Ref<HTMLInputElement[]>>('renameInputRef')!

function isExpanded(): boolean {
  return expandedFolders.value.has(props.node.path)
}

function toggleExpand() {
  const newSet = new Set(expandedFolders.value)
  if (newSet.has(props.node.path)) {
    newSet.delete(props.node.path)
  } else {
    newSet.add(props.node.path)
  }
  expandedFolders.value = newSet
}
</script>

<template>
  <!-- Folder node -->
  <template v-if="node.type === 'folder'">
    <div
      class="flex items-center gap-1.5 py-1.5 cursor-pointer text-sm transition-colors text-(--text-secondary) hover:bg-(--bg-hover) group"
      :style="{ paddingLeft: `${depth * SIDEBAR_DEPTH_INDENT + SIDEBAR_BASE_PADDING}px` }"
      @click="toggleExpand"
      @contextmenu.prevent="emit('folder-context', $event, node.path)"
    >
      <ChevronRight
        class="w-3 h-3 shrink-0 text-(--text-faint) transition-transform"
        :class="{ 'rotate-90': isExpanded() }"
      />
      <component
        :is="isExpanded() ? FolderOpen : Folder"
        class="w-3.5 h-3.5 shrink-0 text-(--text-faint)"
      />
      <span class="flex-1 truncate">{{ node.name }}</span>
      <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 pr-2">
        <button
          class="p-0.5 rounded hover:bg-(--bg-active) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer"
          title="New document"
          @click.stop="emit('create-doc', node.path)"
        >
          <Plus class="w-3 h-3" />
        </button>
        <button
          class="p-0.5 rounded hover:bg-(--bg-active) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer"
          title="New sub-folder"
          @click.stop="emit('create-folder', node.path)"
        >
          <FolderPlus class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Children (when expanded) -->
    <template v-if="isExpanded()">
      <FolderTreeItem
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :active-doc-id="activeDocId"
        :renaming-id="renamingId"
        :rename-text="renameText"
        :rename-conflict="renameConflict"
        @switch-doc="emit('switch-doc', $event)"
        @create-doc="emit('create-doc', $event)"
        @create-folder="emit('create-folder', $event)"
        @delete-doc="(id, e) => emit('delete-doc', id, e)"
        @start-rename="(id, name, e) => emit('start-rename', id, name, e)"
        @folder-context="(e, path) => emit('folder-context', e, path)"
        @doc-context="(e, id) => emit('doc-context', e, id)"
        @update:rename-text="emit('update:renameText', $event)"
        @finish-rename="emit('finish-rename')"
        @rename-keydown="emit('rename-keydown', $event)"
      />
    </template>
  </template>

  <!-- File node -->
  <template v-else>
    <div
      class="flex items-center gap-2 py-1.5 cursor-pointer text-sm transition-colors group"
      :class="
        node.docId === activeDocId
          ? 'bg-(--bg-active) text-(--text-primary) font-medium'
          : 'text-(--text-secondary) hover:bg-(--bg-hover)'
      "
      :style="{ paddingLeft: `${depth * SIDEBAR_DEPTH_INDENT + SIDEBAR_BASE_PADDING}px` }"
      @click="emit('switch-doc', node.docId!)"
      @dblclick="emit('start-rename', node.docId!, node.name, $event)"
      @contextmenu.prevent="emit('doc-context', $event, node.docId!)"
    >
      <FileText class="w-3.5 h-3.5 shrink-0 text-(--text-faint)" />

      <!-- Rename input -->
      <div v-if="renamingId === node.docId" class="flex-1 min-w-0 relative">
        <input
          ref="renameInputRef"
          :value="renameText"
          class="w-full bg-transparent border rounded px-1 py-0.5 text-sm text-(--text-primary) outline-none focus:ring-1"
          :class="
            renameConflict
              ? 'border-(--color-danger) focus:ring-(--color-danger)'
              : 'border-(--border-secondary) focus:ring-(--accent-400)'
          "
          @input="emit('update:renameText', ($event.target as HTMLInputElement).value)"
          @blur="emit('finish-rename')"
          @keydown="emit('rename-keydown', $event)"
          @click.stop
        />
        <div
          v-if="renameConflict"
          class="absolute left-0 top-full text-[10px] text-(--color-danger) mt-0.5"
        >
          Name already exists
        </div>
      </div>

      <!-- Document name -->
      <span v-else class="flex-1 truncate">{{ node.name }}</span>

      <!-- Delete button -->
      <button
        v-if="renamingId !== node.docId"
        class="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:text-(--color-danger) text-(--text-faint) cursor-pointer pr-2"
        title="Delete document"
        @click.stop="emit('delete-doc', node.docId!, $event)"
      >
        <Trash2 class="w-3 h-3" />
      </button>
    </div>
  </template>
</template>
