import { listen } from '@tauri-apps/api/event'
import type { Ref } from 'vue'

export interface MenuHandlerRefs {
  showShortcuts: Ref<boolean>
  showSettings: Ref<boolean>
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
      case 'new-document':
        docs.createDocument('Untitled')
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
    }
  })
}
