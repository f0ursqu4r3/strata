<script setup lang="ts">
import { ref, computed, nextTick, onUnmounted, watch } from "vue";
import { Settings2, Calendar, Tag } from "lucide-vue-next";
import { useDocStore } from "@/stores/doc";
import { useSettingsStore } from "@/stores/settings";
import { renderInlineMarkdown } from "@/lib/inline-markdown";
import { dueDateUrgency, formatDueDate } from "@/lib/due-date";
import { getTitle, getBody, combineText } from "@/lib/text-utils";
import type { Node } from "@/types";
import ContextMenu from "./ContextMenu.vue";
import TagPicker from "./TagPicker.vue";
import DatePicker from "./DatePicker.vue";

const store = useDocStore();
const settings = useSettingsStore();
const emit = defineEmits<{ openStatusEditor: [] }>();

// ── Pointer-based drag ──
const DRAG_THRESHOLD = 5;

const dragNodeId = ref<string | null>(null);
const dragOverColumn = ref<string | null>(null);
const isDragging = ref(false);

let dragStartX = 0;
let dragStartY = 0;
let grabOffsetX = 0;
let grabOffsetY = 0;
let pendingDragNodeId: string | null = null;
let floatingEl: HTMLElement | null = null;
const columnRefs = ref<HTMLElement[]>([]);

function onCardPointerDown(e: PointerEvent, node: Node) {
  if (e.button !== 0 || editingCardId.value === node.id) return;
  pendingDragNodeId = node.id;
  dragStartX = e.clientX;
  dragStartY = e.clientY;

  // Capture grab offset relative to card top-left
  const card = (e.target as HTMLElement).closest("[data-card-id]") as HTMLElement | null;
  if (card) {
    const rect = card.getBoundingClientRect();
    grabOffsetX = e.clientX - rect.left;
    grabOffsetY = e.clientY - rect.top;
  }

  document.addEventListener("pointermove", onDocumentPointerMove);
  document.addEventListener("pointerup", onDocumentPointerUp);
  document.addEventListener("selectstart", onSelectStart);
}

function onSelectStart(e: Event) {
  if (pendingDragNodeId) e.preventDefault();
}

function onDocumentPointerMove(e: PointerEvent) {
  if (!pendingDragNodeId) return;

  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;

  if (!isDragging.value) {
    if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    // Start drag — clone the card DOM into a floating element
    isDragging.value = true;
    dragNodeId.value = pendingDragNodeId;
    window.getSelection()?.removeAllRanges();
    createFloatingCard();
  }

  // Position the floating card at the cursor, offset by grab point
  if (floatingEl) {
    floatingEl.style.left = `${e.clientX - grabOffsetX}px`;
    floatingEl.style.top = `${e.clientY - grabOffsetY}px`;
  }

  // Detect which column the pointer is over
  dragOverColumn.value = null;
  for (const col of columnRefs.value) {
    const rect = col.getBoundingClientRect();
    if (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    ) {
      dragOverColumn.value = col.dataset.statusId ?? null;
      break;
    }
  }
}

function createFloatingCard() {
  const source = document.querySelector(
    `[data-card-id="${pendingDragNodeId}"]`,
  ) as HTMLElement | null;
  if (!source) return;
  const clone = source.cloneNode(true) as HTMLElement;
  const rect = source.getBoundingClientRect();

  clone.style.position = "fixed";
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;
  clone.style.width = `${rect.width}px`;
  clone.style.zIndex = "9999";
  clone.style.pointerEvents = "none";
  clone.style.opacity = "1";
  clone.style.boxShadow = "0 8px 24px rgba(0,0,0,0.18)";
  clone.style.transform = "scale(1.02)";
  clone.style.transition = "box-shadow 0.15s, transform 0.15s";
  clone.classList.remove("opacity-40");
  clone.removeAttribute("data-card-id");

  document.body.appendChild(clone);
  floatingEl = clone;
}

function destroyFloatingCard() {
  if (floatingEl) {
    floatingEl.remove();
    floatingEl = null;
  }
}

function onDocumentPointerUp() {
  document.removeEventListener("pointermove", onDocumentPointerMove);
  document.removeEventListener("pointerup", onDocumentPointerUp);
  document.removeEventListener("selectstart", onSelectStart);

  if (isDragging.value && dragNodeId.value && dragOverColumn.value) {
    store.setStatus(dragNodeId.value, dragOverColumn.value);
  }

  destroyFloatingCard();
  pendingDragNodeId = null;
  dragNodeId.value = null;
  dragOverColumn.value = null;
  isDragging.value = false;
}

