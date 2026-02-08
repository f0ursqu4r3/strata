<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'
import { comboToString } from '@/lib/shortcuts'
import { useShortcutCapture } from '@/composables/settings/useShortcutCapture'
import { UiModal, UiKbd, UiButton } from '@/components/ui'

const emit = defineEmits<{ close: [] }>()

const {
  editingAction,
  capturedCombo,
  categories,
  conflicts,
  isCustomized,
  startCapture,
  cancelCapture,
  confirmCapture,
  resetOne,
  resetAll,
} = useShortcutCapture()
</script>

<template>
  <UiModal title="Keyboard Shortcuts" max-width="lg" @close="emit('close')">
    <template #header-actions>
      <UiButton variant="ghost" size="xs" @click="resetAll">
        Reset all
      </UiButton>
    </template>

    <div class="p-5 space-y-5">
      <div v-for="cat in categories" :key="cat.name">
        <h3 class="text-xs font-semibold text-(--text-faint) uppercase tracking-wide mb-2">
          {{ cat.name }}
        </h3>
        <div class="space-y-1">
          <div
            v-for="def in cat.defs"
            :key="def.action"
            class="flex items-center justify-between py-1.5 px-2 rounded"
            :class="editingAction === def.action ? 'bg-(--bg-hover)' : ''"
          >
            <span class="text-sm text-(--text-tertiary)">{{ def.label }}</span>
            <div class="flex items-center gap-1.5">
              <!-- Current combo or capture state -->
              <template v-if="editingAction === def.action">
                <span v-if="!capturedCombo" class="text-xs text-(--text-faint) italic">
                  Press a key combo...
                </span>
                <template v-else>
                  <kbd
                    class="px-1.5 py-0.5 text-xs font-mono rounded border"
                    :class="conflicts.length > 0
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-(--bg-kbd) text-(--text-tertiary) border-(--border-primary)'"
                  >
                    {{ comboToString(capturedCombo) }}
                  </kbd>
                  <span v-if="conflicts.length > 0" class="text-[10px] text-red-600">
                    Conflicts with "{{ conflicts[0]!.label }}"
                  </span>
                </template>
                <UiButton
                  variant="primary"
                  size="xs"
                  :disabled="!capturedCombo || conflicts.length > 0"
                  @click="confirmCapture"
                >
                  Save
                </UiButton>
                <UiButton variant="ghost" size="xs" @click="cancelCapture">
                  Cancel
                </UiButton>
              </template>
              <template v-else>
                <UiKbd>{{ comboToString(def.combo) }}</UiKbd>
                <button
                  v-if="isCustomized(def.action)"
                  class="p-0.5 rounded hover:bg-(--bg-hover) text-(--text-faint) cursor-pointer"
                  title="Reset to default"
                  @click="resetOne(def.action)"
                >
                  <RotateCcw class="w-3 h-3" />
                </button>
                <UiButton variant="ghost" size="xs" @click="startCapture(def.action)">
                  Edit
                </UiButton>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </UiModal>
</template>
