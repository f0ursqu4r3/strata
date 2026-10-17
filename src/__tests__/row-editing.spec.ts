import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import type { Node } from '@/types'
import { TEXT_DEBOUNCE_DELAY } from '@/lib/constants'

vi.mock('@/stores/doc-sync', () => ({
  useDocSync: () => ({
    getFilePath: vi.fn(async () => null),
    saveToFile: vi.fn(async () => {}),
    scheduleFileSave: vi.fn(),
    scheduleIndexUpdate: vi.fn(),
    hasUnsavedChanges: vi.fn(() => false),
    recentlyWritten: vi.fn(() => false),
    flushPendingSave: vi.fn(async () => {}),
  }),
}))

vi.mock('@/lib/idb', () => ({
  saveOp: vi.fn(async () => {}),
  saveOps: vi.fn(async () => {}),
  saveSnapshot: vi.fn(async () => {}),
  flushOpBuffer: vi.fn(async () => {}),
}))

import { useDocStore } from '@/stores/doc'
import { useRowEditing } from '@/composables/outline/useRowEditing'

function makeNode(overrides: Partial<Node>): Node {
  return {
    id: 'a',
    parentId: 'root',
    pos: 'n',
    text: '',
    collapsed: false,
    status: 'todo',
    deleted: false,
    tags: [],
    ...overrides,
  }
}

// Minimal row: exposes localText from useRowEditing for a node prop
const Row = defineComponent({
  props: {
    node: { type: Object as () => Node, required: true },
    depth: { type: Number, default: 0 },
  },
  setup(props) {
    const { localText } = useRowEditing(props, () => false)
    return () => h('span', localText.value)
  },
})

describe('useRowEditing', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    // jsdom has no matchMedia; the settings store reads it for the system theme
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows text committed from another view (kanban) when the node prop is replaced', async () => {
    const store = useDocStore()
    store.rootId = 'root'
    store.nodes = new Map<string, Node>([
      ['root', makeNode({ id: 'root', parentId: null })],
      ['a', makeNode({ id: 'a', text: 'Alpha' })],
    ])
    const wrapper = mount(Row, { props: { node: store.nodes.get('a')! } })
    expect(wrapper.text()).toBe('Alpha')

    store.updateText('a', 'Alpha edited')
    vi.advanceTimersByTime(TEXT_DEBOUNCE_DELAY)
    await wrapper.setProps({ node: store.nodes.get('a')! })
    await nextTick()

    expect(wrapper.text()).toBe('Alpha edited')
  })
})
