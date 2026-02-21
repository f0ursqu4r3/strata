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

let _singleFileMode = false

/** Mark single-file mode as active (a single file has been opened instead of a workspace). */
export function setSingleFileMode(active: boolean): void {
  _singleFileMode = active
}

/** True when the user opened a single file rather than a workspace folder. */
export function isSingleFileMode(): boolean {
  return _singleFileMode
}
