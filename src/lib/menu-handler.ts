import { listen } from '@tauri-apps/api/event'
import type { Ref } from 'vue'

export interface MenuHandlerRefs {
  showShortcuts: Ref<boolean>
  showSettings: Ref<boolean>
  onOpenWorkspace: () => void
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
