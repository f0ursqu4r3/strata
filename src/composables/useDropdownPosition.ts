import { ref, type Ref } from "vue";
import { DEFAULT_DROPDOWN_HEIGHT, POPOVER_PADDING, POPOVER_OFFSET, POPOVER_MIN_EDGE } from '@/lib/constants';

/**
 * Computes a fixed-position style object for a dropdown/popover that
 * should appear near a trigger element, flipping above if there isn't
 * enough space below.
 */
export function useDropdownPosition() {
  const style = ref<Record<string, string>>({});

  function update(
    triggerEl: HTMLElement | null,
    opts?: { dropHeight?: number; width?: string },
  ) {
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const vh = window.innerHeight;
    const dropH = opts?.dropHeight ?? DEFAULT_DROPDOWN_HEIGHT;
    const spaceBelow = vh - rect.bottom - POPOVER_PADDING;
    const top = spaceBelow >= dropH ? rect.bottom + POPOVER_OFFSET : rect.top - dropH - POPOVER_OFFSET;
    style.value = {
      left: `${rect.left}px`,
      top: `${Math.max(POPOVER_MIN_EDGE, top)}px`,
      ...(opts?.width ? { width: opts.width } : {}),
    };
  }

  return { style, update };
}