onUnmounted(() => {
  document.removeEventListener("pointermove", onDocumentPointerMove);
  document.removeEventListener("pointerup", onDocumentPointerUp);
  document.removeEventListener("selectstart", onSelectStart);
  document.removeEventListener("mousedown", onTagPickerClickOutside, true);
  document.removeEventListener("mousedown", onDatePickerClickOutside, true);
  destroyFloatingCard();
});

// Compute where the dragged card would land in the target column based on outline order
const dropInsertIndex = computed(() => {
  if (!dragNodeId.value || !dragOverColumn.value) return -1;
  const dragNode = store.nodes.get(dragNodeId.value);
  if (!dragNode || dragNode.status === dragOverColumn.value) return -1;

  // kanbanNodes is in outline order (depth-first). Find the dragged node's
  // position relative to the other nodes that are in the target column.
  const allNodes = store.kanbanNodes;
  const dragIdx = allNodes.findIndex((n) => n.id === dragNodeId.value);
  if (dragIdx === -1) return -1;

  // Find the target column's current nodes
  const targetCol = store.kanbanColumns.find((c) => c.def.id === dragOverColumn.value);
  if (!targetCol) return -1;

  // Count how many target-column nodes appear before the dragged node in outline order
  let insertIdx = 0;
  for (const colNode of targetCol.nodes) {
    const colNodeIdx = allNodes.findIndex((n) => n.id === colNode.id);
    if (colNodeIdx < dragIdx) insertIdx++;
    else break;
  }
  return insertIdx;
});

// Inline editing
const editingCardId = ref<string | null>(null);
const editInputRef = ref<HTMLInputElement | null>(null);

function onCardClick(node: Node) {
  if (isDragging.value) return;
  store.selectNode(node.id);
}

function onCardDblClick(node: Node) {
  if (isDragging.value) return;
  editingCardId.value = node.id;
  nextTick(() => {
    // editInputRef is an array because it's inside a v-for
    const input = Array.isArray(editInputRef.value) ? editInputRef.value[0] : editInputRef.value;
    if (input) {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  });
}

function onCardInput(e: Event, node: Node) {
  const newTitle = (e.target as HTMLInputElement).value;
  store.updateText(node.id, combineText(newTitle, getBody(node.text)));
}

function onCardEditBlur() {
  editingCardId.value = null;
}

function onCardEditKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" || e.key === "Enter") {
    editingCardId.value = null;
    e.preventDefault();
  }
}

function childCount(node: Node): number {
  return store.getChildren(node.id).length;
}

// Context menu
const ctxMenu = ref<{ nodeId: string; x: number; y: number } | null>(null);

function onCardContextMenu(e: MouseEvent, node: Node) {
  e.preventDefault();
  store.selectNode(node.id);
  ctxMenu.value = { nodeId: node.id, x: e.clientX, y: e.clientY };
}

function closeContextMenu() {
  ctxMenu.value = null;
}

// Tag and date pickers
const editingTagsCardId = ref<string | null>(null);
const editingDateCardId = ref<string | null>(null);

function onTagsClick(e: MouseEvent, nodeId: string) {
  e.stopPropagation();
  editingTagsCardId.value = nodeId;
}

function onDateClick(e: MouseEvent, nodeId: string) {
  e.stopPropagation();
  editingDateCardId.value = nodeId;
}

function onTagPickerClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  // Check if click is inside any tag picker wrapper
  if (!target.closest("[data-tag-picker]")) {
    editingTagsCardId.value = null;
  }
}

function onDatePickerClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  // Check if click is inside any date picker wrapper
  if (!target.closest("[data-date-picker]")) {
    editingDateCardId.value = null;
  }
}

watch(editingTagsCardId, (open) => {
  if (open) {
    setTimeout(() => document.addEventListener("mousedown", onTagPickerClickOutside, true), 0);
  } else {
    document.removeEventListener("mousedown", onTagPickerClickOutside, true);
  }
});

watch(editingDateCardId, (open) => {
  if (open) {
    setTimeout(() => document.addEventListener("mousedown", onDatePickerClickOutside, true), 0);
  } else {
    document.removeEventListener("mousedown", onDatePickerClickOutside, true);
  }
});
</script>

