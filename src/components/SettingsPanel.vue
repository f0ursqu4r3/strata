<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { X, Minus, Plus, Settings2, FolderOpen } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { themeRegistry } from '@/data/theme-registry'
import { isTauri } from '@/lib/platform'

const emit = defineEmits<{ close: []; openStatusEditor: [] }>()
const settings = useSettingsStore()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
    e.preventDefault()
  }
}

async function changeWorkspace() {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({
    directory: true,
    title: 'Choose Strata Workspace',
  })
  if (selected) {
    settings.setWorkspacePath(selected as string)
    window.location.reload()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    role="dialog"
    aria-modal="true"
    aria-label="Settings"
    @mousedown.self="emit('close')"
  >
    <div class="bg-(--bg-secondary) rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
      <div class="flex items-center justify-between px-5 py-4 border-b border-(--border-primary)">
        <h2 class="text-base font-semibold text-(--text-primary)">Settings</h2>
        <button
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint)"
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

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
              class="p-1.5 rounded-md border border-(--border-primary) hover:bg-(--bg-hover) text-(--text-muted)"
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
              class="p-1.5 rounded-md border border-(--border-primary) hover:bg-(--bg-hover) text-(--text-muted)"
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
            <button
              class="relative w-9 h-5 rounded-full transition-colors cursor-pointer shrink-0 ml-3"
              :class="settings.vimMode ? 'bg-(--accent-500)' : 'bg-(--bg-active)'"
              role="switch"
              :aria-checked="settings.vimMode"
              @click="settings.setVimMode(!settings.vimMode)"
            >
              <span
                class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                :class="{ 'translate-x-4': settings.vimMode }"
              />
            </button>
          </label>
          <label class="flex items-center justify-between cursor-pointer">
            <span class="text-sm text-(--text-secondary)">Show tags on rows</span>
            <button
              class="relative w-9 h-5 rounded-full transition-colors cursor-pointer"
              :class="settings.showTags ? 'bg-(--accent-500)' : 'bg-(--bg-active)'"
              role="switch"
              :aria-checked="settings.showTags"
              @click="settings.setShowTags(!settings.showTags)"
            >
              <span
                class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                :class="{ 'translate-x-4': settings.showTags }"
              />
            </button>
          </label>
        </div>

        <!-- Workspace (Tauri only) -->
        <div v-if="isTauri()">
          <h3 class="text-xs font-semibold text-(--text-faint) uppercase tracking-wide mb-3">
            Workspace
          </h3>
          <div class="flex items-center gap-2">
            <code class="flex-1 text-xs text-(--text-tertiary) bg-(--bg-hover) rounded px-2 py-1.5 truncate">
              {{ settings.workspacePath || '(not set)' }}
            </code>
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-(--border-primary) hover:bg-(--bg-hover) text-(--text-secondary) cursor-pointer"
              @click="changeWorkspace"
            >
              <FolderOpen class="w-3.5 h-3.5" />
              Change
            </button>
          </div>
          <p class="text-[11px] text-(--text-faint) mt-1.5">
            Documents are saved as .md files in this folder
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
