import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useVirtualScroll } from '@/composables/outline/useVirtualScroll'
import { ROW_HEIGHT } from '@/lib/constants'

describe('useVirtualScroll', () => {
  let frames: FrameRequestCallback[]

  let resize: ResizeObserverCallback

  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: ResizeObserverCallback) {
          resize = cb
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function setup() {
    const rows = computed(() =>
      Array.from({ length: 500 }, (_, i) => ({ node: { id: String(i) }, depth: 0 })),
    )
    const el = document.createElement('div')
    let top = 0
    Object.defineProperty(el, 'clientHeight', { value: 600 })
    Object.defineProperty(el, 'scrollTop', {
      get: () => top,
      set: (v: number) => (top = v),
    })
    let result!: ReturnType<typeof useVirtualScroll>
    // Container ref stays null at mount, so onMounted skips the ResizeObserver
    const container = ref<HTMLElement | null>(null)
    mount(
      defineComponent({
        setup() {
          result = useVirtualScroll(rows, container)
          return () => h('div')
        },
      }),
    )
    container.value = el
    return { el, ...result }
  }

  it('updates the visible range once per frame for many scroll events', () => {
    const { el, onScroll, topSpacer } = setup()

    for (const top of [100, 2000, 4000]) {
      el.scrollTop = top
      onScroll()
    }
    expect(frames).toHaveLength(1)
    expect(topSpacer.value).toBe(0)

    frames[0]!(0)
    // Uses the latest scroll position, minus the 10-row buffer
    expect(topSpacer.value).toBe((Math.floor(4000 / ROW_HEIGHT) - 10) * ROW_HEIGHT)
  })

  it('schedules a new frame after the previous one ran', () => {
    const { el, onScroll } = setup()
    el.scrollTop = 100
    onScroll()
    frames[0]!(0)
    el.scrollTop = 200
    onScroll()
    expect(frames).toHaveLength(2)
  })

  // Mount a row wrapper through v-measure and report its height
  function measure(
    vMeasure: ReturnType<typeof useVirtualScroll>['vMeasure'],
    idx: number,
    height: number,
  ) {
    const el = document.createElement('div')
    el.dataset.rowIdx = String(idx)
    const mounted = vMeasure.mounted as (el: HTMLElement, binding: { value: string }) => void
    mounted(el, { value: String(idx) })
    return { target: el, borderBoxSize: [{ blockSize: height }] } as unknown as ResizeObserverEntry
  }

  it('uses measured row heights for the spacers', () => {
    const { vMeasure, bottomSpacer } = setup()
    // Rendered: rows 0..28 (600px view + 10-row buffer below)
    const below = (500 - 29) * ROW_HEIGHT
    expect(bottomSpacer.value).toBe(below)

    // Row 499 (below the rendered range) is taller than the estimate
    const entry = measure(vMeasure, 499, 100)
    resize([entry], {} as ResizeObserver)

    expect(bottomSpacer.value).toBe(below + (100 - ROW_HEIGHT))
  })

  it('keeps the view steady when a row above the viewport grows', () => {
    const { el, onScroll, vMeasure } = setup()
    el.scrollTop = 3200 // row 100 at the top
    onScroll()
    frames[0]!(0)

    const entry = measure(vMeasure, 95, 80)
    resize([entry], {} as ResizeObserver)

    expect(el.scrollTop).toBe(3200 + (80 - ROW_HEIGHT))
  })

  it('does not move the view when a visible row grows', () => {
    const { el, onScroll, vMeasure } = setup()
    el.scrollTop = 3200
    onScroll()
    frames[0]!(0)

    const entry = measure(vMeasure, 105, 80)
    resize([entry], {} as ResizeObserver)

    expect(el.scrollTop).toBe(3200)
  })

  it('scrolls to a row below the view using measured offsets', () => {
    const { el, vMeasure, scrollToIndex } = setup()
    const entry = measure(vMeasure, 10, 132)
    resize([entry], {} as ResizeObserver)

    scrollToIndex(30)

    // Bottom of row 30 = 31 rows, one of them 100px taller, minus the view height
    expect(el.scrollTop).toBe(31 * ROW_HEIGHT + 100 - 600)
  })
})
