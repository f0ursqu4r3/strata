import { onMounted, type Ref } from "vue";
import { useDocStore } from "@/stores/doc";
import { useSettingsStore } from "@/stores/settings";
import { useDocumentsStore } from "@/stores/documents";
import {
  isTauri,
  hasFileSystemAccess,
  isFileSystemMode,
  setFileSystemActive,
  setSingleFileMode,
} from "@/lib/platform";

export interface AppInitOptions {
  showShortcuts: Ref<boolean>;
  showSettings: Ref<boolean>;
  needsWorkspacePicker: Ref<boolean>;
  isGitWorkspace: Ref<boolean>;
  gitBranch: Ref<string>;
  onGlobalClick: (e: MouseEvent) => void;
  onGlobalKeydown: (e: KeyboardEvent) => void;
  openWorkspacePicker: () => Promise<void>;
  openFilePicker: () => Promise<void>;
}

export function useAppInit(options: AppInitOptions) {
  const store = useDocStore();
  const settings = useSettingsStore();
  const docsStore = useDocumentsStore();

  const {
    showShortcuts,
    showSettings,
    needsWorkspacePicker,
    isGitWorkspace,
    gitBranch,
    onGlobalClick,
    onGlobalKeydown,
    openWorkspacePicker,
    openFilePicker,
  } = options;

  onMounted(async () => {
    settings.init();
    document.addEventListener("mousedown", onGlobalClick);

    // Restore single-file mode from previous session
    if (settings.openMode === "single-file" && settings.singleFilePath) {
      setSingleFileMode(true);
      if (!isTauri() && hasFileSystemAccess()) {
        const { restoreFileHandle } = await import("@/lib/web-fs");
        const restored = await restoreFileHandle();
        if (!restored) {
          settings.setSingleFilePath("");
          settings.setOpenMode("folder");
          setSingleFileMode(false);
          needsWorkspacePicker.value = true;
          return;
        }
        setFileSystemActive(true);
      }
      const activeDocId = await docsStore.init();
      if (activeDocId) {
        await store.loadDocument(activeDocId);
      }
      if (isTauri()) {
        const { setupMenuHandler, updateWindowTitle } = await import(
          "@/lib/menu-handler"
        );
        await setupMenuHandler({
          showShortcuts,
          showSettings,
          onOpenWorkspace: openWorkspacePicker,
          onOpenFile: openFilePicker,
        });
        const fileName = settings.singleFilePath.includes("/")
          ? settings.singleFilePath.substring(
              settings.singleFilePath.lastIndexOf("/") + 1,
            )
          : settings.singleFilePath;
        await updateWindowTitle(fileName);
      }
      // Set up single-file watching
      if (isFileSystemMode()) {
        try {
          await docsStore.setupFileWatching(settings.singleFilePath);
        } catch (err) {
          console.warn("[strata] Single-file watching setup failed:", err);
        }
      }
      document.addEventListener("keydown", onGlobalKeydown);
      return;
    }

    // In Tauri mode, auto-detect git repo or show workspace picker
    if (isTauri() && !settings.workspacePath) {
      try {
        const { findGitRoot } = await import("@/lib/tauri-fs");
        const gitRoot = await findGitRoot();
        if (gitRoot) {
          settings.setWorkspacePath(gitRoot);
          isGitWorkspace.value = true;
          const { gitBranchName } = await import("@/lib/tauri-fs");
          gitBranch.value = await gitBranchName(gitRoot);
        } else {
          needsWorkspacePicker.value = true;
          return;
        }
      } catch {
        needsWorkspacePicker.value = true;
        return;
      }
    }

    // In browser mode with File System Access API, try to restore persisted handle
    if (!isTauri() && hasFileSystemAccess() && settings.workspacePath) {
      const { restoreHandle } = await import("@/lib/web-fs");
      const restored = await restoreHandle();
      if (restored) {
        setFileSystemActive(true);
        const { setWorkspacePrefix } = await import("@/lib/fs");
        setWorkspacePrefix(settings.workspacePath + "/");
      } else {
        // Handle expired or permission denied — need to re-pick
        settings.setWorkspacePath("");
        needsWorkspacePicker.value = true;
        return;
      }
    }

    // Browser mode: if no stored workspace, fall through to IDB mode.
    // Users can opt into filesystem mode via Settings → Workspace.

    const activeDocId = await docsStore.init();
    if (!activeDocId && !settings.workspacePath) {
      return;
    }
    if (activeDocId) {
      await store.loadDocument(activeDocId);
    } else {
      store.ready = true;
    }

    // Check git status in filesystem mode
    if (
      isFileSystemMode() &&
      settings.workspacePath &&
      !isGitWorkspace.value
    ) {
      import("@/lib/fs").then(({ isGitRepo, gitBranchName }) => {
        isGitRepo(settings.workspacePath).then((v) => {
          isGitWorkspace.value = v;
          if (v) {
            gitBranchName(settings.workspacePath).then((b) => {
              gitBranch.value = b;
            });
          }
        });
      });
    }

    // Tauri: set up native menu handler and window title
    if (isTauri()) {
      const { setupMenuHandler, updateWindowTitle } = await import(
        "@/lib/menu-handler"
      );
      await setupMenuHandler({
        showShortcuts,
        showSettings,
        onOpenWorkspace: openWorkspacePicker,
        onOpenFile: openFilePicker,
      });

      if (settings.workspacePath) {
        await updateWindowTitle(settings.workspacePath);
      }
    }

    // Set up file watching (both Tauri and browser FS modes, non-critical)
    if (isFileSystemMode() && settings.workspacePath) {
      try {
        await docsStore.setupFileWatching(settings.workspacePath);
      } catch (err) {
        console.warn("[strata] File watching setup failed:", err);
      }
    }

    // Check for app updates (Tauri only, non-blocking)
    if (isTauri()) {
      import("@tauri-apps/plugin-updater")
        .then(({ check }) => {
          check()
            .then(async (update) => {
              if (!update) return;
              const { ask } = await import("@tauri-apps/plugin-dialog");
              const yes = await ask(
                `A new version (${update.version}) is available. Update and restart now?`,
                { title: "Update Available", kind: "info" },
              );
              if (yes) {
                await update.downloadAndInstall();
                const { relaunch } = await import(
                  "@tauri-apps/plugin-process"
                );
                await relaunch();
              }
            })
            .catch(() => {});
        });
    }

    // Global ? shortcut
    document.addEventListener("keydown", onGlobalKeydown);
  });
}
