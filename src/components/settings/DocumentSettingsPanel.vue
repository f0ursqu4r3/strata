<script setup lang="ts">
import { ref, type CSSProperties } from 'vue'
import { Settings2 } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { useDocStore } from '@/stores/doc'
import { UiModal } from '@/components/ui'
import { TAG_COLOR_PRESETS, TAG_COLOR_KEYS, tagStyle } from '@/lib/tag-colors'
import { useClickOutside } from '@/composables/useClickOutside'

const emit = defineEmits<{ close: []; openStatusEditor: [] }>()
const settings = useSettingsStore()
const store = useDocStore()
const colorPickerTag = ref<string | null>(null)
const colorPickerStyle = ref<CSSProperties>({})
const colorPickerRef = ref<HTMLElement | null>(null)

useClickOutside(colorPickerRef, () => {
  colorPickerTag.value = null
})

function toggleColorPicker(tag: string, e: MouseEvent) {
  if (colorPickerTag.value === tag) {
    colorPickerTag.value = null
    return
  }
  const btn = e.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  const popoverWidth = 220
  const popoverHeight = 40
  let left = rect.left
  let top = rect.bottom + 4
  if (left + popoverWidth > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - popoverWidth - 8)
  }
  if (top + popoverHeight > window.innerHeight - 8) {
    top = rect.top - popoverHeight - 4
  }
  colorPickerStyle.value = { position: 'fixed', left: `${left}px`, top: `${top}px`, zIndex: 9999 }
  colorPickerTag.value = tag
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
          >
            <button
              class="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium cursor-pointer border transition-colors"
              :class="tagStyle(tag, store.tagColors, settings.dark) ? 'border-transparent' : 'bg-(--accent-100) text-(--accent-700) border-transparent'"
              :style="tagStyle(tag, store.tagColors, settings.dark) ?? {}"
              @click="toggleColorPicker(tag, $event)"
            >
              <span
                class="w-2.5 h-2.5 rounded-full border border-current opacity-60"
              />
              {{ tag }}
            </button>
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

  <!-- Teleported color picker popover -->
  <Teleport to="body">
    <div
      v-if="colorPickerTag"
      ref="colorPickerRef"
      class="bg-(--bg-secondary) border border-(--border-primary) rounded-lg shadow-lg p-2"
      :style="colorPickerStyle"
    >
      <div class="flex gap-1">
        <button
          class="w-5 h-5 rounded-full border-2 cursor-pointer bg-(--accent-100)"
          :class="!store.tagColors[colorPickerTag] ? 'border-(--accent-500)' : 'border-transparent hover:border-(--border-hover)'"
          title="Default"
          @click="pickColor(colorPickerTag!, null)"
        />
        <button
          v-for="key in TAG_COLOR_KEYS"
          :key="key"
          class="w-5 h-5 rounded-full border-2 cursor-pointer"
          :class="store.tagColors[colorPickerTag!] === key ? 'border-(--text-primary)' : 'border-transparent hover:border-(--border-hover)'"
          :style="{ backgroundColor: settings.dark ? TAG_COLOR_PRESETS[key]!.darkBg : TAG_COLOR_PRESETS[key]!.lightBg }"
          :title="TAG_COLOR_PRESETS[key]!.label"
          @click="pickColor(colorPickerTag!, key)"
        />
      </div>
    </div>
  </Teleport>
</template>
