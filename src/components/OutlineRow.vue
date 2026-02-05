<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from "vue";
import { ChevronRight, ChevronDown, Calendar, Tag } from "lucide-vue-next";
import { useDocStore } from "@/stores/doc";
import { useSettingsStore } from "@/stores/settings";
import { matchesCombo, type ShortcutAction } from "@/lib/shortcuts";
import TagPicker from "@/components/TagPicker.vue";
import { renderInlineMarkdown } from "@/lib/inline-markdown";
import { resolveStatusIcon } from "@/lib/status-icons";
import { dueDateUrgency, formatDueDate } from "@/lib/due-date";
import DatePicker from "@/components/DatePicker.vue";
import { getTitle, getBody, combineText } from "@/lib/text-utils";
import type { Node, Status } from "@/types";

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
const titleInputRef = ref<HTMLInputElement | null>(null);
const bodyInputRef = ref<HTMLTextAreaElement | null>(null);
const showTagPicker = ref(false);
const showDatePicker = ref(false);
const datePickerWrapperRef = ref<HTMLElement | null>(null);

function onDatePickerClickOutside(e: MouseEvent) {
  if (datePickerWrapperRef.value && !datePickerWrapperRef.value.contains(e.target as HTMLElement)) {
    showDatePicker.value = false;
  }
}

watch(showDatePicker, (open) => {
  if (open) {
    // Delay so the opening click doesn't immediately close it
    setTimeout(() => document.addEventListener("mousedown", onDatePickerClickOutside, true), 0);
  } else {
    document.removeEventListener("mousedown", onDatePickerClickOutside, true);
  }
});

function onTagPickerClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  // Check if click is inside tag picker wrapper or is the trigger button
  if (!target.closest("[data-tag-picker]")) {
    showTagPicker.value = false;
  }
}

watch(showTagPicker, (open) => {
  if (open) {
    setTimeout(() => document.addEventListener("mousedown", onTagPickerClickOutside, true), 0);
  } else {
    document.removeEventListener("mousedown", onTagPickerClickOutside, true);
  }
});

onUnmounted(() => {
  document.removeEventListener("mousedown", onDatePickerClickOutside, true);
  document.removeEventListener("mousedown", onTagPickerClickOutside, true);
});

const nodeDueUrgency = computed(() => dueDateUrgency(props.node.dueDate));
const nodeDueLabel = computed(() =>
  props.node.dueDate ? formatDueDate(props.node.dueDate) : null,
);

const isSelected = computed(() => store.isSelected(props.node.id));
const isEditing = computed(() => store.editingId === props.node.id);
const hasChildren = computed(() => store.getChildren(props.node.id).length > 0);

const localText = ref(props.node.text);

// Computed title/body from localText for split editing
const localTitle = computed(() => getTitle(localText.value));
const localBody = computed(() => getBody(localText.value));

// Rendered HTML lines for read-only display (first line + rest with gap)
const renderedLines = computed(() => {
  const text = localText.value;
  if (!text) return null;
  const lines = text.split("\n");
  return {
    first: renderInlineMarkdown(lines[0]!),
    rest: lines.length > 1 ? lines.slice(1).map((l) => renderInlineMarkdown(l)) : null,
  };
});

