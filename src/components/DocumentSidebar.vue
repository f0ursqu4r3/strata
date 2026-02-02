<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { Plus, FileText, Trash2, X } from 'lucide-vue-next'
import { useDocumentsStore } from '@/stores/documents'
import { useDocStore } from '@/stores/doc'

const emit = defineEmits<{ close: [] }>()
const docsStore = useDocumentsStore()
const docStore = useDocStore()

const renamingId = ref<string | null>(null)
const renameInputRef = ref<HTMLInputElement[]>([])
const renameText = ref('')

async function onCreateNew() {
  const id = docsStore.createDocument('Untitled')
  await docsStore.switchDocument(id)
  await docStore.loadDocument(id)
  // Start renaming immediately
  renamingId.value = id
  renameText.value = 'Untitled'
  await nextTick()
  renameInputRef.value?.focus()
  renameInputRef.value?.select()
}

async function onSwitchDoc(docId: string) {
  if (docId === docsStore.activeId) return
  docStore.flushTextDebounce()
  await docsStore.switchDocument(docId)
  await docStore.loadDocument(docId)
}

function baseName(name: string): string {
  const slash = name.lastIndexOf('/')
  return slash >= 0 ? name.substring(slash + 1) : name
}

function dirPrefix(name: string): string {
  const slash = name.lastIndexOf('/')
  return slash >= 0 ? name.substring(0, slash + 1) : ''
}

function startRename(docId: string, name: string, e: MouseEvent) {
  e.stopPropagation()
  renamingId.value = docId
  renameText.value = baseName(name)
  nextTick(() => {
    renameInputRef.value[0]?.focus()
    renameInputRef.value[0]?.select()
  })
}

function finishRename() {
  if (renamingId.value && renameText.value.trim()) {
    docsStore.renameDocument(renamingId.value, renameText.value.trim())
  }
  renamingId.value = null
}

function onRenameKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    finishRename()
  } else if (e.key === 'Escape') {
    renamingId.value = null
  }
}

async function onDelete(docId: string, e: MouseEvent) {
  e.stopPropagation()
  if (docsStore.documents.length <= 1) return
  if (!confirm('Delete this document? This cannot be undone.')) return
  await docsStore.deleteDocument(docId)
  // If we switched documents, reload
  await docStore.loadDocument(docsStore.activeId)
}
</script>

<template>
  <div class="flex flex-col h-full bg-(--bg-secondary) border-r border-(--border-primary) w-56">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-3 border-b border-(--border-primary)">
      <span class="text-xs font-semibold text-(--text-faint) uppercase tracking-wide">Documents</span>
      <div class="flex items-center gap-1">
        <button
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer"
          title="New document"
          @click="onCreateNew"
        >
          <Plus class="w-3.5 h-3.5" />
        </button>
        <button
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer sm:hidden"
          title="Close sidebar"
          @click="emit('close')"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Document list -->
    <div class="flex-1 overflow-y-auto py-1">
      <div
        v-for="doc in docsStore.sortedDocuments"
        :key="doc.id"
        class="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm transition-colors group"
        :class="
          doc.id === docsStore.activeId
            ? 'bg-(--bg-active) text-(--text-primary) font-medium'
            : 'text-(--text-secondary) hover:bg-(--bg-hover)'
        "
        @click="onSwitchDoc(doc.id)"
        @dblclick="startRename(doc.id, doc.name, $event)"
      >
        <FileText class="w-3.5 h-3.5 shrink-0 text-(--text-faint)" />

        <!-- Rename input -->
        <input
          v-if="renamingId === doc.id"
          ref="renameInputRef"
          v-model="renameText"
          class="flex-1 min-w-0 bg-transparent border border-(--border-secondary) rounded px-1 py-0.5 text-sm text-(--text-primary) outline-none focus:ring-1 focus:ring-(--accent-400)"
          @blur="finishRename"
          @keydown="onRenameKeydown"
          @click.stop
        />

        <!-- Document name -->
        <span
          v-else
          class="flex-1 truncate"
        >
          <span v-if="dirPrefix(doc.name)" class="text-(--text-faint) text-xs">{{ dirPrefix(doc.name) }}</span>{{ baseName(doc.name) }}
        </span>

        <!-- Delete button -->
        <button
          v-if="docsStore.documents.length > 1 && renamingId !== doc.id"
          class="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:text-(--color-danger) text-(--text-faint) cursor-pointer"
          title="Delete document"
          @click="onDelete(doc.id, $event)"
        >
          <Trash2 class="w-3 h-3" />
        </button>
      </div>
    </div>
  </div>
</template>
