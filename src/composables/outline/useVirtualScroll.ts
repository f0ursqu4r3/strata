import { ref, computed, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue'

const ROW_HEIGHT = 32
const BUFFER = 10
const VIRTUAL_THRESHOLD = 100

export { ROW_HEIGHT }

export function useVirtualScroll<T extends { node: { id: string }; depth: number }>(
  visibleRows: ComputedRef<T[]>,
  containerRef: Ref<HTMLElement | null>,
) {
  const scrollTop = ref(0)
  const containerHeight = ref(600)

  function onScroll() {
    scrollTop.value = containerRef.value?.scrollTop ?? 0
  }

  const useVirtual = computed(() => visibleRows.value.length > VIRTUAL_THRESHOLD)

  const virtualRange = computed(() => {
    if (!useVirtual.value) {
      return { start: 0, end: visibleRows.value.length }
    }
    const start = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - BUFFER)
    const visibleCount = Math.ceil(containerHeight.value / ROW_HEIGHT) + BUFFER * 2
    const end = Math.min(visibleRows.value.length, start + visibleCount)
    return { start, end }
  })

  const virtualRows = computed(() => {
    const { start, end } = virtualRange.value
    return visibleRows.value.slice(start, end).map((row, i) => ({
      ...row,
      globalIdx: start + i,
    }))
  })

  const topSpacer = computed(() => virtualRange.value.start * ROW_HEIGHT)
  const bottomSpacer = computed(
    () => (visibleRows.value.length - virtualRange.value.end) * ROW_HEIGHT,
  )

  let resizeObserver: ResizeObserver | null = null

  onMounted(() => {
    if (containerRef.value) {
      containerHeight.value = containerRef.value.clientHeight
      resizeObserver = new ResizeObserver((entries) => {
        containerHeight.value = entries[0]?.contentRect.height ?? 600
      })
      resizeObserver.observe(containerRef.value)
    }
  })

  onUnmounted(() => {
    resizeObserver?.disconnect()
  })

  return { useVirtual, virtualRows, topSpacer, bottomSpacer, onScroll }
}
