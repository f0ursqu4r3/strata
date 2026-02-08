/// <reference types="vite/client" />

declare module 'splitpanes' {
  import type { DefineComponent } from 'vue'
  export const Splitpanes: DefineComponent<Record<string, unknown>>
  export const Pane: DefineComponent<Record<string, unknown>>
}

// File System Access API (Chromium 86+, not in TypeScript's DOM lib)
interface FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemHandle>
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
}

interface Window {
  showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
}
