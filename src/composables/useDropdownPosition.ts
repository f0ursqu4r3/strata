import { ref } from 'vue'
import {
  DEFAULT_DROPDOWN_HEIGHT,
  POPOVER_PADDING,
  POPOVER_OFFSET,
  POPOVER_MIN_EDGE,
} from '@/lib/constants'

interface DropdownPositionOpts {
  dropHeight?: number
  dropWidth?: number
}

/**
 * Computes a fixed-position style object for a dropdown/popover that
 * should appear near a trigger element, flipping above if there isn't
 * enough space below. Also clamps horizontally to keep within viewport.
 */
export function useDropdownPosition(opts?: DropdownPositionOpts) {
  const style = ref({ top: '0px', left: '0px' })

  function update(triggerEl: HTMLElement | null, overrides?: DropdownPositionOpts) {
    if (!triggerEl) return
    const rect = triggerEl.getBoundingClientRect()
    const vh = window.innerHeight
    const vw = window.innerWidth
    const dropH = overrides?.dropHeight ?? opts?.dropHeight ?? DEFAULT_DROPDOWN_HEIGHT
    const dropW = overrides?.dropWidth ?? opts?.dropWidth ?? rect.width

    const spaceBelow = vh - rect.bottom - POPOVER_PADDING
    const top = spaceBelow >= dropH
      ? rect.bottom + POPOVER_OFFSET
      : Math.max(POPOVER_MIN_EDGE, rect.top - dropH - POPOVER_OFFSET)

    let left = rect.left
    if (left + dropW > vw - POPOVER_PADDING) {
      left = Math.max(POPOVER_MIN_EDGE, vw - dropW - POPOVER_PADDING)
    }

    style.value = { top: `${top}px`, left: `${left}px` }
  }

  return { style, update }
}
