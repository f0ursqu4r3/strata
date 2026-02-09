<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from "vue";
import { X } from "lucide-vue-next";
import { useDocStore } from "@/stores/doc";
import { useSettingsStore } from "@/stores/settings";
import { TAG_COLOR_PRESETS, TAG_COLOR_KEYS, tagStyle } from "@/lib/tag-colors";

const props = defineProps<{
  nodeId: string;
  tags: string[];
}>();

const store = useDocStore();
const settings = useSettingsStore();
const inputRef = ref<HTMLInputElement | null>(null);
const query = ref("");
const pickerRef = ref<HTMLDivElement | null>(null);
const highlightIdx = ref(0);
const inputFocused = ref(false);
const colorPickerTag = ref<string | null>(null);

const suggestions = computed(() => {
  const q = query.value.trim().toLowerCase();
  const existing = new Set(props.tags);
  return store.allTags
    .filter((t) => !existing.has(t))
    .filter((t) => !q || t.toLowerCase().includes(q))
    .slice(0, 8);
});

const showDropdown = computed(() => inputFocused.value && suggestions.value.length > 0);

function getTagStyle(tag: string) {
  return tagStyle(tag, store.tagColors, settings.dark);
}

function addTag(tag: string) {
  const trimmed = tag.trim();
  if (!trimmed) return;
  store.addTag(props.nodeId, trimmed);
  query.value = "";
  highlightIdx.value = 0;
  inputRef.value?.focus();
}

function removeTag(tag: string) {
  store.removeTag(props.nodeId, tag);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    if (showDropdown.value && highlightIdx.value < suggestions.value.length) {
      addTag(suggestions.value[highlightIdx.value]!);
    } else if (query.value.trim()) {
      addTag(query.value);
    }
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    if (highlightIdx.value < suggestions.value.length - 1) highlightIdx.value++;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (highlightIdx.value > 0) highlightIdx.value--;
  } else if (e.key === "Backspace" && !query.value && props.tags.length > 0) {
    removeTag(props.tags[props.tags.length - 1]!);
  } else if (e.key === "Escape") {
    e.stopPropagation();
    if (colorPickerTag.value) {
      colorPickerTag.value = null;
    } else {
      inputRef.value?.blur();
    }
  }
}

function onFocus() {
  inputFocused.value = true;
  highlightIdx.value = 0;
}

function onBlur() {
  // Small delay so click on suggestion registers before dropdown hides
  setTimeout(() => { inputFocused.value = false; }, 150);
}

function toggleColorPicker(tag: string, e: MouseEvent) {
  e.stopPropagation();
  colorPickerTag.value = colorPickerTag.value === tag ? null : tag;
}

function pickColor(tag: string, colorKey: string | null) {
  store.setTagColor(tag, colorKey);
  colorPickerTag.value = null;
}

function onClickOutside(e: MouseEvent) {
  if (pickerRef.value && !pickerRef.value.contains(e.target as HTMLElement)) {
    // Let parent handle close
  }
}

onMounted(() => {
  nextTick(() => inputRef.value?.focus());
  document.addEventListener("mousedown", onClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", onClickOutside);
});
</script>

<template>
  <div ref="pickerRef" class="flex flex-wrap items-center gap-1 min-w-0" @click.stop>
    <!-- Existing tag pills -->
    <span
      v-for="tag in tags"
      :key="tag"
      class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium shrink-0 relative"
      :class="getTagStyle(tag) ? '' : 'bg-(--accent-100) text-(--accent-700)'"
      :style="getTagStyle(tag) ?? {}"
    >
      <!-- Color dot (click to change color) -->
      <button
        class="w-2 h-2 rounded-full border border-current opacity-50 hover:opacity-100 cursor-pointer shrink-0"
        title="Change tag color"
        @click="toggleColorPicker(tag, $event)"
      />
      {{ tag }}
      <button
        class="ml-0.5 hover:text-(--color-danger) cursor-pointer"
        @click.stop="removeTag(tag)"
      >
        <X class="w-3 h-3" />
      </button>

      <!-- Color picker popover -->
      <div
        v-if="colorPickerTag === tag"
        class="absolute left-0 top-full z-50 mt-1 bg-(--bg-secondary) border border-(--border-primary) rounded-lg shadow-lg p-2"
        @click.stop
      >
        <div class="flex gap-1">
          <!-- Default (no color) -->
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
            :class="store.tagColors[key] === key ? 'border-(--text-primary)' : 'border-transparent hover:border-(--border-hover)'"
            :style="{ backgroundColor: settings.dark ? TAG_COLOR_PRESETS[key]!.darkBg : TAG_COLOR_PRESETS[key]!.lightBg }"
            :title="TAG_COLOR_PRESETS[key]!.label"
            @click="pickColor(tag, key)"
          />
        </div>
      </div>
    </span>

    <!-- Input -->
    <div class="relative flex-1 min-w-20">
      <input
        ref="inputRef"
        v-model="query"
        class="w-full bg-transparent border-none outline-none text-[12px] text-(--text-secondary) placeholder:text-(--text-faint) py-0.5"
        placeholder="Add tag..."
        @keydown="onKeydown"
        @focus="onFocus"
        @blur="onBlur"
      />

      <!-- Autocomplete dropdown -->
      <div
        v-if="showDropdown"
        class="absolute top-full left-0 z-50 mt-1 w-48 bg-(--bg-secondary) border border-(--border-primary) rounded-lg shadow-lg overflow-hidden"
      >
        <button
          v-for="(s, i) in suggestions"
          :key="s"
          class="w-full text-left px-3 py-1.5 text-[12px] text-(--text-secondary) cursor-pointer flex items-center gap-2"
          :class="i === highlightIdx ? 'bg-(--bg-hover)' : 'hover:bg-(--bg-hover)'"
          @mousedown.prevent="addTag(s)"
          @mouseenter="highlightIdx = i"
        >
          <span
            class="w-2 h-2 rounded-full shrink-0"
            :class="getTagStyle(s) ? '' : 'bg-(--accent-300)'"
            :style="getTagStyle(s) ? { backgroundColor: (getTagStyle(s) as Record<string, string>).color } : {}"
          />
          {{ s }}
        </button>
      </div>
    </div>
  </div>
</template>
