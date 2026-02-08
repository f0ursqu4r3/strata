<script setup lang="ts">
import { nextTick } from 'vue'
import { Plus, FileText, Trash2, X } from 'lucide-vue-next'
import { useDocumentsStore } from '@/stores/documents'
import { useDocStore } from '@/stores/doc'
import { isTauri } from '@/lib/platform'
import { useDocumentRename } from '@/composables/sidebar/useDocumentRename'

const emit = defineEmits<{ close: [] }>()
const docsStore = useDocumentsStore()
const docStore = useDocStore()

const {
  renamingId,
  renameInputRef,
  renameText,
  renameConflict,
  baseName,
  dirPrefix,
  startRename,
  finishRename,
  onRenameKeydown,
} = useDocumentRename()

async function onCreateNew() {
  docStore.flushTextDebounce()
  const name = docsStore.nextUntitledName()
  const id = docsStore.createDocument(name)
  await docsStore.switchDocument(id)
  await docStore.loadDocument(id)
  renamingId.value = id
  renameText.value = name
  await nextTick()
  renameInputRef.value[0]?.focus()
  renameInputRef.value[0]?.select()
}

async function onSwitchDoc(docId: string) {
  if (docId === docsStore.activeId) return
  docStore.flushTextDebounce()
  await docsStore.switchDocument(docId)
  await docStore.loadDocument(docId)
}

async function onDelete(docId: string, e: MouseEvent) {
  e.stopPropagation()

  let confirmed = false
  if (isTauri()) {
    const { ask } = await import('@tauri-apps/plugin-dialog')
    confirmed = await ask('Delete this document? This cannot be undone.', {
      title: 'Delete Document',
      kind: 'warning',
    })
  } else {
    confirmed = confirm('Delete this document? This cannot be undone.')
  }
  if (!confirmed) return

  await docsStore.deleteDocument(docId)
  docStore.clearSavedHistory(docId)
  if (docsStore.activeId) {
    await docStore.loadDocument(docsStore.activeId)
  } else {
    docStore.clearToEmpty()
  }
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
        <div v-if="renamingId === doc.id" class="flex-1 min-w-0 relative">
          <input
            ref="renameInputRef"
            v-model="renameText"
            class="w-full bg-transparent border rounded px-1 py-0.5 text-sm text-(--text-primary) outline-none focus:ring-1"
            :class="renameConflict ? 'border-(--color-danger) focus:ring-(--color-danger)' : 'border-(--border-secondary) focus:ring-(--accent-400)'"
            @blur="finishRename"
            @keydown="onRenameKeydown"
            @click.stop
          />
          <div v-if="renameConflict" class="absolute left-0 top-full text-[10px] text-(--color-danger) mt-0.5">
            Name already exists
          </div>
        </div>

        <!-- Document name -->
        <span
          v-else
          class="flex-1 truncate"
        >
          <span v-if="dirPrefix(doc.name)" class="text-(--text-faint) text-xs">{{ dirPrefix(doc.name) }}</span>{{ baseName(doc.name) }}
        </span>

        <!-- Delete button -->
        <button
          v-if="renamingId !== doc.id"
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
