/**
 * Unified filesystem adapter.
 * Delegates to tauri-fs.ts (Tauri native) or web-fs.ts (File System Access API)
 * depending on the runtime environment.
 */

import { isTauri } from './platform'
import * as webFs from './web-fs'

/** Public contract for all filesystem operations used by the app. */
export interface FileSystemAdapter {
  listWorkspaceFiles(workspace: string): Promise<string[]>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  deleteFile(path: string): Promise<void>
  renameFile(oldPath: string, newPath: string): Promise<void>
  ensureDir(path: string): Promise<void>
  isGitRepo(workspace: string): Promise<boolean>
  findGitRoot(): Promise<string>
  gitBranchName(workspace: string): Promise<string>
  startWatching(workspace: string): Promise<void>
  stopWatching(): Promise<void>
}

/** Strip the workspace path prefix to get a relative path for web-fs. */
function toRelative(absPath: string, workspace: string): string {
  if (absPath.startsWith(workspace)) {
    return absPath.slice(workspace.length).replace(/^\//, '')
  }
  return absPath
}

let _workspacePrefix = ''

export function setWorkspacePrefix(prefix: string): void {
  _workspacePrefix = prefix
}

function rel(path: string): string {
  return toRelative(path, _workspacePrefix)
}

export async function listWorkspaceFiles(workspace: string): Promise<string[]> {
  if (isTauri()) {
    return (await import('./tauri-fs')).listWorkspaceFiles(workspace)
  }
  return webFs.listWorkspaceFiles()
}

export async function readFile(path: string): Promise<string> {
  if (isTauri()) {
    return (await import('./tauri-fs')).readFile(path)
  }
  return webFs.readFile(rel(path))
}

export async function writeFile(path: string, content: string): Promise<void> {
  if (isTauri()) {
    return (await import('./tauri-fs')).writeFile(path, content)
  }
  return webFs.writeFile(rel(path), content)
}

export async function deleteFile(path: string): Promise<void> {
  if (isTauri()) {
    return (await import('./tauri-fs')).deleteFile(path)
  }
  return webFs.deleteFile(rel(path))
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  if (isTauri()) {
    return (await import('./tauri-fs')).renameFile(oldPath, newPath)
  }
  return webFs.renameFile(rel(oldPath), rel(newPath))
}

export async function ensureDir(path: string): Promise<void> {
  if (isTauri()) {
    return (await import('./tauri-fs')).ensureDir(path)
  }
  return webFs.ensureDir(rel(path))
}

export async function isGitRepo(workspace: string): Promise<boolean> {
  if (isTauri()) {
    return (await import('./tauri-fs')).isGitRepo(workspace)
  }
  return webFs.isGitRepo()
}

export async function findGitRoot(): Promise<string> {
  if (isTauri()) {
    return (await import('./tauri-fs')).findGitRoot()
  }
  // Not applicable in browser — workspace IS the root
  return ''
}

export async function gitBranchName(workspace: string): Promise<string> {
  if (isTauri()) {
    return (await import('./tauri-fs')).gitBranchName(workspace)
  }
  return webFs.gitBranchName()
}

export async function startWatching(workspace: string): Promise<void> {
  if (isTauri()) {
    return (await import('./tauri-fs')).startWatching(workspace)
  }
  return webFs.startWatching()
}

export async function stopWatching(): Promise<void> {
  if (isTauri()) {
    return (await import('./tauri-fs')).stopWatching()
  }
  return webFs.stopWatching()
}
