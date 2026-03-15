import { watch, onUnmounted, type Ref } from 'vue'

/**
 * Adds a document-level mousedown listener (capture phase) while `isOpen` is true/truthy.
 * The listener is deferred by one tick so the opening click doesn't immediately close.
 */
export function usePickerClickOutside(
  isOpen: Ref<boolean> | Ref<string | null>,
  handler: (e: MouseEvent) => void,
) {
  let bound = false
  let pendingTimer: ReturnType<typeof setTimeout> | null = null

  function add() {
    if (bound) return
    bound = true
    document.addEventListener('mousedown', handler, true)
  }

  function remove() {
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
    if (!bound) return
    bound = false
    document.removeEventListener('mousedown', handler, true)
  }

  watch(isOpen, (open) => {
    if (open) {
      pendingTimer = setTimeout(add, 0)
    } else {
      remove()
    }
  })

  onUnmounted(remove)
}
