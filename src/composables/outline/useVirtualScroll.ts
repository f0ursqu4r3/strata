import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  type Directive,
  type Ref,
  type ComputedRef,
} from 'vue'
import { ROW_HEIGHT, VIRTUAL_SCROLL_BUFFER, VIRTUAL_SCROLL_THRESHOLD } from '@/lib/constants'
import { buildOffsets, findRowAt } from '@/lib/row-offsets'

/**
 * Virtualizes the outline with variable row heights. Rendered rows are measured
 * with a ResizeObserver (via the v-measure directive); rows not yet measured use
 * ROW_HEIGHT as an estimate.
 */
export function useVirtualScroll<T extends { node: { id: string }; depth: number }>(
  visibleRows: ComputedRef<T[]>,
  containerRef: Ref<HTMLElement | null>,
) {
  const scrollTop = ref(0)
  const containerHeight = ref(600)

  // Measured heights by node id; heightsVersion makes offsets recompute after a change
  const heights = new Map<string, number>()
  const heightsVersion = ref(0)

  // Scroll events can fire several times per frame; recompute rows at most once per frame
  let scrollFrame = 0
  function onScroll() {
    if (scrollFrame) return
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0
      scrollTop.value = containerRef.value?.scrollTop ?? 0
    })
  }

  const useVirtual = computed(() => visibleRows.value.length > VIRTUAL_SCROLL_THRESHOLD)

  const offsets = computed(() => {
    void heightsVersion.value
    if (!useVirtual.value) return new Float64Array(1)
    return buildOffsets(
      visibleRows.value.map((r) => r.node.id),
      heights,
      ROW_HEIGHT,
    )
  })

  const virtualRange = computed(() => {
    const n = visibleRows.value.length
    if (!useVirtual.value) return { start: 0, end: n }
    const buffer = VIRTUAL_SCROLL_BUFFER * ROW_HEIGHT
    const start = findRowAt(offsets.value, scrollTop.value - buffer)
    const last = findRowAt(offsets.value, scrollTop.value + containerHeight.value + buffer)
    return { start, end: Math.min(n, last + 1) }
  })

  const virtualRows = computed(() => {
    const { start, end } = virtualRange.value
    return visibleRows.value.slice(start, end).map((row, i) => ({
      ...row,
      globalIdx: start + i,
    }))
  })

  const topSpacer = computed(() => offsets.value[virtualRange.value.start] ?? 0)
  const bottomSpacer = computed(() => {
    const o = offsets.value
    return (o[o.length - 1] ?? 0) - (o[virtualRange.value.end] ?? 0)
  })

  // ── Row measurement ──
  const measuredIds = new Map<Element, string>()

  function onRowsResized(entries: ResizeObserverEntry[]) {
    const container = containerRef.value
    const top = container?.scrollTop ?? 0
    const before = offsets.value
    let changed = false
    // Height change of rows fully above the viewport; shifts the visible content
    let shiftAbove = 0

    for (const entry of entries) {
      const id = measuredIds.get(entry.target)
      if (!id) continue
      const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
      if (height <= 0) continue // detached or hidden
      const prev = heights.get(id) ?? ROW_HEIGHT
      heights.set(id, height)
      if (Math.abs(height - prev) < 0.5) continue
      changed = true
      const idx = Number((entry.target as HTMLElement).dataset.rowIdx)
      const rowBottom = before[idx + 1]
      if (rowBottom !== undefined && rowBottom <= top) shiftAbove += height - prev
    }

    if (!changed) return
    heightsVersion.value++
    // Keep the rows the user is looking at in place (the container sets
    // overflow-anchor: none, so the browser does not also correct this)
    if (container && shiftAbove !== 0) {
      container.scrollTop = top + shiftAbove
      scrollTop.value = container.scrollTop
    }
  }

  let rowObserver: ResizeObserver | null = null

  /** v-measure="nodeId" on each rendered row wrapper (which also carries data-row-idx). */
  const vMeasure: Directive<HTMLElement, string> = {
    mounted(el, { value }) {
      measuredIds.set(el, value)
      rowObserver ??= new ResizeObserver(onRowsResized)
      rowObserver.observe(el)
    },
    updated(el, { value }) {
      measuredIds.set(el, value)
    },
    unmounted(el) {
      measuredIds.delete(el)
      rowObserver?.unobserve(el)
    },
  }

  /** Scroll the container so row idx is fully visible, using measured or estimated offsets. */
  function scrollToIndex(idx: number) {
    const container = containerRef.value
    const o = offsets.value
    if (!container || o[idx] === undefined || o[idx + 1] === undefined) return
    const pad = parseFloat(getComputedStyle(container).paddingTop) || 0
    const rowTop = o[idx]! + pad
    const rowBottom = o[idx + 1]! + pad
    if (rowTop < container.scrollTop) {
      container.scrollTop = rowTop
    } else if (rowBottom > container.scrollTop + container.clientHeight) {
      container.scrollTop = rowBottom - container.clientHeight
    }
    // Render the target rows now instead of waiting for the scroll event
    scrollTop.value = container.scrollTop
  }

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
    rowObserver?.disconnect()
    if (scrollFrame) cancelAnimationFrame(scrollFrame)
  })

  return { useVirtual, virtualRows, topSpacer, bottomSpacer, onScroll, scrollToIndex, vMeasure }
}
