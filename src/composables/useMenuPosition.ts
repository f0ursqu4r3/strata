import { ref, onMounted, type Ref } from 'vue'
import { POPOVER_PADDING } from '@/lib/constants'

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

    if (left + rect.width > vw - POPOVER_PADDING) {
      left = Math.max(POPOVER_PADDING, x - rect.width)
    }
    if (top + rect.height > vh - POPOVER_PADDING) {
      top = Math.max(POPOVER_PADDING, y - rect.height)
    }

    style.value = { left: `${left}px`, top: `${top}px` }
  })

  return { style }
}
