<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from "vue";
import { X } from "lucide-vue-next";
import { useDocStore } from "@/stores/doc";

const props = defineProps<{
  nodeId: string;
  tags: string[];
}>();

const store = useDocStore();
const inputRef = ref<HTMLInputElement | null>(null);
const query = ref("");
const pickerRef = ref<HTMLDivElement | null>(null);
const highlightIdx = ref(0);

const suggestions = computed(() => {
  const q = query.value.trim().toLowerCase();
  const existing = new Set(props.tags);
  return store.allTags
    .filter((t) => !existing.has(t))
    .filter((t) => !q || t.toLowerCase().includes(q))
    .slice(0, 8);
});

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
    if (suggestions.value.length > 0 && highlightIdx.value < suggestions.value.length) {
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
    inputRef.value?.blur();
  }
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
      class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium bg-(--accent-100) text-(--accent-700) shrink-0"
    >
      {{ tag }}
      <button
        class="ml-0.5 hover:text-(--color-danger) cursor-pointer"
        @click.stop="removeTag(tag)"
      >
        <X class="w-3 h-3" />
      </button>
    </span>

    <!-- Input -->
    <div class="relative flex-1 min-w-20">
      <input
        ref="inputRef"
        v-model="query"
        class="w-full bg-transparent border-none outline-none text-[12px] text-(--text-secondary) placeholder:text-(--text-faint) py-0.5"
        placeholder="Add tag..."
        @keydown="onKeydown"
      />

      <!-- Autocomplete dropdown -->
      <div
        v-if="suggestions.length > 0 && query.trim()"
        class="absolute top-full left-0 z-50 mt-1 w-48 bg-(--bg-secondary) border border-(--border-primary) rounded-lg shadow-lg overflow-hidden"
      >
        <button
          v-for="(s, i) in suggestions"
          :key="s"
          class="w-full text-left px-3 py-1.5 text-[12px] text-(--text-secondary) cursor-pointer"
          :class="i === highlightIdx ? 'bg-(--bg-hover)' : 'hover:bg-(--bg-hover)'"
          @mousedown.prevent="addTag(s)"
          @mouseenter="highlightIdx = i"
        >
          {{ s }}
        </button>
      </div>
    </div>
  </div>
</template>
