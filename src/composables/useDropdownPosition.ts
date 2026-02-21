import { ref, type Ref } from "vue";

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
    const dropH = opts?.dropHeight ?? 256;
    const spaceBelow = vh - rect.bottom - 8;
    const top = spaceBelow >= dropH ? rect.bottom + 4 : rect.top - dropH - 4;
    style.value = {
      left: `${rect.left}px`,
      top: `${Math.max(4, top)}px`,
      ...(opts?.width ? { width: opts.width } : {}),
    };
  }

  return { style, update };
}
