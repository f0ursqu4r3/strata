<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight, ChevronDown, Calendar, Tag } from "lucide-vue-next";
import { useDocStore } from "@/stores/doc";
import { useSettingsStore } from "@/stores/settings";
import TagPicker from "@/components/shared/TagPicker.vue";
import { resolveStatusIcon } from "@/lib/status-icons";
import { dueDateUrgency, formatDueDate } from "@/lib/due-date";
import DatePicker from "@/components/shared/DatePicker.vue";
import { useRowEditing } from "@/composables/outline/useRowEditing";
import type { Node } from "@/types";

const props = defineProps<{
  node: Node;
  depth: number;
}>();

const emit = defineEmits<{
  contextmenu: [nodeId: string, x: number, y: number];
  "row-pointerdown": [nodeId: string, event: PointerEvent];
}>();

const store = useDocStore();
const settings = useSettingsStore();

const isSelected = computed(() => store.isSelected(props.node.id));
const isEditing = computed(() => store.editingId === props.node.id);
const hasChildren = computed(() => store.getChildren(props.node.id).length > 0);
const nodeDueUrgency = computed(() => dueDateUrgency(props.node.dueDate));
const nodeDueLabel = computed(() =>
  props.node.dueDate ? formatDueDate(props.node.dueDate) : null,
);
const isSearchMatch = computed(() => {
  const matches = store.searchMatchIds;
  if (!matches) return false;
  const q = store.searchQuery.trim().toLowerCase();
  return q !== "" && props.node.text.toLowerCase().includes(q);
});

const {
  localText,
  localTitle,
  localBody,
  renderedLines,
  titleInputRef,
  bodyInputRef,
  focusBodyOnEdit,
  onTitleInput,
  onBodyInput,
  onBlur,
  onTitleKeydown,
  onBodyKeydown,
  onTitleFocus,
  onBodyFocus,
  showTagPicker,
  showDatePicker,
  datePickerWrapperRef,
  showStatusPicker,
  statusPickerRef,
  currentStatusDef,
  onStatusClick,
  onPickStatus,
} = useRowEditing(props, () => isEditing.value);

function onClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest?.("a")) return;

  if (e.shiftKey) {
    e.preventDefault();
    store.rangeSelectTo(props.node.id);
    return;
  }
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();
    store.toggleSelectNode(props.node.id);
    return;
  }

  store.selectNode(props.node.id);
  if (!isEditing.value) {
    const clickedBody = (e.target as HTMLElement).closest?.("[data-body-display]");
    if (clickedBody && localText.value.includes("\n")) {
      focusBodyOnEdit.value = true;
    }
    store.startEditing(props.node.id, "click");
  }
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  store.selectNode(props.node.id);
  emit("contextmenu", props.node.id, e.clientX, e.clientY);
}

function onBulletClick(e: MouseEvent) {
  e.stopPropagation();
  if (hasChildren.value) {
    store.toggleCollapsed(props.node.id);
  } else {
    store.zoomIn(props.node.id);
  }
}

function onBulletDblClick(e: MouseEvent) {
  e.stopPropagation();
  store.zoomIn(props.node.id);
}

function onRowPointerDown(e: PointerEvent) {
  if (e.button !== 0 || isEditing.value) return;
  emit("row-pointerdown", props.node.id, e);
}
</script>

