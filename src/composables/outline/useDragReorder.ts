import { ref, computed, onUnmounted, type Ref } from 'vue'
import { useDocStore } from '@/stores/doc'
import { rankBefore, rankBetween, rankAfter, initialRank } from '@/lib/rank'

const DRAG_THRESHOLD = 5

export function useDragReorder(
  containerRef: Ref<HTMLElement | null>,
  dropTargetIdx: Ref<number | null>,
  dropAsChildId: Ref<string | null>,
) {
  const store = useDocStore()
  const dragNodeId = ref<string | null>(null)
  const isDragging = ref(false)

  const dragRootIds = computed(() => {
    if (!dragNodeId.value) return [] as string[]
    if (store.selectedIds.size > 1 && store.selectedIds.has(dragNodeId.value)) {
      return store.visibleRows
        .filter((r) => store.selectedIds.has(r.node.id))
        .map((r) => r.node.id)
    }
    return [dragNodeId.value]
  })

  const dragSubtreeIds = computed(() => {
    const ids = new Set<string>()
    if (!dragNodeId.value) return ids
    function addDescendants(parentId: string) {
      for (const child of store.getChildren(parentId)) {
        ids.add(child.id)
        addDescendants(child.id)
      }
    }
    for (const rootId of dragRootIds.value) {
      ids.add(rootId)
      addDescendants(rootId)
    }
    return ids
  })

  let dragStartX = 0
  let dragStartY = 0
  let grabOffsetX = 0
  let grabOffsetY = 0
  let pendingDragNodeId: string | null = null
  let floatingEl: HTMLElement | null = null

  function onRowPointerDown(nodeId: string, e: PointerEvent) {
    pendingDragNodeId = nodeId
    dragStartX = e.clientX
    dragStartY = e.clientY

    const rowEl = (e.target as HTMLElement).closest('[data-row-idx]') as HTMLElement | null
    if (rowEl) {
      const rect = rowEl.getBoundingClientRect()
      grabOffsetX = e.clientX - rect.left
      grabOffsetY = e.clientY - rect.top
    }

    document.addEventListener('pointermove', onDocumentPointerMove)
    document.addEventListener('pointerup', onDocumentPointerUp)
    document.addEventListener('selectstart', onSelectStart)
  }

  function onSelectStart(e: Event) {
    if (pendingDragNodeId) e.preventDefault()
  }

  function onDocumentPointerMove(e: PointerEvent) {
    if (!pendingDragNodeId) return

    const dx = e.clientX - dragStartX
    const dy = e.clientY - dragStartY

    if (!isDragging.value) {
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
      isDragging.value = true
      dragNodeId.value = pendingDragNodeId
      window.getSelection()?.removeAllRanges()
      createFloatingRow()
    }

    if (floatingEl) {
      floatingEl.style.left = `${e.clientX - grabOffsetX}px`
      floatingEl.style.top = `${e.clientY - grabOffsetY}px`
    }

    const rowEls = containerRef.value?.querySelectorAll('[data-row-idx]')
    if (!rowEls) return
    const subtreeIds = dragSubtreeIds.value
    let targetIdx: number | null = null
    let childId: string | null = null

    for (const row of rowEls) {
      const idx = parseInt((row as HTMLElement).dataset.rowIdx!)
      const rowNode = store.visibleRows[idx]?.node
      if (rowNode && subtreeIds.has(rowNode.id)) continue
      const rect = (row as HTMLElement).getBoundingClientRect()
      const y = e.clientY - rect.top
      const h = rect.height

      if (y < 0) {
        targetIdx = idx
        break
      }
      if (y < h * 0.25) {
        targetIdx = idx
        break
      }
      if (y < h * 0.75) {
        childId = rowNode!.id
        break
      }
    }

    if (childId) {
      dropTargetIdx.value = null
      dropAsChildId.value = childId
    } else {
      dropTargetIdx.value = targetIdx ?? store.visibleRows.length
      dropAsChildId.value = null
    }
  }

  function createFloatingRow() {
    const allRowEls = containerRef.value?.querySelectorAll('[data-row-idx]')
    if (!allRowEls) return

    const rows = store.visibleRows
    const subtreeIds = dragSubtreeIds.value

    const sources: HTMLElement[] = []
    for (const el of allRowEls) {
      const idx = parseInt((el as HTMLElement).dataset.rowIdx!)
      const rowNode = rows[idx]?.node
      if (rowNode && subtreeIds.has(rowNode.id)) {
        sources.push(el as HTMLElement)
      }
    }
    if (sources.length === 0) return

    const firstRect = sources[0]!.getBoundingClientRect()

    const wrapper = document.createElement('div')
    wrapper.style.position = 'fixed'
    wrapper.style.left = `${firstRect.left}px`
    wrapper.style.top = `${firstRect.top}px`
    wrapper.style.width = `${firstRect.width}px`
    wrapper.style.zIndex = '9999'
    wrapper.style.pointerEvents = 'none'
    wrapper.style.opacity = '0.9'
    wrapper.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'
    wrapper.style.background = 'var(--bg-secondary)'
    wrapper.style.borderRadius = '4px'
    wrapper.style.overflow = 'hidden'

    for (const src of sources) {
      const clone = src.cloneNode(true) as HTMLElement
      clone.style.opacity = '1'
      wrapper.appendChild(clone)
    }

    document.body.appendChild(wrapper)
    floatingEl = wrapper
  }

  function destroyFloatingRow() {
    if (floatingEl) {
      floatingEl.remove()
      floatingEl = null
    }
  }

  function onDocumentPointerUp() {
    document.removeEventListener('pointermove', onDocumentPointerMove)
    document.removeEventListener('pointerup', onDocumentPointerUp)
    document.removeEventListener('selectstart', onSelectStart)

    if (isDragging.value && dragNodeId.value) {
      const rootIds = dragRootIds.value
      const rows = store.visibleRows
      const subtreeIds = dragSubtreeIds.value

      if (dropAsChildId.value) {
        const targetId = dropAsChildId.value
        const children = store.getChildren(targetId)
        const lastChild = children.filter((c) => !subtreeIds.has(c.id)).pop()
        let pos = lastChild ? rankAfter(lastChild.pos) : initialRank()
        for (const id of rootIds) {
          store.moveNode(id, targetId, pos)
          pos = rankAfter(pos)
        }

        const targetNode = store.nodes.get(targetId)
        if (targetNode && targetNode.collapsed) {
          store.toggleCollapsed(targetId)
        }
      } else if (dropTargetIdx.value !== null) {
        const targetIdx = dropTargetIdx.value

        if (targetIdx === 0) {
          const siblings = store.getChildren(store.effectiveZoomId)
          const firstSibling = siblings.find((s) => !subtreeIds.has(s.id))
          if (firstSibling) {
            let pos = rankBefore(firstSibling.pos)
            for (const id of rootIds) {
              store.moveNode(id, store.effectiveZoomId, pos)
              pos = rankBetween(pos, firstSibling.pos)
            }
          }
        } else if (targetIdx <= rows.length) {
          let aboveRow = null
          for (let i = targetIdx - 1; i >= 0; i--) {
            if (!subtreeIds.has(rows[i]!.node.id)) {
              aboveRow = rows[i]
              break
            }
          }

          if (aboveRow) {
            const aboveNode = aboveRow.node
            const siblings = store.getChildren(aboveNode.parentId!)
            const aboveIdx = siblings.findIndex((s) => s.id === aboveNode.id)
            const nextSibling = siblings.slice(aboveIdx + 1).find((s) => !subtreeIds.has(s.id))

            let pos: string
            if (nextSibling) {
              pos = rankBetween(aboveNode.pos, nextSibling.pos)
            } else {
              pos = rankAfter(aboveNode.pos)
            }
            for (const id of rootIds) {
              store.moveNode(id, aboveNode.parentId, pos)
              pos = rankAfter(pos)
            }
          }
        }
      }
    }

    destroyFloatingRow()
    pendingDragNodeId = null
    dragNodeId.value = null
    dropTargetIdx.value = null
    dropAsChildId.value = null
    isDragging.value = false
  }

  onUnmounted(() => {
    document.removeEventListener('pointermove', onDocumentPointerMove)
    document.removeEventListener('pointerup', onDocumentPointerUp)
    document.removeEventListener('selectstart', onSelectStart)
    destroyFloatingRow()
  })

  return { dragNodeId, isDragging, dragSubtreeIds, onRowPointerDown, onSelectStart }
}
