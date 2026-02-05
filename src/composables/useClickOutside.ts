import { onMounted, onUnmounted, type Ref } from 'vue'

/**
 * Composable that detects clicks outside an element.
 * @param elementRef - Ref to the element to detect clicks outside of
 * @param callback - Function to call when a click outside is detected
 * @param options - Optional configuration
 */
export function useClickOutside(
  elementRef: Ref<HTMLElement | null>,
  callback: () => void,
  options?: { capture?: boolean }
) {
  const capture = options?.capture ?? true

  function handler(e: MouseEvent) {
    if (elementRef.value && !elementRef.value.contains(e.target as HTMLElement)) {
      callback()
    }
  }

  onMounted(() => document.addEventListener('mousedown', handler, capture))
  onUnmounted(() => document.removeEventListener('mousedown', handler, capture))
}
