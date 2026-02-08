import { ref, computed, onUnmounted, type Ref } from 'vue'
import { useDocStore } from '@/stores/doc'
import type { Node } from '@/types'

const DRAG_THRESHOLD = 5

export function useBoardDrag(editingCardId: Ref<string | null>) {
  const store = useDocStore()

  const dragNodeId = ref<string | null>(null)
  const dragOverColumn = ref<string | null>(null)
  const isDragging = ref(false)
  const columnRefs = ref<HTMLElement[]>([])

  let dragStartX = 0
  let dragStartY = 0
  let grabOffsetX = 0
  let grabOffsetY = 0
  let pendingDragNodeId: string | null = null
  let floatingEl: HTMLElement | null = null

  function onCardPointerDown(e: PointerEvent, node: Node) {
    if (e.button !== 0 || editingCardId.value === node.id) return
    pendingDragNodeId = node.id
    dragStartX = e.clientX
    dragStartY = e.clientY

    const card = (e.target as HTMLElement).closest('[data-card-id]') as HTMLElement | null
    if (card) {
      const rect = card.getBoundingClientRect()
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
      createFloatingCard()
    }

    if (floatingEl) {
      floatingEl.style.left = `${e.clientX - grabOffsetX}px`
      floatingEl.style.top = `${e.clientY - grabOffsetY}px`
    }

    dragOverColumn.value = null
    for (const col of columnRefs.value) {
      const rect = col.getBoundingClientRect()
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        dragOverColumn.value = col.dataset.statusId ?? null
        break
      }
    }
  }

  function createFloatingCard() {
    const source = document.querySelector(
      `[data-card-id="${pendingDragNodeId}"]`,
    ) as HTMLElement | null
    if (!source) return
    const clone = source.cloneNode(true) as HTMLElement
    const rect = source.getBoundingClientRect()

    clone.style.position = 'fixed'
    clone.style.left = `${rect.left}px`
    clone.style.top = `${rect.top}px`
    clone.style.width = `${rect.width}px`
    clone.style.zIndex = '9999'
    clone.style.pointerEvents = 'none'
    clone.style.opacity = '1'
    clone.style.boxShadow = '0 8px 24px rgba(0,0,0,0.18)'
    clone.style.transform = 'scale(1.02)'
    clone.style.transition = 'box-shadow 0.15s, transform 0.15s'
    clone.classList.remove('opacity-40')
    clone.removeAttribute('data-card-id')

    document.body.appendChild(clone)
    floatingEl = clone
  }

  function destroyFloatingCard() {
    if (floatingEl) {
      floatingEl.remove()
      floatingEl = null
    }
  }

  function onDocumentPointerUp() {
    document.removeEventListener('pointermove', onDocumentPointerMove)
    document.removeEventListener('pointerup', onDocumentPointerUp)
    document.removeEventListener('selectstart', onSelectStart)

    if (isDragging.value && dragNodeId.value && dragOverColumn.value) {
      store.setStatus(dragNodeId.value, dragOverColumn.value)
    }

    destroyFloatingCard()
    pendingDragNodeId = null
    dragNodeId.value = null
    dragOverColumn.value = null
    isDragging.value = false
  }

  const dropInsertIndex = computed(() => {
    if (!dragNodeId.value || !dragOverColumn.value) return -1
    const dragNode = store.nodes.get(dragNodeId.value)
    if (!dragNode || dragNode.status === dragOverColumn.value) return -1

    const allNodes = store.kanbanNodes
    const dragIdx = allNodes.findIndex((n) => n.id === dragNodeId.value)
    if (dragIdx === -1) return -1

    const targetCol = store.kanbanColumns.find((c) => c.def.id === dragOverColumn.value)
    if (!targetCol) return -1

    let insertIdx = 0
    for (const colNode of targetCol.nodes) {
      const colNodeIdx = allNodes.findIndex((n) => n.id === colNode.id)
      if (colNodeIdx < dragIdx) insertIdx++
      else break
    }
    return insertIdx
  })

  function cleanup() {
    document.removeEventListener('pointermove', onDocumentPointerMove)
    document.removeEventListener('pointerup', onDocumentPointerUp)
    document.removeEventListener('selectstart', onSelectStart)
    destroyFloatingCard()
  }

  onUnmounted(cleanup)

  return {
    dragNodeId,
    dragOverColumn,
    isDragging,
    dropInsertIndex,
    onCardPointerDown,
    columnRefs,
    cleanup,
  }
}