onMounted(async () => {
  await nextTick();
  autoResizeBody();
  // If this row is already in editing state when mounted (e.g. Enter created
  // a new sibling), the watch won't fire so we need to focus here.
  if (isEditing.value) {
    const input = titleInputRef.value;
    if (input && document.activeElement !== input) {
      input.focus();
      if (store.editingTrigger === "keyboard") {
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    }
  }
});

function autoResizeBody() {
  const el = bodyInputRef.value;
  if (el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }
}

watch(
  () => props.node.text,
  (v) => {
    if (!isEditing.value) {
      localText.value = v;
      nextTick(autoResizeBody);
    }
  },
);

watch(isEditing, async (editing) => {
  // Don't close tag picker here — it has its own click-outside handling
  if (editing) {
    localText.value = props.node.text;
    await nextTick();
    autoResizeBody();
    const input = titleInputRef.value;
    if (input) {
      if (document.activeElement !== input) {
        input.focus();
      }
      if (store.editingTrigger === "keyboard") {
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    }
  }
});

function onTitleInput(e: Event) {
  const newTitle = (e.target as HTMLInputElement).value;
  const combined = combineText(newTitle, localBody.value);
  localText.value = combined;
  store.updateText(props.node.id, combined);
}

function onBodyInput(e: Event) {
  const newBody = (e.target as HTMLTextAreaElement).value;
  const combined = combineText(localTitle.value, newBody);
  localText.value = combined;
  store.updateText(props.node.id, combined);
  autoResizeBody();
}

function onBlur() {
  // Only stop editing if this node is still the one being edited.
  // When Enter creates a sibling, editingId moves to the new node
  // before this blur fires — don't clear it.
  if (store.editingId === props.node.id) {
    store.stopEditing();
  }
}

function findEditingAction(e: KeyboardEvent): ShortcutAction | null {
  for (const def of settings.resolvedShortcuts) {
    if (def.context !== "editing") continue;
    if (matchesCombo(e, def.combo)) return def.action;
  }
  return null;
}

function handleCommonKeydown(e: KeyboardEvent): boolean {
  // Status shortcuts work while editing: Ctrl+1..N
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
    const idx = parseInt(e.key) - 1;
    if (idx >= 0 && idx < store.statusDefs.length) {
      store.setStatus(props.node.id, store.statusDefs[idx]!.id);
      e.preventDefault();
      return true;
    }
  }

  const action = findEditingAction(e);
  if (action === "stopEditing") {
    store.stopEditing();
    (titleInputRef.value?.closest(".outline-focus-target") as HTMLElement)?.focus();
    e.preventDefault();
    return true;
  }
  if (action === "newSibling") {
    store.flushTextDebounce();
    store.createSiblingBelowAndEdit();
    e.preventDefault();
    return true;
  }
  if (action === "indent") {
    e.preventDefault();
    store.indentAndKeepEditing(props.node.id);
    return true;
  }
  if (action === "outdent") {
    e.preventDefault();
    store.outdentAndKeepEditing(props.node.id);
    return true;
  }
  return false;
}

function onTitleKeydown(e: KeyboardEvent) {
  if (handleCommonKeydown(e)) return;

  const input = titleInputRef.value;
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    // If no body exists, create one by adding a newline
    if (!localBody.value) {
      localText.value = localTitle.value + "\n";
      store.updateText(props.node.id, localTitle.value + "\n");
    }
    nextTick(() => {
      autoResizeBody();
      bodyInputRef.value?.focus();
    });
  } else if (e.key === "Backspace" && input && input.value === "" && !localBody.value) {
    e.preventDefault();
    store.deleteNodeAndEditPrevious(props.node.id);
  } else if (e.key === "ArrowUp" && !e.shiftKey && input) {
    const pos = input.selectionStart ?? 0;
    if (pos === 0 && input.selectionEnd === 0) {
      e.preventDefault();
      store.flushTextDebounce();
      store.editPreviousNode(props.node.id);
    }
  } else if (e.key === "ArrowDown" && !e.shiftKey && input) {
    const pos = input.selectionStart ?? 0;
    const len = input.value.length;
    if (pos === len && input.selectionEnd === len) {
      e.preventDefault();
      // If there's body content, move to body; otherwise go to next node
      if (localBody.value) {
        bodyInputRef.value?.focus();
        bodyInputRef.value?.setSelectionRange(0, 0);
      } else {
        store.flushTextDebounce();
        store.editNextNode(props.node.id);
      }
    }
  }
}

