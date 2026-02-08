<script setup lang="ts">
import { ref, onMounted } from "vue";
import { FolderOpen, Layers } from "lucide-vue-next";
import { useSettingsStore } from "@/stores/settings";
import { hasExistingIdbDocs } from "@/lib/migrate-to-files";
import { isTauri, hasFileSystemAccess, setFileSystemActive } from "@/lib/platform";

const settings = useSettingsStore();
const emit = defineEmits<{ selected: [path: string] }>();
const picking = ref(false);
const migrating = ref(false);
const hasLegacyDocs = ref(false);
const migrationResult = ref<string | null>(null);

onMounted(() => {
  hasLegacyDocs.value = hasExistingIdbDocs();
});

async function pickFolder() {
  picking.value = true;
  try {
    if (isTauri()) {
      await pickTauriFolder();
    } else if (hasFileSystemAccess()) {
      await pickBrowserFolder();
    }
  } finally {
    picking.value = false;
    migrating.value = false;
  }
}

async function pickTauriFolder() {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    directory: true,
    title: "Choose Strata Workspace",
  });
  if (selected) {
    const workspace = selected as string;
    await finishSelection(workspace);
  }
}

async function pickBrowserFolder() {
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    const { setHandle } = await import("@/lib/web-fs");
    await setHandle(handle);
    const { setWorkspacePrefix } = await import("@/lib/fs");
    setFileSystemActive(true);
    // Use the directory name as the workspace path identifier
    const workspace = handle.name;
    setWorkspacePrefix(workspace + "/");
    await finishSelection(workspace);
  } catch (err) {
    // User cancelled the picker or permission denied
    if ((err as DOMException).name !== "AbortError") {
      console.error("Failed to open directory:", err);
    }
  }
}

async function finishSelection(workspace: string) {
  settings.setWorkspacePath(workspace);

  // Offer migration if there are existing IDB docs
  if (hasLegacyDocs.value) {
    migrating.value = true;
    try {
      const { migrateIdbToFiles } = await import("@/lib/migrate-to-files");
      const count = await migrateIdbToFiles(workspace);
      migrationResult.value = `Migrated ${count} document${count !== 1 ? "s" : ""} to workspace.`;
    } catch (err) {
      migrationResult.value = `Migration error: ${(err as Error).message}`;
    }
    migrating.value = false;
    // Brief pause to show result
    await new Promise((r) => setTimeout(r, 1500));
  }

  emit("selected", workspace);
}
</script>

<template>
  <div class="flex items-center justify-center h-full bg-(--bg-primary)">
    <div class="flex flex-col items-center gap-6 max-w-md text-center px-6">
      <Layers class="w-12 h-12" style="color: var(--accent-500)" />
      <h1 class="text-2xl font-bold text-(--text-primary)">Welcome to Strata</h1>
      <p class="text-sm text-(--text-muted) leading-relaxed">
        Choose a folder to store your documents. Each document is saved as a
        <code class="px-1 py-0.5 rounded bg-(--bg-hover) text-(--text-secondary)">.md</code>
        file. If the folder is a git repo, you get version history and sync for free.
      </p>
      <p
        v-if="hasLegacyDocs"
        class="text-xs text-(--text-tertiary) bg-(--bg-hover) rounded-lg px-4 py-2"
      >
        Existing documents found in browser storage. They will be automatically migrated to your chosen workspace folder.
      </p>
      <button
        v-if="isTauri() || hasFileSystemAccess()"
        class="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer transition-colors"
        style="background: var(--accent-500)"
        :disabled="picking || migrating"
        @click="pickFolder"
      >
        <FolderOpen class="w-4 h-4" />
        <template v-if="migrating">Migrating documents...</template>
        <template v-else-if="picking">Opening...</template>
        <template v-else>Choose Workspace Folder</template>
      </button>
      <p v-if="!isTauri() && !hasFileSystemAccess()" class="text-xs text-(--text-faint)">
        Filesystem access requires a Chromium-based browser (Chrome, Edge, Brave).
        Your documents will be stored in the browser instead.
      </p>
      <p v-if="migrationResult" class="text-xs text-(--text-tertiary)">
        {{ migrationResult }}
      </p>
    </div>
  </div>
</template>
