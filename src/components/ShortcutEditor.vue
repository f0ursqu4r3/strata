<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { X, RotateCcw } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import {
  comboToString,
  findConflicts,
  DEFAULT_SHORTCUTS,
  type ShortcutAction,
  type KeyCombo,
} from '@/lib/shortcuts'

const emit = defineEmits<{ close: [] }>()
const settings = useSettingsStore()

const editingAction = ref<ShortcutAction | null>(null)
const capturedCombo = ref<KeyCombo | null>(null)

const categories = computed(() => {
  const cats: { name: string; defs: typeof settings.resolvedShortcuts }[] = []
  const catMap = new Map<string, typeof settings.resolvedShortcuts>()
  for (const def of settings.resolvedShortcuts) {
    let arr = catMap.get(def.category)
    if (!arr) {
      arr = []
      catMap.set(def.category, arr)
      cats.push({ name: def.category, defs: arr })
    }
    arr.push(def)
  }
  return cats
})

const conflicts = computed(() => {
  if (!editingAction.value || !capturedCombo.value) return []
  const def = settings.resolvedShortcuts.find((s) => s.action === editingAction.value)
  if (!def) return []
  return findConflicts(settings.resolvedShortcuts, capturedCombo.value, def.context, editingAction.value)
})

function isCustomized(action: ShortcutAction): boolean {
  const defaultDef = DEFAULT_SHORTCUTS.find((s) => s.action === action)
  const resolved = settings.resolvedShortcuts.find((s) => s.action === action)
  if (!defaultDef || !resolved) return false
  return comboToString(defaultDef.combo) !== comboToString(resolved.combo)
}

function startCapture(action: ShortcutAction) {
  editingAction.value = action
  capturedCombo.value = null
}

function cancelCapture() {
  editingAction.value = null
  capturedCombo.value = null
}

function confirmCapture() {
  if (editingAction.value && capturedCombo.value && conflicts.value.length === 0) {
    settings.updateShortcut(editingAction.value, capturedCombo.value)
  }
  editingAction.value = null
  capturedCombo.value = null
}

function resetOne(action: ShortcutAction) {
  settings.resetShortcut(action)
}

function resetAll() {
  settings.resetAllShortcuts()
}

function onKeydown(e: KeyboardEvent) {
  if (editingAction.value) {
    e.preventDefault()
    e.stopPropagation()
    // Ignore lone modifier keys
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return
    capturedCombo.value = {
      key: e.key,
      ctrl: e.ctrlKey || e.metaKey || undefined,
      shift: e.shiftKey || undefined,
      alt: e.altKey || undefined,
    }
    // Clean up falsy values
    if (!capturedCombo.value.ctrl) delete capturedCombo.value.ctrl
    if (!capturedCombo.value.shift) delete capturedCombo.value.shift
    if (!capturedCombo.value.alt) delete capturedCombo.value.alt
    return
  }
  if (e.key === 'Escape') {
    emit('close')
    e.preventDefault()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown, true))
onUnmounted(() => document.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    role="dialog"
    aria-modal="true"
    aria-label="Keyboard shortcut editor"
    @mousedown.self="emit('close')"
  >
    <div class="bg-(--bg-secondary) rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
      <div class="flex items-center justify-between px-5 py-4 border-b border-(--border-primary)">
        <h2 class="text-base font-semibold text-(--text-primary)">Keyboard Shortcuts</h2>
        <div class="flex items-center gap-2">
          <button
            class="text-[11px] text-(--text-faint) hover:text-(--text-secondary) px-2 py-1 rounded hover:bg-(--bg-hover) cursor-pointer"
            @click="resetAll"
          >
            Reset all
          </button>
          <button
            class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) cursor-pointer"
            @click="emit('close')"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

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
                  <button
                    class="text-[10px] px-1.5 py-0.5 rounded bg-(--accent-500) text-white cursor-pointer disabled:opacity-40"
                    :disabled="!capturedCombo || conflicts.length > 0"
                    @click="confirmCapture"
                  >
                    Save
                  </button>
                  <button
                    class="text-[10px] px-1.5 py-0.5 rounded text-(--text-faint) hover:text-(--text-secondary) cursor-pointer"
                    @click="cancelCapture"
                  >
                    Cancel
                  </button>
                </template>
                <template v-else>
                  <kbd
                    class="px-1.5 py-0.5 text-xs font-mono bg-(--bg-kbd) text-(--text-tertiary) rounded border border-(--border-primary)"
                  >
                    {{ comboToString(def.combo) }}
                  </kbd>
                  <button
                    v-if="isCustomized(def.action)"
                    class="p-0.5 rounded hover:bg-(--bg-hover) text-(--text-faint) cursor-pointer"
                    title="Reset to default"
                    @click="resetOne(def.action)"
                  >
                    <RotateCcw class="w-3 h-3" />
                  </button>
                  <button
                    class="text-[10px] px-1.5 py-0.5 rounded text-(--text-faint) hover:text-(--text-secondary) hover:bg-(--bg-hover) cursor-pointer"
                    @click="startCapture(def.action)"
                  >
                    Edit
                  </button>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
