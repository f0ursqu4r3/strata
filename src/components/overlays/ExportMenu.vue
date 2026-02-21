<script setup lang="ts">
import { Download } from 'lucide-vue-next'
import { useDocStore } from '@/stores/doc'
import { UiDropdown, UiIconButton, UiMenu, UiMenuItem } from '@/components/ui'
import type { ExportFormat } from '@/lib/doc-export'

const store = useDocStore()

const formats: { key: ExportFormat; label: string }[] = [
  { key: 'json', label: 'JSON' },
  { key: 'markdown', label: 'Markdown' },
  { key: 'opml', label: 'OPML' },
  { key: 'plaintext', label: 'Plain Text' },
]

function onExport(format: ExportFormat) {
  store.downloadExport(format)
}
</script>

<template>
  <UiDropdown align="right" width="w-36">
    <template #trigger>
      <UiIconButton title="Export">
        <Download class="w-4 h-4" />
      </UiIconButton>
    </template>
    <UiMenu>
      <UiMenuItem v-for="f in formats" :key="f.key" @click="onExport(f.key)">
        {{ f.label }}
      </UiMenuItem>
    </UiMenu>
  </UiDropdown>
</template>
