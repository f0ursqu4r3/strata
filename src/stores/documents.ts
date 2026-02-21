import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  loadRegistry,
  saveRegistry,
  addDoc,
  removeDoc,
  renameDoc,
  touchDoc,
  setActiveDoc,
  type DocumentMeta,
  type DocumentRegistry,
} from "@/lib/doc-registry";
import { migrateOldDB, deleteDocDB, setCurrentDocId } from "@/lib/idb";
import { removeDocFromIndex } from "@/lib/search-index";
import { isTauri, isFileSystemMode } from "@/lib/platform";
import { serializeToMarkdown } from "@/lib/markdown-serialize";
import { DEFAULT_STATUSES } from "@/types";

function emptyStrataDoc(): string {
  return serializeToMarkdown({
    nodes: new Map(),
    rootId: "root",
    statusConfig: [...DEFAULT_STATUSES],
  });
}

export const useDocumentsStore = defineStore("documents", () => {
  const documents = ref<DocumentMeta[]>([]);
  const activeId = ref<string>("");

  /** Generate a unique document name like "Untitled", "Untitled 2", etc. */
  function nextUntitledName(): string {
    const names = new Set(documents.value.map((d) => {
      // Use base name without directory prefix or .md extension
      const n = d.name;
      const slash = n.lastIndexOf("/");
      return slash >= 0 ? n.substring(slash + 1) : n;
    }));
    if (!names.has("Untitled")) return "Untitled";
    let i = 2;
    while (names.has(`Untitled ${i}`)) i++;
    return `Untitled ${i}`;
  }

  const sortedDocuments = computed(() =>
    [...documents.value].sort((a, b) => a.name.localeCompare(b.name)),
  );

  async function init(): Promise<string> {
    if (isFileSystemMode()) {
      return initFromFilesystem();
    }
    return initFromRegistry();
  }

  // ── Web mode: localStorage registry (existing behavior) ──

  async function initFromRegistry(): Promise<string> {
    const migratedId = await migrateOldDB();
    if (migratedId) {
      const registry: DocumentRegistry = {
        documents: [
          {
            id: migratedId,
            name: "My Document",
            createdAt: Date.now(),
            lastModified: Date.now(),
          },
        ],
        activeDocumentId: migratedId,
      };
      saveRegistry(registry);
    }

    const registry = loadRegistry();
    documents.value = registry.documents;

    if (documents.value.length === 0) {
      const meta = addDoc("My Document");
      documents.value = [meta];
      activeId.value = meta.id;
    } else {
      activeId.value = registry.activeDocumentId ?? documents.value[0]!.id;
    }

    setCurrentDocId(activeId.value);
    return activeId.value;
  }

  // ── Filesystem mode (Tauri native or browser File System Access API) ──

  async function initFromFilesystem(): Promise<string> {
    const { useSettingsStore } = await import("@/stores/settings");
    const settings = useSettingsStore();
    const workspace = settings.workspacePath;

    if (!workspace) {
      // No workspace chosen yet — UI will show WorkspacePicker
      return "";
    }

    let files: string[];
    try {
      const fs = await import("@/lib/fs");
      files = await fs.listWorkspaceFiles(workspace);
    } catch (err) {
      console.error("[strata] Failed to list workspace files:", err);
      files = [];
    }

    documents.value = files.map((relPath) => ({
      id: relPath,
      name: relPath.replace(/\.md$/, ""),
      createdAt: 0,
      lastModified: 0,
    }));
    activeId.value = files[0] ?? "";

    return activeId.value;
  }

  function createDocument(name: string): string {
    if (isFileSystemMode()) {
      return createDocumentFile(name);
    }
    const meta = addDoc(name);
    documents.value = loadRegistry().documents;
    return meta.id;
  }

  function createDocumentFile(name: string): string {
    const filename = `${name}.md`;
    // Write is async but we return the id synchronously; the file will be created when the doc store inits
    import("@/lib/fs").then(({ writeFile }) => {
      import("@/stores/settings").then(({ useSettingsStore }) => {
        const settings = useSettingsStore();
        writeFile(`${settings.workspacePath}/${filename}`, emptyStrataDoc());
      });
    });
    documents.value = [
      ...documents.value,
      {
        id: filename,
        name,
        createdAt: Date.now(),
        lastModified: Date.now(),
      },
    ];
    return filename;
  }

  async function switchDocument(docId: string): Promise<void> {
    if (!isFileSystemMode()) {
      setActiveDoc(docId);
      setCurrentDocId(docId);
    }
    activeId.value = docId;
    if (!isFileSystemMode()) {
      touchDoc(docId);
      documents.value = loadRegistry().documents;
    }
  }

  /** Check if a document name already exists (case-insensitive for filesystem safety). */
  function nameConflicts(name: string, excludeId?: string): boolean {
    return documents.value.some((d) => {
      if (excludeId && d.id === excludeId) return false;
      const n = d.name;
      const slash = n.lastIndexOf("/");
      const base = slash >= 0 ? n.substring(slash + 1) : n;
      return base.toLowerCase() === name.toLowerCase();
    });
  }

  function renameDocument(docId: string, name: string): void {
    if (nameConflicts(name, docId)) return; // silently skip if name taken
    if (isFileSystemMode()) {
      renameDocumentFile(docId, name);
      return;
    }
    renameDoc(docId, name);
    documents.value = loadRegistry().documents;
  }

  async function renameDocumentFile(oldId: string, newName: string): Promise<void> {
    const { renameFile } = await import("@/lib/fs");
    const { useSettingsStore } = await import("@/stores/settings");
    const settings = useSettingsStore();
    // Preserve directory prefix from old ID (e.g., "notes/Old.md" → "notes/")
    const dirPrefix = oldId.includes("/") ? oldId.substring(0, oldId.lastIndexOf("/") + 1) : "";
    const newRelPath = `${dirPrefix}${newName}.md`;
    await renameFile(
      `${settings.workspacePath}/${oldId}`,
      `${settings.workspacePath}/${newRelPath}`,
    );
    documents.value = documents.value.map((d) =>
      d.id === oldId ? { ...d, id: newRelPath, name: newRelPath.replace(/\.md$/, "") } : d,
    );
    if (activeId.value === oldId) {
      activeId.value = newRelPath;
    }
  }

  async function deleteDocument(docId: string): Promise<void> {
    if (activeId.value === docId) {
      const other = documents.value.find((d) => d.id !== docId);
      if (other) {
        await switchDocument(other.id);
      } else {
        activeId.value = "";
      }
    }

    if (isFileSystemMode()) {
      const { deleteFile } = await import("@/lib/fs");
      const { useSettingsStore } = await import("@/stores/settings");
      const settings = useSettingsStore();
      await deleteFile(`${settings.workspacePath}/${docId}`);
      documents.value = documents.value.filter((d) => d.id !== docId);
    } else {
      removeDoc(docId);
      removeDocFromIndex(docId);
      await deleteDocDB(docId);
      documents.value = loadRegistry().documents;
    }
  }

  function touch(): void {
    if (isFileSystemMode()) return; // no-op in file mode
    touchDoc(activeId.value);
    documents.value = loadRegistry().documents;
  }

  // ── File watching ──

  let unlistenHandles: Array<() => void> = [];

  async function setupFileWatching(workspace: string) {
    if (isTauri()) {
      await setupTauriFileWatching(workspace);
    } else {
      await setupWebFileWatching();
    }
  }

  function onFileCreated(relPath: string) {
    if (!documents.value.find((d) => d.id === relPath)) {
      documents.value = [
        ...documents.value,
        {
          id: relPath,
          name: relPath.replace(/\.md$/, ""),
          createdAt: Date.now(),
          lastModified: Date.now(),
        },
      ];
    }
  }

  function onFileDeleted(relPath: string) {
    documents.value = documents.value.filter((d) => d.id !== relPath);
    if (activeId.value === relPath) {
      const other = documents.value[0];
      if (other) switchDocument(other.id);
    }
  }

  async function onFileModified(relPath: string) {
    if (relPath === activeId.value) {
      const { useDocStore } = await import("@/stores/doc");
      const docStore = useDocStore();
      if (!docStore.hasUnsavedChanges() && !docStore.recentlyWritten()) {
        docStore.refreshFromFile();
      }
    }
  }

  async function setupTauriFileWatching(workspace: string) {
    const { startWatching } = await import("@/lib/tauri-fs");
    const { listen } = await import("@tauri-apps/api/event");

    await startWatching(workspace);

    unlistenHandles.push(
      await listen<{ relPath: string }>("fs:created", (e) => onFileCreated(e.payload.relPath)),
      await listen<{ relPath: string }>("fs:deleted", (e) => onFileDeleted(e.payload.relPath)),
      await listen<{ relPath: string }>("fs:modified", (e) => onFileModified(e.payload.relPath)),
    );
  }

  async function setupWebFileWatching() {
    const { startWatching, onFsEvent } = await import("@/lib/web-fs");

    await startWatching();

    unlistenHandles.push(
      onFsEvent("created", onFileCreated),
      onFsEvent("deleted", onFileDeleted),
      onFsEvent("modified", onFileModified),
    );
  }

  async function teardownFileWatching() {
    for (const unlisten of unlistenHandles) {
      unlisten();
    }
    unlistenHandles = [];
    const { stopWatching } = await import("@/lib/fs");
    await stopWatching();
  }

  return {
    documents,
    activeId,
    sortedDocuments,
    init,
    createDocument,
    switchDocument,
    renameDocument,
    nameConflicts,
    nextUntitledName,
    deleteDocument,
    touch,
    setupFileWatching,
    teardownFileWatching,
  };
});
