/**
 * File System Access API implementation for Chromium browsers.
 * Mirrors the interface of tauri-fs.ts using browser-native APIs.
 */

const DB_NAME = 'strata-webfs'
const STORE_NAME = 'handles'
const HANDLE_KEY = 'workspace'

// ── Directory handle management ──

let _dirHandle: FileSystemDirectoryHandle | null = null
let _pollTimer: ReturnType<typeof setInterval> | null = null
let _knownFiles: Map<string, number> = new Map() // relPath → lastModified
let _writeGuard: Set<string> = new Set()

const _eventTarget = new EventTarget()

export function getHandle(): FileSystemDirectoryHandle | null {
  return _dirHandle
}

export async function setHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  _dirHandle = handle
  try {
    await persistHandle(handle)
  } catch {
    // IndexedDB persistence failed — handle is still usable for this session
    console.warn('[strata] Could not persist directory handle to IndexedDB')
  }
}

/** Persist the directory handle to IndexedDB so it survives page reloads. */
async function persistHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openIDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY)
  await txDone(tx)
  db.close()
}

/** Try to restore a previously persisted handle. Returns true if successful. */
export async function restoreHandle(): Promise<boolean> {
  try {
    const db = await openIDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const handle = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
      const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY)
      req.onsuccess = () => resolve(req.result as FileSystemDirectoryHandle | undefined)
      req.onerror = () => reject(req.error)
    })
    db.close()

    if (!handle) return false

    // Re-request permission
    const perm = await handle.requestPermission({ mode: 'readwrite' })
    if (perm !== 'granted') return false

    _dirHandle = handle
    return true
  } catch {
    return false
  }
}

export async function clearHandle(): Promise<void> {
  _dirHandle = null
  try {
    const db = await openIDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY)
    await txDone(tx)
    db.close()
  } catch {
    // ignore
  }
}

// ── IndexedDB helpers ──

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ── Path helpers ──

function ensureHandle(): FileSystemDirectoryHandle {
  if (!_dirHandle) throw new Error('No workspace directory handle')
  return _dirHandle
}

/** Navigate to a subdirectory handle by relative path segments. */
async function navigateToDir(
  root: FileSystemDirectoryHandle,
  segments: string[],
  create = false,
): Promise<FileSystemDirectoryHandle> {
  let dir = root
  for (const seg of segments) {
    dir = await dir.getDirectoryHandle(seg, { create })
  }
  return dir
}

/** Split a relative path into directory segments and filename. */
function splitPath(relPath: string): { dirSegments: string[]; fileName: string } {
  const parts = relPath.split('/')
  const fileName = parts.pop()!
  return { dirSegments: parts, fileName }
}

// ── Strata file detection (mirrors Rust is_strata_file) ──

function isStrataContent(content: string): boolean {
  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
    return false
  }
  const afterFirst = content.startsWith('---\r\n') ? 5 : 4
  const endIdx = content.indexOf('\n---', afterFirst)
  if (endIdx < 0) return false
  const frontmatter = content.substring(afterFirst, endIdx)
  return frontmatter.split('\n').some((line) => {
    const trimmed = line.trim()
    return trimmed === 'doc-type: strata' || trimmed === 'doc-type: "strata"'
  })
}

const SKIP_DIRS = new Set(['.git', 'node_modules', 'target', '__pycache__'])

function shouldSkipDir(name: string): boolean {
  return name.startsWith('.') || SKIP_DIRS.has(name)
}

// ── File operations ──

