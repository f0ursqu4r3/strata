import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useVirtualScroll } from '@/composables/outline/useVirtualScroll'
import { ROW_HEIGHT } from '@/lib/constants'

describe('useVirtualScroll', () => {
  let frames: FrameRequestCallback[]

  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function setup() {
    const rows = computed(() =>
      Array.from({ length: 500 }, (_, i) => ({ node: { id: String(i) }, depth: 0 })),
    )
    const el = { scrollTop: 0, clientHeight: 600 } as HTMLElement
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
})