function onBodyKeydown(e: KeyboardEvent) {
  if (handleCommonKeydown(e)) return;

  const input = bodyInputRef.value;
  if (e.key === "Enter" && !e.shiftKey) {
    // Plain Enter in body stops editing (Shift+Enter for newline)
    e.preventDefault();
    store.stopEditing();
    (titleInputRef.value?.closest(".outline-focus-target") as HTMLElement)?.focus();
  } else if (e.key === "Backspace" && input && input.value === "") {
    // Empty body - remove the body entirely and move back to title
    e.preventDefault();
    localText.value = localTitle.value;
    store.updateText(props.node.id, localTitle.value);
    nextTick(() => {
      titleInputRef.value?.focus();
      const len = titleInputRef.value?.value.length ?? 0;
      titleInputRef.value?.setSelectionRange(len, len);
    });
  } else if (e.key === "ArrowUp" && !e.shiftKey && input) {
    const pos = input.selectionStart ?? 0;
    const onFirstLine = input.value.lastIndexOf("\n", pos - 1) === -1;
    if (onFirstLine && pos === 0 && input.selectionEnd === 0) {
      e.preventDefault();
      titleInputRef.value?.focus();
      const len = titleInputRef.value?.value.length ?? 0;
      titleInputRef.value?.setSelectionRange(len, len);
    }
  } else if (e.key === "ArrowDown" && !e.shiftKey && input) {
    const pos = input.selectionStart ?? 0;
    const len = input.value.length;
    const onLastLine = input.value.indexOf("\n", pos) === -1;
    if (onLastLine && pos === len && input.selectionEnd === len) {
      e.preventDefault();
      store.flushTextDebounce();
      store.editNextNode(props.node.id);
    }
  }
}

function onTitleFocus() {
  if (!isEditing.value) {
    store.selectNode(props.node.id);
    store.startEditing(props.node.id, "click");
  }
}

function onBodyFocus() {
  if (!isEditing.value) {
    store.selectNode(props.node.id);
    store.startEditing(props.node.id, "click");
  }
}

function onClick(e: MouseEvent) {
  // Don't start editing when clicking a rendered link
  if ((e.target as HTMLElement).closest?.("a")) return;

  // Multi-select: Shift+Click for range, Cmd/Ctrl+Click for toggle
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
    store.startEditing(props.node.id, "click");
  }
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  store.selectNode(props.node.id);
  emit("contextmenu", props.node.id, e.clientX, e.clientY);
}

const isSearchMatch = computed(() => {
  const matches = store.searchMatchIds;
  if (!matches) return false;
  const q = store.searchQuery.trim().toLowerCase();
  return q !== "" && props.node.text.toLowerCase().includes(q);
});

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

// ── Drag reorder ──
function onRowPointerDown(e: PointerEvent) {
  // Only primary button, not while editing
  if (e.button !== 0 || isEditing.value) return;
  emit("row-pointerdown", props.node.id, e);
}

// ── Inline status picker ──
const showStatusPicker = ref(false);
const statusPickerRef = ref<HTMLElement | null>(null);

const currentStatusDef = computed(
  () => store.statusMap.get(props.node.status) ?? store.statusDefs[0],
);

function onStatusClick(e: MouseEvent) {
  e.stopPropagation();
  showStatusPicker.value = !showStatusPicker.value;
}

function onPickStatus(status: Status) {
  store.setStatus(props.node.id, status);
  showStatusPicker.value = false;
}

function onStatusPickerBlur() {
  // Delay to allow click to register
  setTimeout(() => {
    showStatusPicker.value = false;
  }, 150);
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
        @blur="onStatusPickerBlur"
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

    <!-- Text: read-only display or editable title/body inputs -->
    <div v-if="isEditing" class="flex-1 py-1.5">
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
        v-if="localBody"
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
    <div
      v-else
      class="flex-1 py-1.5 strata-text leading-5 min-h-5 select-text"
      :class="localText ? 'text-(--text-secondary)' : 'text-(--text-faint) italic'"
    >
      <template v-if="renderedLines">
        <!-- eslint-disable vue/no-v-html -->
        <div v-html="renderedLines.first" />
        <div
          v-if="renderedLines.rest"
          class="mt-1.5 text-(--text-muted) leading-5 whitespace-pre-wrap"
          v-html="renderedLines.rest.join('\n')"
        />
      </template>
      <template v-else>(empty)</template>
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
      <!-- Inline tag picker dropdown -->
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
      <!-- Add tag (only when no tags exist) -->
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
      <!-- Add/edit due date icon -->
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
