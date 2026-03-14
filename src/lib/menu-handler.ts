import { listen } from '@tauri-apps/api/event'
import type { Ref } from 'vue'

export interface MenuHandlerRefs {
  showShortcuts: Ref<boolean>
  showSettings: Ref<boolean>
  onOpenWorkspace: () => void
  onOpenFile: () => void
}

export async function setupMenuHandler(refs: MenuHandlerRefs) {
  const { useDocStore } = await import('@/stores/doc')
  const { useDocumentsStore } = await import('@/stores/documents')
  const { useSettingsStore } = await import('@/stores/settings')

  await listen<string>('menu-action', (event) => {
    const action = event.payload
    const store = useDocStore()
    const settings = useSettingsStore()
    const docs = useDocumentsStore()

    switch (action) {
      case 'new-document': {
        const id = docs.createDocument('Untitled')
        docs.switchDocument(id).then(() => store.loadDocument(id))
        break
      }
      case 'new-window': {
        // Always create a new window — use a unique title so it won't match existing ones
        import('@tauri-apps/api/core').then(({ invoke }) =>
          invoke('open_window', { title: `Strata — New ${Date.now()}`, query: 'new=1' }),
        )
        break
      }
      case 'scratch-pad': {
        import('@tauri-apps/api/core').then(({ invoke }) =>
          invoke('open_window', {
            title: 'Scratch Pad',
            query: 'doc=__inbox__',
            width: 800,
            height: 600,
          }),
        )
        break
      }
      case 'open-file':
        refs.onOpenFile()
        break
      case 'open-workspace':
        refs.onOpenWorkspace()
        break
      case 'undo':
        store.undo()
        break
      case 'redo':
        store.redo()
        break
      case 'view-outline':
        store.setViewMode('outline')
        break
      case 'view-split':
        store.setViewMode('split')
        break
      case 'view-board':
        store.setViewMode('board')
        break
      case 'toggle-sidebar':
        settings.setSidebarOpen(!settings.sidebarOpen)
        break
      case 'toggle-tags':
        settings.setShowTags(!settings.showTags)
        break
      case 'close-document': {
        // Delete the active document (with confirmation) and switch to the next one
        const activeId = docs.activeId
        if (activeId) {
          // If it's the scratch pad, just close the window
          if (activeId === '__inbox__') {
            import('@tauri-apps/api/window').then(({ getCurrentWindow }) =>
              getCurrentWindow().close(),
            )
          } else {
            // Switch to next doc, removing current
            const remaining = docs.documents.filter((d) => d.id !== activeId)
            if (remaining.length > 0) {
              const nextId = remaining[0]!.id
              docs.switchDocument(nextId).then(() => store.loadDocument(nextId))
            }
          }
        }
        break
      }
      case 'close-window': {
        import('@tauri-apps/api/window').then(({ getCurrentWindow }) =>
          getCurrentWindow().close(),
        )
        break
      }
      case 'settings':
        refs.showSettings.value = true
        break
      case 'shortcuts':
        refs.showShortcuts.value = true
        break
      case 'check-for-updates':
        checkForUpdates()
        break
    }
  })
}

async function checkForUpdates() {
  const { check } = await import('@tauri-apps/plugin-updater')
  const { ask, message } = await import('@tauri-apps/plugin-dialog')

  try {
    const update = await check()
    if (update) {
      const yes = await ask(
        `A new version (${update.version}) is available. Update and restart now?`,
        { title: 'Update Available', kind: 'info' },
      )
      if (yes) {
        await update.downloadAndInstall()
        const { relaunch } = await import('@tauri-apps/plugin-process')
        await relaunch()
      }
    } else {
      await message('You are running the latest version.', { title: 'No Updates', kind: 'info' })
    }
  } catch (e) {
    await message(`Failed to check for updates: ${e}`, { title: 'Update Error', kind: 'error' })
  }
}

export async function updateWindowTitle(workspacePath: string) {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  const { homeDir } = await import('@tauri-apps/api/path')
  let display = workspacePath
  try {
    const home = (await homeDir()).replace(/\/+$/, '')
    if (display.startsWith(home + '/')) {
      display = '~' + display.slice(home.length)
    }
  } catch {
    // homeDir unavailable — use full path
  }
  await getCurrentWindow().setTitle(`Strata — ${display}`)
}