<template>
  <div class="flex flex-col h-full bg-(--bg-primary)">
    <!-- Kanban header with gear button -->
    <div class="flex items-center justify-end gap-1 px-3 pt-2 pb-0 shrink-0">
      <button
        class="p-1 rounded hover:bg-(--bg-hover) cursor-pointer"
        :class="
          settings.showBoardTags
            ? 'text-(--accent-500)'
            : 'text-(--text-faint) hover:text-(--text-tertiary)'
        "
        title="Toggle tags on cards"
        @click="settings.setShowBoardTags(!settings.showBoardTags)"
      >
        <Tag class="w-3.5 h-3.5" />
      </button>
      <button
        class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-tertiary) cursor-pointer"
        title="Manage statuses"
        @click="emit('openStatusEditor')"
      >
        <Settings2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <div class="flex-1 overflow-x-auto overflow-y-auto" role="region" aria-label="Kanban board">
      <div class="flex flex-col justify-center sm:flex-row gap-3 p-3 pt-1 min-w-max min-h-full">
        <div
          v-for="col in store.kanbanColumns"
          :key="col.def.id"
          ref="columnRefs"
          :data-status-id="col.def.id"
          class="flex-1 min-w-0 sm:min-w-50 max-w-full sm:max-w-80 bg-(--bg-tertiary) rounded-lg flex flex-col border-2 transition-colors"
          :class="
            dragOverColumn === col.def.id &&
            dragOverColumn !== store.nodes.get(dragNodeId ?? '')?.status
              ? 'border-(--highlight-drag-border) bg-(--highlight-drag-bg)'
              : 'border-transparent'
          "
        >
          <!-- Column header -->
          <div
            class="flex items-center gap-2 px-3 pt-3 pb-2 text-[13px] font-semibold text-(--text-tertiary)"
          >
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0"
              :style="{ backgroundColor: col.def.color }"
            />
            <span>{{ col.def.label }}</span>
            <span
              class="ml-auto bg-(--bg-active) rounded-full px-2 py-px text-[11px] font-medium text-(--text-muted)"
            >
              {{ col.nodes.length }}
            </span>
          </div>

          <!-- Cards -->
          <div class="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-1.5">
            <template v-for="(node, nodeIdx) in col.nodes" :key="node.id">
              <!-- Drop placeholder before this card -->
              <div
                v-if="dragOverColumn === col.def.id && dropInsertIndex === nodeIdx"
                class="border-2 border-dashed border-(--accent-400) rounded-md h-10 bg-(--accent-50) opacity-60"
              />
              <div
                :data-card-id="node.id"
                class="group/card bg-(--bg-secondary) border rounded-md px-3 py-2.5 cursor-grab transition-[box-shadow,border-color] hover:border-(--border-hover) hover:shadow-sm active:cursor-grabbing select-none"
                :class="{
                  'border-(--accent-500) shadow-[0_0_0_1px_var(--accent-500)]':
                    store.selectedId === node.id && dragNodeId !== node.id,
                  'opacity-30! border-dashed! border-(--border-secondary)! shadow-none! cursor-grabbing!':
                    dragNodeId === node.id,
                  'border-(--border-primary)':
                    store.selectedId !== node.id && dragNodeId !== node.id,
                }"
                @pointerdown="onCardPointerDown($event, node)"
                @click="onCardClick(node)"
                @dblclick="onCardDblClick(node)"
                @contextmenu="onCardContextMenu($event, node)"
              >
                <div class="relative">
                  <!-- eslint-disable vue/no-v-html -->
                  <div
                    class="text-(--text-secondary) leading-snug overflow-hidden text-ellipsis whitespace-nowrap strata-text"
                    :class="{ 'invisible': editingCardId === node.id }"
                    v-html="renderInlineMarkdown(getTitle(node.text) || '(empty)')"
                  />
                  <input
                    v-if="editingCardId === node.id"
                    ref="editInputRef"
                    class="absolute inset-0 w-full text-(--text-secondary) leading-snug border-none outline-none bg-(--bg-secondary) p-0 font-[inherit] strata-text"
                    :value="getTitle(node.text)"
                    @input="onCardInput($event, node)"
                    @blur="onCardEditBlur"
                    @keydown="onCardEditKeydown"
                    spellcheck="false"
                  />
                </div>
                <div class="flex gap-2 mt-1 text-[11px] text-(--text-faint)">
                  <span
                    v-if="store.breadcrumb(node.id)"
                    class="overflow-hidden text-ellipsis whitespace-nowrap"
                  >
                    {{ store.breadcrumb(node.id) }}
                  </span>
                  <span v-if="childCount(node) > 0"> {{ childCount(node) }} children </span>
                </div>
                <!-- Due date -->
                <div class="relative mt-1" v-if="node.dueDate || editingDateCardId === node.id">
                  <span
                    v-if="node.dueDate && editingDateCardId !== node.id"
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:opacity-80"
                    :class="{
                      'bg-red-100 text-red-700': dueDateUrgency(node.dueDate) === 'overdue',
                      'bg-amber-100 text-amber-700': dueDateUrgency(node.dueDate) === 'today',
                      'bg-blue-100 text-blue-700': dueDateUrgency(node.dueDate) === 'soon',
                      'bg-(--bg-active) text-(--text-muted)':
                        dueDateUrgency(node.dueDate) === 'normal',
                    }"
                    @click="onDateClick($event, node.id)"
                  >
                    <Calendar class="w-2.5 h-2.5" />
                    {{ formatDueDate(node.dueDate) }}
                  </span>
                  <div
                    v-if="editingDateCardId === node.id"
                    data-date-picker
                    class="absolute left-0 top-0 z-40"
                  >
                    <DatePicker
                      :model-value="node.dueDate ?? null"
                      @update:model-value="
                        store.setDueDate(node.id, $event);
                        editingDateCardId = null;
                      "
                    />
                  </div>
                </div>

                <!-- Tags -->
                <div
                  v-if="settings.showBoardTags && (node.tags?.length > 0 || editingTagsCardId === node.id)"
                  class="relative mt-1.5"
                >
                  <div
                    v-if="editingTagsCardId !== node.id"
                    class="flex flex-wrap gap-1 cursor-pointer"
                    @click="onTagsClick($event, node.id)"
                  >
                    <span
                      v-for="tag in node.tags?.slice(0, 3)"
                      :key="tag"
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-(--accent-100) text-(--accent-700) hover:bg-(--accent-200)"
                    >
                      {{ tag }}
                    </span>
                    <span v-if="(node.tags?.length ?? 0) > 3" class="text-[10px] text-(--text-faint)">
                      +{{ node.tags!.length - 3 }}
                    </span>
                  </div>
                  <div
                    v-if="editingTagsCardId === node.id"
                    data-tag-picker
                    class="bg-(--bg-secondary) border border-(--border-secondary) rounded-lg shadow-lg p-2"
                  >
                    <TagPicker :node-id="node.id" :tags="node.tags ?? []" />
                  </div>
                </div>

                <!-- Hover actions for adding tag/date -->
                <div
                  v-if="!node.dueDate && editingDateCardId !== node.id && (!node.tags?.length && editingTagsCardId !== node.id)"
                  class="flex gap-1 mt-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity"
                  @click.stop
                >
                  <button
                    class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-muted) cursor-pointer"
                    title="Set due date"
                    @click="onDateClick($event, node.id)"
                  >
                    <Calendar class="w-3 h-3" />
                  </button>
                  <button
                    v-if="settings.showBoardTags"
                    class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-muted) cursor-pointer"
                    title="Add tag"
                    @click="onTagsClick($event, node.id)"
                  >
                    <Tag class="w-3 h-3" />
                  </button>
                </div>

                <!-- Show add icons when only one of tag/date exists -->
                <div
                  v-else-if="(node.dueDate && !node.tags?.length && settings.showBoardTags) || (!node.dueDate && node.tags?.length)"
                  class="flex gap-1 mt-1 opacity-0 group-hover/card:opacity-100 transition-opacity"
                  @click.stop
                >
                  <button
                    v-if="!node.dueDate && editingDateCardId !== node.id"
                    class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-muted) cursor-pointer"
                    title="Set due date"
                    @click="onDateClick($event, node.id)"
                  >
                    <Calendar class="w-3 h-3" />
                  </button>
                  <button
                    v-if="settings.showBoardTags && !node.tags?.length && editingTagsCardId !== node.id"
                    class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-muted) cursor-pointer"
                    title="Add tag"
                    @click="onTagsClick($event, node.id)"
                  >
                    <Tag class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </template>

            <!-- Drop placeholder at end of column -->
            <div
              v-if="dragOverColumn === col.def.id && dropInsertIndex === col.nodes.length"
              class="border-2 border-dashed border-(--accent-400) rounded-md h-10 bg-(--accent-50) opacity-60"
            />

            <!-- Empty column state -->
            <div
              v-if="
                col.nodes.length === 0 &&
                !(dragNodeId && dragOverColumn === col.def.id && dropInsertIndex === 0)
              "
              class="text-center text-(--text-faint) text-xs py-6"
            >
              No items
            </div>
          </div>
        </div>
      </div>
      <!-- Context menu -->
      <ContextMenu
        v-if="ctxMenu"
        :node-id="ctxMenu.nodeId"
        :x="ctxMenu.x"
        :y="ctxMenu.y"
        @close="closeContextMenu"
      />
    </div>
  </div>
</template>
