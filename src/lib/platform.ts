export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window
}

/** True if the browser supports the File System Access API (Chromium 86+). */
export function hasFileSystemAccess(): boolean {
  return typeof window.showDirectoryPicker === 'function'
}

let _webFsActive = false

/** Mark web filesystem mode as active (a directory handle has been acquired). */
export function setFileSystemActive(active: boolean): void {
  _webFsActive = active
}

/** True when running in any filesystem-backed mode (Tauri native OR browser File System Access). */
export function isFileSystemMode(): boolean {
  return isTauri() || _webFsActive
}
