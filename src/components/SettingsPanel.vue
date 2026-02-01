<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { X, Minus, Plus } from 'lucide-vue-next'
import { useSettingsStore, themes } from '@/stores/settings'

const emit = defineEmits<{ close: [] }>()
const settings = useSettingsStore()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
    e.preventDefault()
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
    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
        <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">Settings</h2>
        <button
          class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="p-5 space-y-6">
        <!-- Theme -->
        <div>
          <h3 class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">
            Theme
          </h3>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="t in themes"
              :key="t.key"
              class="flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-colors cursor-pointer"
              :class="
                settings.theme === t.key
                  ? 'border-current ring-1 ring-current'
                  : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
              "
              :style="{ color: t.accent }"
              @click="settings.setTheme(t.key)"
            >
              <span
                class="w-6 h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm"
                :style="{ backgroundColor: t.accent }"
              />
              <span class="text-[11px] text-slate-600 dark:text-slate-300 font-medium">{{ t.label }}</span>
            </button>
          </div>
        </div>

        <!-- Font Size -->
        <div>
          <h3 class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">
            Font Size
          </h3>
          <div class="flex items-center gap-3">
            <button
              class="p-1.5 rounded-md border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
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
                class="flex-1 accent-current"
                :style="{ accentColor: themes.find((t) => t.key === settings.theme)?.accent }"
                @input="settings.setFontSize(Number(($event.target as HTMLInputElement).value))"
              />
              <span class="text-sm text-slate-600 dark:text-slate-300 font-mono w-8 text-right">
                {{ settings.fontSize }}
              </span>
            </div>
            <button
              class="p-1.5 rounded-md border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
              @click="settings.setFontSize(settings.fontSize + 1)"
            >
              <Plus class="w-3.5 h-3.5" />
            </button>
          </div>
          <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
            Applies to outline rows and kanban cards
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
