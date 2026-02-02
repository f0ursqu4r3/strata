<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { X, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-vue-next";
import { useDocStore } from "@/stores/doc";
import { resolveStatusIcon, AVAILABLE_ICONS, STATUS_COLOR_PALETTE } from "@/lib/status-icons";
import type { StatusDef } from "@/types";

const emit = defineEmits<{ close: [] }>();
const store = useDocStore();

const editingIconId = ref<string | null>(null);
const editingColorId = ref<string | null>(null);
const deletingId = ref<string | null>(null);
const replacementId = ref<string>("");

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    if (editingIconId.value || editingColorId.value || deletingId.value) {
      editingIconId.value = null;
      editingColorId.value = null;
      deletingId.value = null;
    } else {
      emit("close");
    }
    e.preventDefault();
  }
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onUnmounted(() => document.removeEventListener("keydown", onKeydown));

function onLabelChange(statusId: string, value: string) {
  store.updateStatus(statusId, { label: value });
}

function onSelectIcon(statusId: string, icon: string) {
  store.updateStatus(statusId, { icon });
  editingIconId.value = null;
}

function onSelectColor(statusId: string, color: string) {
  store.updateStatus(statusId, { color });
  editingColorId.value = null;
}

function onMoveUp(idx: number) {
  if (idx <= 0) return;
  const ids = store.statusDefs.map((s) => s.id);
  [ids[idx - 1], ids[idx]] = [ids[idx]!, ids[idx - 1]!];
  store.reorderStatuses(ids);
}

function onMoveDown(idx: number) {
  if (idx >= store.statusDefs.length - 1) return;
  const ids = store.statusDefs.map((s) => s.id);
  [ids[idx], ids[idx + 1]] = [ids[idx + 1]!, ids[idx]!];
  store.reorderStatuses(ids);
}

function onAddStatus() {
  const usedColors = new Set(store.statusDefs.map((s) => s.color));
  const color = STATUS_COLOR_PALETTE.find((c) => !usedColors.has(c)) ?? STATUS_COLOR_PALETTE[0]!;
  const def: StatusDef = {
    id: crypto.randomUUID().slice(0, 8),
    label: "New Status",
    color,
    icon: "circle",
  };
  store.addStatus(def);
}

function onStartDelete(statusId: string) {
  deletingId.value = statusId;
  const other = store.statusDefs.find((s) => s.id !== statusId);
  replacementId.value = other?.id ?? "";
}

