import { invoke } from '@tauri-apps/api/core'

export async function listWorkspaceFiles(workspace: string): Promise<string[]> {
  return invoke('list_workspace_files', { workspace })
}

export async function readFile(path: string): Promise<string> {
  return invoke('read_file', { path })
}

export async function writeFile(path: string, content: string): Promise<void> {
  await invoke('mark_file_write', { path })
  return invoke('write_file', { path, content })
}

export async function deleteFile(path: string): Promise<void> {
  await invoke('mark_file_write', { path })
  return invoke('delete_file', { path })
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  await invoke('mark_file_write', { path: oldPath })
  await invoke('mark_file_write', { path: newPath })
  return invoke('rename_file', { oldPath, newPath })
}

export async function isGitRepo(workspace: string): Promise<boolean> {
  return invoke('is_git_repo', { workspace })
}

export async function findGitRoot(): Promise<string> {
  return invoke('find_git_root')
}

export async function ensureDir(path: string): Promise<void> {
  return invoke('ensure_dir', { path })
}

export async function startWatching(workspace: string): Promise<void> {
  return invoke('start_watching', { workspace })
}

export async function stopWatching(): Promise<void> {
  return invoke('stop_watching')
}
