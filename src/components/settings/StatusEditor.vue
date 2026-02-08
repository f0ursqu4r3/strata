<script setup lang="ts">
import { Plus, Trash2, ChevronUp, ChevronDown, CircleCheck } from "lucide-vue-next";
import { useDocStore } from "@/stores/doc";
import { resolveStatusIcon, AVAILABLE_ICONS, STATUS_COLOR_PALETTE } from "@/lib/status-icons";
import { UiModal, UiIconButton, UiButton, UiColorPicker, UiIconPicker } from "@/components/ui";
import { useStatusCrud } from "@/composables/settings/useStatusCrud";

const emit = defineEmits<{ close: [] }>();
const store = useDocStore();

const {
  deletingId,
  replacementId,
  labelInputs,
  onLabelChange,
  onLabelKeydown,
  onIconChange,
  onColorChange,
  onToggleFinal,
  onMoveUp,
  onMoveDown,
  onAddStatus,
  onStartDelete,
  onConfirmDelete,
  onCloseMain,
} = useStatusCrud(emit);
</script>

<template>
  <UiModal title="Manage Statuses" max-width="md" @close="onCloseMain">
    <!-- Status list -->
    <div class="p-4 space-y-2">
      <div
        v-for="(s, idx) in store.statusDefs"
        :key="s.id"
        class="flex items-center gap-2 p-2 rounded-lg border border-(--border-primary) bg-(--bg-primary)"
      >
        <!-- Reorder buttons -->
        <div class="flex flex-col gap-0.5 shrink-0">
          <UiIconButton size="sm" :disabled="idx === 0" @click="onMoveUp(idx)">
            <ChevronUp class="w-3 h-3" />
          </UiIconButton>
          <UiIconButton size="sm" :disabled="idx === store.statusDefs.length - 1" @click="onMoveDown(idx)">
            <ChevronDown class="w-3 h-3" />
          </UiIconButton>
        </div>

        <!-- Icon picker -->
        <UiIconPicker
          :model-value="s.icon"
          :icons="AVAILABLE_ICONS"
          :resolve-icon="resolveStatusIcon"
          :color="s.color"
          @update:model-value="onIconChange(s.id, $event)"
        />

        <!-- Label -->
        <input
          :ref="(el) => { if (el) labelInputs[idx] = el as HTMLInputElement }"
          :value="s.label"
          class="flex-1 min-w-0 text-sm bg-transparent border-b border-transparent focus:border-(--border-hover) text-(--text-primary) outline-none px-1 py-0.5"
          @change="onLabelChange(s.id, ($event.target as HTMLInputElement).value)"
          @keydown="onLabelKeydown($event, idx)"
        />

        <!-- Color picker -->
        <UiColorPicker
          :model-value="s.color"
          :colors="STATUS_COLOR_PALETTE"
          @update:model-value="onColorChange(s.id, $event)"
        />

        <!-- Complete toggle -->
        <button
          class="p-1.5 rounded-md cursor-pointer transition-colors"
          :class="s.final ? 'bg-(--accent-100) text-(--accent-600)' : 'text-(--text-faint) hover:bg-(--bg-hover) hover:text-(--text-muted)'"
          :title="s.final ? 'Marks items as complete' : 'Click to mark as completion status'"
          @click="onToggleFinal(s.id, s.final)"
        >
          <CircleCheck class="w-4 h-4" />
        </button>

        <!-- Delete -->
        <UiIconButton
          variant="danger"
          :disabled="store.statusDefs.length <= 1"
          @click="onStartDelete(s.id)"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </UiIconButton>
      </div>
    </div>

    <template #footer>
      <button
        class="flex items-center gap-2 text-sm text-(--accent-600) hover:text-(--accent-700) cursor-pointer"
        @click="onAddStatus"
      >
        <Plus class="w-4 h-4" />
        Add status
      </button>
    </template>
  </UiModal>

  <!-- Delete confirmation dialog -->
  <UiModal v-if="deletingId" max-width="xs" :show-close="false" @close="deletingId = null">
    <div class="p-5">
      <h3 class="text-sm font-semibold text-(--text-primary) mb-3">Delete status</h3>
      <p class="text-sm text-(--text-secondary) mb-3">Move existing items to:</p>
      <select
        v-model="replacementId"
        class="w-full text-sm p-2 rounded-md border border-(--border-primary) bg-(--bg-primary) text-(--text-primary) mb-4"
      >
        <option
          v-for="s in store.statusDefs.filter((s) => s.id !== deletingId)"
          :key="s.id"
          :value="s.id"
        >
          {{ s.label }}
        </option>
      </select>
      <div class="flex gap-2 justify-end">
        <UiButton variant="secondary" @click="deletingId = null">Cancel</UiButton>
        <UiButton variant="danger" @click="onConfirmDelete">Delete</UiButton>
      </div>
    </div>
  </UiModal>
</template>