<template>
  <div
    class="group flex items-start min-h-8 cursor-pointer select-none rounded gap-1.5 hover:bg-(--bg-hover)"
    :class="{
      'bg-(--bg-active)': isSelected && !isEditing,
      'bg-(--bg-editing)': isEditing,
      'ring-1 ring-(--accent-300)': isSelected && store.selectedIds.size > 1 && !isEditing,
      'ring-1 ring-(--highlight-search-ring) bg-(--highlight-search-bg)':
        isSearchMatch && !isSelected && !isEditing,
    }"
    :style="{ paddingLeft: depth * 24 + 8 + 'px' }"
    role="treeitem"
    :aria-selected="isSelected"
    :aria-expanded="hasChildren ? !node.collapsed : undefined"
    :aria-level="depth + 1"
    :aria-label="node.text || '(empty)'"
    @pointerdown="onRowPointerDown"
    @click="onClick"
    @contextmenu="onContextMenu"
  >
    <!-- Collapse toggle / bullet -->
    <span
      class="w-4 shrink-0 text-center text-(--text-muted) cursor-pointer flex items-center justify-center h-8"
      :class="{ 'hover:text-(--text-primary)': hasChildren }"
      role="button"
      :aria-label="hasChildren ? (node.collapsed ? 'Expand' : 'Collapse') : 'Zoom into node'"
      @click="onBulletClick"
      @dblclick.stop="onBulletDblClick"
    >
      <template v-if="hasChildren">
        <ChevronDown v-if="!node.collapsed" class="w-3.5 h-3.5" />
        <ChevronRight v-else class="w-3.5 h-3.5" />
      </template>
      <template v-else>
        <span class="w-1.5 h-1.5 rounded-full bg-(--border-hover)" />
      </template>
    </span>

    <!-- Status dot (clickable picker) -->
    <div
      class="relative shrink-0 h-8 flex items-center"
      role="button"
      :aria-label="'Status: ' + node.status.replace('_', ' ')"
      @click="onStatusClick"
    >
      <component
        v-if="currentStatusDef"
        :is="resolveStatusIcon(currentStatusDef.icon)"
        class="w-3.5 h-3.5 cursor-pointer hover:scale-125 transition-transform"
        :style="{ color: currentStatusDef.color }"
      />

      <!-- Inline status picker dropdown -->
      <div
        v-if="showStatusPicker"
        ref="statusPickerRef"
        class="absolute left-0 top-5 z-40 bg-(--bg-secondary) border border-(--border-secondary) rounded-lg shadow-lg py-1 min-w-32"
        role="listbox"
        aria-label="Select status"
      >
        <button
          v-for="s in store.statusDefs"
          :key="s.id"
          class="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-(--bg-hover) text-left text-(--text-secondary) text-xs"
          :class="{ 'bg-(--bg-tertiary) font-medium': node.status === s.id }"
          @click.stop="onPickStatus(s.id)"
        >
          <component
            :is="resolveStatusIcon(s.icon)"
            class="w-3.5 h-3.5"
            :style="{ color: s.color }"
          />
          {{ s.label }}
        </button>
      </div>
    </div>

    <!-- Text: read-only display with overlaid inputs when editing -->
    <div
      class="flex-1 py-1.5 strata-text leading-5 min-h-5 grid [grid-template-areas:'stack'] *:[grid-area:stack]"
    >
      <div
        :class="[
          isEditing ? 'invisible pointer-events-none' : 'select-text',
          localText ? 'text-(--text-secondary)' : 'text-(--text-faint) italic',
        ]"
      >
        <template v-if="renderedLines">
          <!-- eslint-disable vue/no-v-html -->
          <div v-html="renderedLines.first" />
          <div
            v-if="renderedLines.rest"
            data-body-display
            class="mt-1.5 text-(--text-muted) leading-5 whitespace-pre-wrap"
            v-html="renderedLines.rest.join('\n')"
          />
        </template>
        <template v-else>(empty)</template>
      </div>
      <div v-if="isEditing" class="flex flex-col">
        <input
          ref="titleInputRef"
          type="text"
          class="w-full border-none outline-none bg-transparent font-[inherit] text-(--text-secondary) p-0 strata-text leading-5 placeholder:text-(--text-faint) placeholder:italic select-text"
          :value="localTitle"
          placeholder="(empty)"
          tabindex="-1"
          spellcheck="false"
          @focus="onTitleFocus"
          @input="onTitleInput"
          @blur="onBlur"
          @keydown="onTitleKeydown"
        />
        <textarea
          v-if="localText.includes('\n')"
          ref="bodyInputRef"
          class="w-full border-none outline-none bg-transparent font-[inherit] text-(--text-muted) p-0 mt-1.5 strata-text resize-none overflow-hidden leading-5 placeholder:text-(--text-faint) placeholder:italic select-text"
          :value="localBody"
          placeholder=""
          rows="1"
          tabindex="-1"
          spellcheck="false"
          @focus="onBodyFocus"
          @input="onBodyInput"
          @blur="onBlur"
          @keydown="onBodyKeydown"
        />
      </div>
    </div>

    <!-- Tag pills -->
    <div
      v-if="settings.showTags && node.tags?.length > 0"
      class="relative flex items-start gap-1 shrink-0 self-start pt-1.5"
      data-tag-picker
      @mousedown.prevent
      @click.stop
    >
      <span
        v-for="tag in node.tags"
        :key="tag"
        class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-(--accent-100) text-(--accent-700) cursor-pointer hover:bg-(--accent-200)"
        @click.stop="showTagPicker = !showTagPicker"
      >
        {{ tag }}
      </span>
      <div
        v-if="showTagPicker"
        class="absolute right-0 top-full z-40 mt-1 bg-(--bg-secondary) border border-(--border-secondary) rounded-lg shadow-lg p-2 min-w-48"
      >
        <TagPicker :node-id="node.id" :tags="node.tags ?? []" />
      </div>
    </div>

    <!-- Due date badge -->
    <div
      v-if="nodeDueLabel || showDatePicker"
      ref="datePickerWrapperRef"
      class="relative shrink-0 self-start pt-1.5"
      @click.stop
    >
      <span
        v-if="nodeDueLabel && !showDatePicker"
        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer"
        :class="{
          'bg-red-100 text-red-700': nodeDueUrgency === 'overdue',
          'bg-amber-100 text-amber-700': nodeDueUrgency === 'today',
          'bg-blue-100 text-blue-700': nodeDueUrgency === 'soon',
          'bg-(--bg-active) text-(--text-muted)': nodeDueUrgency === 'normal',
        }"
        @click="showDatePicker = true"
      >
        <Calendar class="w-2.5 h-2.5" />
        {{ nodeDueLabel }}
      </span>
      <div v-if="showDatePicker" class="absolute right-0 top-full z-40 mt-1">
        <DatePicker
          :model-value="node.dueDate ?? null"
          @update:model-value="
            store.setDueDate(node.id, $event);
            showDatePicker = false;
          "
        />
      </div>
    </div>

    <!-- Hover action icons -->
    <div
      class="flex items-center gap-0.5 shrink-0 self-start pt-1.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity"
      @mousedown.prevent
      @click.stop
    >
      <div v-if="settings.showTags && !(node.tags?.length > 0)" class="relative" data-tag-picker>
        <button
          class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-muted) cursor-pointer"
          title="Add tag"
          @click="showTagPicker = !showTagPicker"
        >
          <Tag class="w-3.5 h-3.5" />
        </button>
        <div
          v-if="showTagPicker"
          class="absolute right-0 top-full z-40 mt-1 bg-(--bg-secondary) border border-(--border-secondary) rounded-lg shadow-lg p-2 min-w-48"
        >
          <TagPicker :node-id="node.id" :tags="node.tags ?? []" />
        </div>
      </div>
      <button
        v-if="!showDatePicker"
        class="p-1 rounded hover:bg-(--bg-hover) text-(--text-faint) hover:text-(--text-muted) cursor-pointer"
        title="Set due date"
        @click="showDatePicker = true"
      >
        <Calendar class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>