export async function listWorkspaceFiles(): Promise<string[]> {
  const root = ensureHandle()
  const files: string[] = []

  async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
    for await (const entry of dir.values()) {
      if (entry.kind === 'directory') {
        if (!shouldSkipDir(entry.name)) {
          await walk(entry as FileSystemDirectoryHandle, prefix ? `${prefix}/${entry.name}` : entry.name)
        }
      } else if (
        entry.kind === 'file' &&
        entry.name.endsWith('.md') &&
        !entry.name.startsWith('.')
      ) {
        try {
          const file = await (entry as FileSystemFileHandle).getFile()
          const content = await file.text()
          if (isStrataContent(content)) {
            files.push(prefix ? `${prefix}/${entry.name}` : entry.name)
          }
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  await walk(root, '')
  files.sort()
  return files
}

export async function readFile(relPath: string): Promise<string> {
  const root = ensureHandle()
  const { dirSegments, fileName } = splitPath(relPath)
  const dir = await navigateToDir(root, dirSegments)
  const fileHandle = await dir.getFileHandle(fileName)
  const file = await fileHandle.getFile()
  return file.text()
}

export async function writeFile(relPath: string, content: string): Promise<void> {
  const root = ensureHandle()
  const { dirSegments, fileName } = splitPath(relPath)
  const dir = await navigateToDir(root, dirSegments, true)
  const fileHandle = await dir.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
  // Mark in write guard so polling watcher ignores this change
  _writeGuard.add(relPath)
}

export async function deleteFile(relPath: string): Promise<void> {
  const root = ensureHandle()
  const { dirSegments, fileName } = splitPath(relPath)
  const dir = await navigateToDir(root, dirSegments)
  await dir.removeEntry(fileName)
}

export async function renameFile(oldRelPath: string, newRelPath: string): Promise<void> {
  // File System Access API has no rename; read → write → delete
  const content = await readFile(oldRelPath)
  await writeFile(newRelPath, content)
  await deleteFile(oldRelPath)
  // Ensure write guard has both paths
  _writeGuard.add(oldRelPath)
  _writeGuard.add(newRelPath)
}

export async function ensureDir(relPath: string): Promise<void> {
  const root = ensureHandle()
  const segments = relPath.split('/').filter(Boolean)
  await navigateToDir(root, segments, true)
}

// ── Git operations (best-effort) ──

export async function isGitRepo(): Promise<boolean> {
  const root = ensureHandle()
  try {
    await root.getDirectoryHandle('.git')
    return true
  } catch {
    return false
  }
}

export async function gitBranchName(): Promise<string> {
  const root = ensureHandle()
  try {
    const gitDir = await root.getDirectoryHandle('.git')
    const headHandle = await gitDir.getFileHandle('HEAD')
    const headFile = await headHandle.getFile()
    const content = (await headFile.text()).trim()
    const prefix = 'ref: refs/heads/'
    if (content.startsWith(prefix)) {
      return content.slice(prefix.length)
    }
    // Detached HEAD — short hash
    return content.slice(0, 7)
  } catch {
    return ''
  }
}

// ── File watching via polling ──

export function onFsEvent(
  type: 'created' | 'modified' | 'deleted',
  handler: (relPath: string) => void,
): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<string>).detail)
  _eventTarget.addEventListener(`fs:${type}`, listener)
  return () => _eventTarget.removeEventListener(`fs:${type}`, listener)
}

export async function startWatching(): Promise<void> {
  stopWatching()

  // Build initial file snapshot
  _knownFiles = await scanFiles()

  _pollTimer = setInterval(async () => {
    try {
      const current = await scanFiles()

      // Detect created and modified
      for (const [relPath, mtime] of current) {
        const prev = _knownFiles.get(relPath)
        if (prev === undefined) {
          if (_writeGuard.delete(relPath)) continue
          _eventTarget.dispatchEvent(new CustomEvent('fs:created', { detail: relPath }))
        } else if (mtime > prev) {
          if (_writeGuard.delete(relPath)) continue
          _eventTarget.dispatchEvent(new CustomEvent('fs:modified', { detail: relPath }))
        }
      }

      // Detect deleted
      for (const relPath of _knownFiles.keys()) {
        if (!current.has(relPath)) {
          if (_writeGuard.delete(relPath)) continue
          _eventTarget.dispatchEvent(new CustomEvent('fs:deleted', { detail: relPath }))
        }
      }

      _knownFiles = current
    } catch {
      // Handle might have been revoked
    }
  }, 5000)
}

export function stopWatching(): void {
  if (_pollTimer) {
    clearInterval(_pollTimer)
    _pollTimer = null
  }
  _knownFiles.clear()
}

/** Scan all .md Strata files and return a map of relPath → lastModified timestamp. */
async function scanFiles(): Promise<Map<string, number>> {
  const root = ensureHandle()
  const result = new Map<string, number>()

  async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
    for await (const entry of dir.values()) {
      if (entry.kind === 'directory') {
        if (!shouldSkipDir(entry.name)) {
          await walk(
            entry as FileSystemDirectoryHandle,
            prefix ? `${prefix}/${entry.name}` : entry.name,
          )
        }
      } else if (
        entry.kind === 'file' &&
        entry.name.endsWith('.md') &&
        !entry.name.startsWith('.')
      ) {
        try {
          const file = await (entry as FileSystemFileHandle).getFile()
          const relPath = prefix ? `${prefix}/${entry.name}` : entry.name
          // Only check frontmatter on new files to keep polling fast
          if (!_knownFiles.has(relPath)) {
            const content = await file.text()
            if (isStrataContent(content)) {
              result.set(relPath, file.lastModified)
            }
          } else {
            result.set(relPath, file.lastModified)
          }
        } catch {
          // skip
        }
      }
    }
  }

  await walk(root, '')
  return result
}
