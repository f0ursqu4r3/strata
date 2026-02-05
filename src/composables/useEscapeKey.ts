import { onMounted, onUnmounted } from 'vue'

/**
 * Composable that listens for Escape key presses.
 * @param callback - Function to call when Escape is pressed
 */
export function useEscapeKey(callback: () => void) {
  function handler(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      callback()
      e.preventDefault()
    }
  }

  onMounted(() => document.addEventListener('keydown', handler))
  onUnmounted(() => document.removeEventListener('keydown', handler))
}
