import './capture.css'
import './styles/themes.css'
import { addToInbox } from '@/lib/inbox'

// Apply theme from settings
const settingsRaw = localStorage.getItem('strata-settings')
const settings = settingsRaw ? JSON.parse(settingsRaw) : {}
const theme = settings.theme || 'github-dark'
document.documentElement.setAttribute('data-theme', theme)

const app = document.getElementById('capture-app')!

let expanded = false
let selectedStatus = 'todo'

function render() {
  app.innerHTML = `
    <div class="capture-row">
      <span class="capture-icon">+</span>
      <input
        id="capture-input"
        class="capture-input"
        type="text"
        placeholder="Capture a thought..."
        autofocus
      />
      ${!expanded ? '<span class="capture-hint">Tab to expand</span>' : ''}
    </div>
    ${expanded ? `
      <div class="capture-expanded">
        <button class="status-pill ${selectedStatus === 'todo' ? 'active' : ''}" data-status="todo">Todo</button>
        <button class="status-pill ${selectedStatus === 'in_progress' ? 'active' : ''}" data-status="in_progress">In Progress</button>
        <button class="status-pill ${selectedStatus === 'blocked' ? 'active' : ''}" data-status="blocked">Blocked</button>
      </div>
    ` : ''}
  `

  const input = document.getElementById('capture-input') as HTMLInputElement
  input.focus()

  input.addEventListener('keydown', onKeydown)

  // Status pill clicks
  app.querySelectorAll('.status-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      selectedStatus = (pill as HTMLElement).dataset.status!
      render()
    })
  })
}

async function onKeydown(e: KeyboardEvent) {
  const input = document.getElementById('capture-input') as HTMLInputElement | null
  if (!input) return

  try {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault()
      await addToInbox(input.value.trim(), selectedStatus)
      input.value = ''
      selectedStatus = 'todo'
      expanded = false
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().hide()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().hide()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      expanded = !expanded
      render()
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const { LogicalSize } = await import('@tauri-apps/api/dpi')
      const win = getCurrentWindow()
      await win.setSize(new LogicalSize(480, expanded ? 120 : 72))
    }
  } catch {
    // Silently handle — capture window should never crash
  }
}

// Re-focus and reset input when window becomes visible
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    const input = document.getElementById('capture-input') as HTMLInputElement
    if (input) {
      input.value = ''
      input.focus()
    }
  }
})

render()
