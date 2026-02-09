<script setup lang="ts">
import { ref } from 'vue'
import { Settings2 } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { useDocStore } from '@/stores/doc'
import { UiModal } from '@/components/ui'
import { TAG_COLOR_PRESETS, TAG_COLOR_KEYS, tagStyle } from '@/lib/tag-colors'

const emit = defineEmits<{ close: []; openStatusEditor: [] }>()
const settings = useSettingsStore()
const store = useDocStore()
const colorPickerTag = ref<string | null>(null)

function toggleColorPicker(tag: string) {
  colorPickerTag.value = colorPickerTag.value === tag ? null : tag
}

function pickColor(tag: string, colorKey: string | null) {
  store.setTagColor(tag, colorKey)
  colorPickerTag.value = null
}
</script>

<template>
  <UiModal title="Document Settings" max-width="md" @close="emit('close')">
    <div class="p-5 space-y-6">
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

      <!-- Tags -->
      <div>
        <h3 class="text-xs font-semibold text-(--text-faint) uppercase tracking-wide mb-3">
          Tags
        </h3>
        <div v-if="store.allTags.length > 0" class="flex flex-wrap gap-2">
          <div
            v-for="tag in store.allTags"
            :key="tag"
            class="relative"
          >
            <button
              class="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium cursor-pointer border transition-colors"
              :class="tagStyle(tag, store.tagColors, settings.dark) ? 'border-transparent' : 'bg-(--accent-100) text-(--accent-700) border-transparent'"
              :style="tagStyle(tag, store.tagColors, settings.dark) ?? {}"
              @click="toggleColorPicker(tag)"
            >
              <span
                class="w-2.5 h-2.5 rounded-full border border-current opacity-60"
              />
              {{ tag }}
            </button>
            <!-- Color picker popover -->
            <div
              v-if="colorPickerTag === tag"
              class="absolute left-0 top-full z-50 mt-1 bg-(--bg-secondary) border border-(--border-primary) rounded-lg shadow-lg p-2"
            >
              <div class="flex gap-1">
                <button
                  class="w-5 h-5 rounded-full border-2 cursor-pointer bg-(--accent-100)"
                  :class="!store.tagColors[tag] ? 'border-(--accent-500)' : 'border-transparent hover:border-(--border-hover)'"
                  title="Default"
                  @click="pickColor(tag, null)"
                />
                <button
                  v-for="key in TAG_COLOR_KEYS"
                  :key="key"
                  class="w-5 h-5 rounded-full border-2 cursor-pointer"
                  :class="store.tagColors[tag] === key ? 'border-(--text-primary)' : 'border-transparent hover:border-(--border-hover)'"
                  :style="{ backgroundColor: settings.dark ? TAG_COLOR_PRESETS[key]!.darkBg : TAG_COLOR_PRESETS[key]!.lightBg }"
                  :title="TAG_COLOR_PRESETS[key]!.label"
                  @click="pickColor(tag, key)"
                />
              </div>
            </div>
          </div>
        </div>
        <p v-else class="text-[11px] text-(--text-faint)">
          No tags in this document yet. Add tags to nodes to manage them here.
        </p>
        <p v-if="store.allTags.length > 0" class="text-[11px] text-(--text-faint) mt-2">
          Click a tag to change its color.
        </p>
      </div>
    </div>
  </UiModal>
</template>