function onConfirmDelete() {
  if (!deletingId.value || !replacementId.value) return;
  store.removeStatus(deletingId.value, replacementId.value);
  deletingId.value = null;
  replacementId.value = "";
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    role="dialog"
    aria-modal="true"
    aria-label="Manage Statuses"
    @mousedown.self="emit('close')"
  >
    <div
      class="bg-(--bg-secondary) rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-5 py-4 border-b border-(--border-primary) shrink-0"
      >
        <h2 class="text-base font-semibold text-(--text-primary)">Manage Statuses</h2>
        <button
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) cursor-pointer"
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Status list -->
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        <div
          v-for="(s, idx) in store.statusDefs"
          :key="s.id"
          class="flex items-center gap-2 p-2 rounded-lg border border-(--border-primary) bg-(--bg-primary)"
        >
          <!-- Reorder buttons -->
          <div class="flex flex-col gap-0.5 shrink-0">
            <button
              class="p-0.5 rounded hover:bg-(--bg-hover) text-(--text-faint) cursor-pointer disabled:opacity-30 disabled:cursor-default"
              :disabled="idx === 0"
              @click="onMoveUp(idx)"
            >
              <ChevronUp class="w-3 h-3" />
            </button>
            <button
              class="p-0.5 rounded hover:bg-(--bg-hover) text-(--text-faint) cursor-pointer disabled:opacity-30 disabled:cursor-default"
              :disabled="idx === store.statusDefs.length - 1"
              @click="onMoveDown(idx)"
            >
              <ChevronDown class="w-3 h-3" />
            </button>
          </div>

          <!-- Icon picker -->
          <div class="relative shrink-0">
            <button
              class="p-1.5 rounded-md hover:bg-(--bg-hover) cursor-pointer"
              @click="editingIconId = editingIconId === s.id ? null : s.id"
            >
              <component
                :is="resolveStatusIcon(s.icon)"
                class="w-4 h-4"
                :style="{ color: s.color }"
              />
            </button>
            <div
              v-if="editingIconId === s.id"
              class="absolute top-full left-0 mt-1 z-10 bg-(--bg-secondary) border border-(--border-secondary) rounded-lg shadow-lg p-2 flex gap-1"
            >
              <button
                v-for="icon in AVAILABLE_ICONS"
                :key="icon"
                class="p-1.5 rounded-md hover:bg-(--bg-hover) cursor-pointer"
                :class="{ 'bg-(--bg-active)': s.icon === icon }"
                @click="onSelectIcon(s.id, icon)"
              >
                <component
                  :is="resolveStatusIcon(icon)"
                  class="w-4 h-4"
                  :style="{ color: s.color }"
                />
              </button>
            </div>
          </div>

          <!-- Label -->
          <input
            :value="s.label"
            class="flex-1 min-w-0 text-sm bg-transparent border-b border-transparent focus:border-(--border-hover) text-(--text-primary) outline-none px-1 py-0.5"
            @change="onLabelChange(s.id, ($event.target as HTMLInputElement).value)"
          />

          <!-- Color picker -->
          <div class="relative shrink-0">
            <button
              class="w-5 h-5 rounded-full border-2 border-(--border-primary) cursor-pointer"
              :style="{ backgroundColor: s.color }"
              @click="editingColorId = editingColorId === s.id ? null : s.id"
            />
            <div
              v-if="editingColorId === s.id"
              class="absolute top-full right-0 mt-1 z-10 bg-(--bg-secondary) border border-(--border-secondary) rounded-lg shadow-lg p-2 grid grid-cols-4 gap-1"
            >
              <button
                v-for="color in STATUS_COLOR_PALETTE"
                :key="color"
                class="w-6 h-6 rounded-full cursor-pointer border-2 transition-transform hover:scale-110"
                :class="s.color === color ? 'border-(--text-primary)' : 'border-transparent'"
                :style="{ backgroundColor: color }"
                @click="onSelectColor(s.id, color)"
              />
            </div>
          </div>

          <!-- Delete -->
          <button
            class="p-1 rounded hover:bg-(--color-danger-bg) text-(--text-faint) hover:text-(--color-danger) cursor-pointer disabled:opacity-30 disabled:cursor-default"
            :disabled="store.statusDefs.length <= 1"
            @click="onStartDelete(s.id)"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Add button -->
      <div class="px-4 py-3 border-t border-(--border-primary) shrink-0">
        <button
          class="flex items-center gap-2 text-sm text-(--accent-600) hover:text-(--accent-700) cursor-pointer"
          @click="onAddStatus"
        >
          <Plus class="w-4 h-4" />
          Add status
        </button>
      </div>
    </div>

    <!-- Delete confirmation dialog -->
    <div
      v-if="deletingId"
      class="fixed inset-0 z-60 flex items-center justify-center bg-black/30"
      @mousedown.self="deletingId = null"
    >
      <div class="bg-(--bg-secondary) rounded-xl shadow-2xl w-full max-w-xs p-5">
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
          <button
            class="px-3 py-1.5 text-sm rounded-md hover:bg-(--bg-hover) text-(--text-secondary) cursor-pointer"
            @click="deletingId = null"
          >
            Cancel
          </button>
          <button
            class="px-3 py-1.5 text-sm rounded-md bg-(--color-danger) text-white hover:opacity-90 cursor-pointer"
            @click="onConfirmDelete"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
