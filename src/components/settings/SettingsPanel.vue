<script setup lang="ts">
import { Minus, Plus, Settings2, FolderOpen } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { themeRegistry } from '@/data/theme-registry'
import { isTauri, isFileSystemMode, hasFileSystemAccess, setFileSystemActive } from '@/lib/platform'
import { UiModal, UiToggle, UiButton } from '@/components/ui'

const emit = defineEmits<{ close: []; openStatusEditor: [] }>()
const settings = useSettingsStore()

async function changeWorkspace() {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      directory: true,
      title: 'Choose Strata Workspace',
    })
    if (selected) {
      settings.setWorkspacePath(selected as string)
      window.location.reload()
    }
  } else if (hasFileSystemAccess()) {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      const { setHandle } = await import('@/lib/web-fs')
      await setHandle(handle)
      const { setWorkspacePrefix } = await import('@/lib/fs')
      setFileSystemActive(true)
      setWorkspacePrefix(handle.name + '/')
      settings.setWorkspacePath(handle.name)
      window.location.reload()
    } catch {
      // User cancelled
    }
  }
}
</script>

<template>
  <UiModal title="Settings" max-width="md" @close="emit('close')">
    <div class="p-5 space-y-6">
      <!-- Theme -->
      <div>
        <h3 class="text-xs font-semibold text-(--text-faint) uppercase tracking-wide mb-3">
          Theme
        </h3>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="t in themeRegistry"
            :key="t.key"
            class="flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-colors cursor-pointer"
            :class="
              settings.theme === t.key
                ? 'border-(--accent-500) ring-1 ring-(--accent-500)'
                : 'border-(--border-primary) hover:border-(--border-hover)'
            "
            @click="settings.setTheme(t.key)"
          >
            <div
              class="w-full h-8 rounded flex items-center gap-1 px-1.5"
              :style="{ backgroundColor: t.preview.bg }"
            >
              <div class="h-1.5 w-6 rounded-full" :style="{ backgroundColor: t.preview.fg }" />
              <div class="h-1.5 w-4 rounded-full" :style="{ backgroundColor: t.preview.accent }" />
            </div>
            <span class="text-[11px] text-(--text-tertiary) font-medium">{{ t.label }}</span>
          </button>
        </div>
      </div>

      <!-- Font Size -->
      <div>
        <h3 class="text-xs font-semibold text-(--text-faint) uppercase tracking-wide mb-3">
          Font Size
        </h3>
        <div class="flex items-center gap-3">
          <button
            class="p-1.5 rounded-md border border-(--border-primary) hover:bg-(--bg-hover) text-(--text-muted) cursor-pointer"
            @click="settings.setFontSize(settings.fontSize - 1)"
          >
            <Minus class="w-3.5 h-3.5" />
          </button>
          <div class="flex-1 flex items-center gap-3">
            <input
              type="range"
              :min="11"
              :max="20"
              :value="settings.fontSize"
              class="flex-1"
              style="accent-color: var(--accent-500)"
              @input="settings.setFontSize(Number(($event.target as HTMLInputElement).value))"
            />
            <span class="text-sm text-(--text-tertiary) font-mono w-8 text-right">
              {{ settings.fontSize }}
            </span>
          </div>
          <button
            class="p-1.5 rounded-md border border-(--border-primary) hover:bg-(--bg-hover) text-(--text-muted) cursor-pointer"
            @click="settings.setFontSize(settings.fontSize + 1)"
          >
            <Plus class="w-3.5 h-3.5" />
          </button>
        </div>
        <p class="text-[11px] text-(--text-faint) mt-1.5">
          Applies to outline rows and kanban cards
        </p>
      </div>

      <!-- Statuses -->
      <div>
        <h3 class="text-xs font-semibold text-(--text-faint) uppercase tracking-wide mb-3">
          Statuses
        </h3>
        <button
          class="flex items-center gap-2 text-sm text-(--accent-600) hover:text-(--accent-700) cursor-pointer"
          @click="emit('openStatusEditor')"
        >
          <Settings2 class="w-4 h-4" />
          Manage Statuses
        </button>
      </div>

      <!-- Display -->
      <div>
        <h3 class="text-xs font-semibold text-(--text-faint) uppercase tracking-wide mb-3">
          Display
        </h3>
        <label class="flex items-center justify-between cursor-pointer mb-3">
          <div>
            <span class="text-sm text-(--text-secondary)">Vim keyboard mode</span>
            <p class="text-[11px] text-(--text-faint) mt-0.5">j/k navigate, i edit, dd delete, o new sibling</p>
          </div>
          <UiToggle
            :model-value="settings.vimMode"
            class="ml-3"
            @update:model-value="settings.setVimMode($event)"
          />
        </label>
        <label class="flex items-center justify-between cursor-pointer">
          <span class="text-sm text-(--text-secondary)">Show tags on rows</span>
          <UiToggle
            :model-value="settings.showTags"
            @update:model-value="settings.setShowTags($event)"
          />
        </label>
      </div>

      <!-- Workspace -->
      <div v-if="isFileSystemMode() || hasFileSystemAccess()">
        <h3 class="text-xs font-semibold text-(--text-faint) uppercase tracking-wide mb-3">
          Workspace
        </h3>
        <div v-if="isFileSystemMode()" class="flex items-center gap-2">
          <code class="flex-1 text-xs text-(--text-tertiary) bg-(--bg-hover) rounded px-2 py-1.5 truncate">
            {{ settings.workspacePath || '(not set)' }}
          </code>
          <UiButton variant="secondary" size="xs" @click="changeWorkspace">
            <FolderOpen class="w-3.5 h-3.5" />
            Change
          </UiButton>
        </div>
        <div v-else>
          <p class="text-[11px] text-(--text-secondary) mb-2">
            Store your documents as .md files in a folder on your computer.
          </p>
          <UiButton variant="secondary" size="xs" @click="changeWorkspace">
            <FolderOpen class="w-3.5 h-3.5" />
            Choose Workspace Folder
          </UiButton>
        </div>
        <p v-if="isFileSystemMode()" class="text-[11px] text-(--text-faint) mt-1.5">
          Documents are saved as .md files in this folder
        </p>
      </div>
    </div>
  </UiModal>
</template>
