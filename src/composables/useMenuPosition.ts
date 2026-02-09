import { ref, onMounted, type Ref } from 'vue'

const PADDING = 8

/**
 * Adjusts a context menu's position so it stays within the viewport.
 * Returns reactive `style` object to bind to the menu element.
 */
export function useMenuPosition(
  menuRef: Ref<HTMLElement | null>,
  x: number,
  y: number,
) {
  const style = ref({ left: `${x}px`, top: `${y}px` })

  onMounted(() => {
    const el = menuRef.value
    if (!el) return

    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = x
    let top = y

    if (left + rect.width > vw - PADDING) {
      left = Math.max(PADDING, x - rect.width)
    }
    if (top + rect.height > vh - PADDING) {
      top = Math.max(PADDING, y - rect.height)
    }

    style.value = { left: `${left}px`, top: `${top}px` }
  })

  return { style }
}
