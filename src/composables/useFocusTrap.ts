import { onMounted, onUnmounted, type Ref } from 'vue'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Trap focus inside a container element.
 * Restores focus to the previously-focused element on unmount.
 */
export function useFocusTrap(containerRef: Ref<HTMLElement | null>) {
  const previouslyFocused = document.activeElement as HTMLElement | null

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return
    const el = containerRef.value
    if (!el) return

    const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (focusable.length === 0) return

    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', onKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', onKeydown)
    previouslyFocused?.focus()
  })
}
