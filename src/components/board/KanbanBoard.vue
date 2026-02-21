<script setup lang="ts">
import { ref } from "vue";
import { Settings2, Calendar, Tag, Plus } from "lucide-vue-next";
import { useDocStore } from "@/stores/doc";
import { useSettingsStore } from "@/stores/settings";
import { renderInlineMarkdown } from "@/lib/inline-markdown";
import { dueDateUrgency, formatDueDate } from "@/lib/due-date";
import { getTitle } from "@/lib/text-utils";
import type { Node } from "@/types";
import ContextMenu from "../shared/ContextMenu.vue";
import ColumnContextMenu from "./ColumnContextMenu.vue";
import TagPicker from "../shared/TagPicker.vue";
import DatePicker from "../shared/DatePicker.vue";
import { useBoardDrag } from "@/composables/board/useBoardDrag";
import { useBoardEditing } from "@/composables/board/useBoardEditing";
import { tagStyle } from "@/lib/tag-colors";

const store = useDocStore();
const settings = useSettingsStore();
const emit = defineEmits<{ openStatusEditor: [] }>();

// Shared ref: drag needs to read editingCardId, editing needs to read isDragging
const editingCardId = ref<string | null>(null);

const {
  dragNodeId,
  dragOverColumn,
  isDragging,
  dropInsertIndex,
  onCardPointerDown,
  columnRefs,
} = useBoardDrag(editingCardId);

const {
  editInputRef,
  onCardClick,
  onCardDblClick,
  onCardInput,
  onCardEditBlur,
  onCardEditKeydown,
  ctxMenu,
  columnCtxMenu,
  onCardContextMenu,
  onColumnContextMenu,
  closeContextMenu,
  closeColumnContextMenu,
  editingTagsCardId,
  editingDateCardId,
  datePickerPos,
  tagPickerPos,
  onTagsClick,
  onDateClick,
} = useBoardEditing(isDragging, editingCardId);

function childCount(node: Node): number {
  return store.getChildren(node.id).length;
}
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

    <div class="flex-1 overflow-x-auto overflow-y-auto" role="region" aria-label="Kanban board" @contextmenu.prevent>
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
          @contextmenu="onColumnContextMenu($event, col.def.id)"
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
                  <Teleport to="body">
                    <div
                      v-if="editingDateCardId === node.id"
                      data-date-picker
                      class="fixed z-50"
                      :style="datePickerPos"
                    >
                      <DatePicker
                        :model-value="node.dueDate ?? null"
                        @update:model-value="
                          store.setDueDate(node.id, $event);
                          editingDateCardId = null;
                        "
                      />
                    </div>
                  </Teleport>
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
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                      :class="tagStyle(tag, store.tagColors, settings.dark) ? '' : 'bg-(--accent-100) text-(--accent-700) hover:bg-(--accent-200)'"
                      :style="tagStyle(tag, store.tagColors, settings.dark) ?? {}"
                    >
                      {{ tag }}
                    </span>
                    <span v-if="(node.tags?.length ?? 0) > 3" class="text-[10px] text-(--text-faint)">
                      +{{ node.tags!.length - 3 }}
                    </span>
                  </div>
                  <Teleport to="body">
                    <div
                      v-if="editingTagsCardId === node.id"
                      data-tag-picker
                      class="strata-popup fixed z-50 p-2"
                      :style="tagPickerPos"
                    >
                      <TagPicker :node-id="node.id" :tags="node.tags ?? []" />
                    </div>
                  </Teleport>
                </div>

                <!-- Hover actions for adding tag/date -->
                <div
                  v-if="!node.dueDate && editingDateCardId !== node.id && (!node.tags?.length && editingTagsCardId !== node.id)"
                  class="flex gap-1 mt-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity"
                >
                  <button
                    class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-muted) cursor-pointer"
                    title="Set due date"
                    @click.stop="onDateClick($event, node.id)"
                  >
                    <Calendar class="w-3 h-3" />
                  </button>
                  <button
                    v-if="settings.showBoardTags"
                    class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-muted) cursor-pointer"
                    title="Add tag"
                    @click.stop="onTagsClick($event, node.id)"
                  >
                    <Tag class="w-3 h-3" />
                  </button>
                </div>

                <!-- Show add icons when only one of tag/date exists -->
                <div
                  v-else-if="(node.dueDate && !node.tags?.length && settings.showBoardTags) || (!node.dueDate && node.tags?.length)"
                  class="flex gap-1 mt-1 opacity-0 group-hover/card:opacity-100 transition-opacity"
                >
                  <button
                    v-if="!node.dueDate && editingDateCardId !== node.id"
                    class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-muted) cursor-pointer"
                    title="Set due date"
                    @click.stop="onDateClick($event, node.id)"
                  >
                    <Calendar class="w-3 h-3" />
                  </button>
                  <button
                    v-if="settings.showBoardTags && !node.tags?.length && editingTagsCardId !== node.id"
                    class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-muted) cursor-pointer"
                    title="Add tag"
                    @click.stop="onTagsClick($event, node.id)"
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
      <!-- Card context menu -->
      <ContextMenu
        v-if="ctxMenu"
        :node-id="ctxMenu.nodeId"
        :x="ctxMenu.x"
        :y="ctxMenu.y"
        @close="closeContextMenu"
      />
      <!-- Column context menu -->
      <ColumnContextMenu
        v-if="columnCtxMenu"
        :status-id="columnCtxMenu.statusId"
        :x="columnCtxMenu.x"
        :y="columnCtxMenu.y"
        @close="closeColumnContextMenu"
        @open-status-editor="emit('openStatusEditor')"
      />
    </div>
  </div>
</template>
