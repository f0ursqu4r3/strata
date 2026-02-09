import { ref, watch, nextTick, onUnmounted, type Ref } from 'vue'
import { useDocStore } from '@/stores/doc'
import { getTitle, getBody, combineText } from '@/lib/text-utils'
import type { Node } from '@/types'

export function useBoardEditing(isDragging: Ref<boolean>, editingCardId: Ref<string | null>) {
  const store = useDocStore()

  const editInputRef = ref<HTMLInputElement | null>(null)

  function onCardClick(node: Node) {
    if (isDragging.value) return
    store.selectNode(node.id)
  }

  function onCardDblClick(node: Node) {
    if (isDragging.value) return
    editingCardId.value = node.id
    nextTick(() => {
      const input = Array.isArray(editInputRef.value) ? editInputRef.value[0] : editInputRef.value
      if (input) {
        input.focus()
        const len = input.value.length
        input.setSelectionRange(len, len)
      }
    })
  }

  function onCardInput(e: Event, node: Node) {
    const newTitle = (e.target as HTMLInputElement).value
    store.updateText(node.id, combineText(newTitle, getBody(node.text)))
  }

  function onCardEditBlur() {
    editingCardId.value = null
  }

  function onCardEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'Enter') {
      editingCardId.value = null
      e.preventDefault()
    }
  }

  // Context menu
  const ctxMenu = ref<{ nodeId: string; x: number; y: number } | null>(null)
  const columnCtxMenu = ref<{ statusId: string; x: number; y: number } | null>(null)

  function onCardContextMenu(e: MouseEvent, node: Node) {
    e.preventDefault()
    e.stopPropagation()
    store.selectNode(node.id)
    ctxMenu.value = { nodeId: node.id, x: e.clientX, y: e.clientY }
    columnCtxMenu.value = null
  }

  function onColumnContextMenu(e: MouseEvent, statusId: string) {
    e.preventDefault()
    ctxMenu.value = null
    columnCtxMenu.value = { statusId, x: e.clientX, y: e.clientY }
  }

  function closeContextMenu() {
    ctxMenu.value = null
  }

  function closeColumnContextMenu() {
    columnCtxMenu.value = null
  }

  // Tag and date pickers
  const editingTagsCardId = ref<string | null>(null)
  const editingDateCardId = ref<string | null>(null)
  const datePickerPos = ref<{ left: string; top: string }>({ left: '0px', top: '0px' })
  const tagPickerPos = ref<{ left: string; top: string }>({ left: '0px', top: '0px' })

  function computePopoverPos(trigger: HTMLElement): { left: string; top: string } {
    const rect = trigger.getBoundingClientRect()
    const vh = window.innerHeight
    const vw = window.innerWidth
    const popH = 120 // estimate
    const popW = 220
    const spaceBelow = vh - rect.bottom - 8
    const top = spaceBelow >= popH ? rect.bottom + 4 : rect.top - popH - 4
    const left = Math.min(rect.left, vw - popW - 8)
    return { left: `${Math.max(4, left)}px`, top: `${Math.max(4, top)}px` }
  }

  function onTagsClick(e: MouseEvent, nodeId: string) {
    e.stopPropagation()
    editingTagsCardId.value = nodeId
    const card = (e.currentTarget as HTMLElement).closest('[data-card-id]') as HTMLElement | null
    if (card) tagPickerPos.value = computePopoverPos(card)
  }

  function onDateClick(e: MouseEvent, nodeId: string) {
    e.stopPropagation()
    editingDateCardId.value = nodeId
    const trigger = e.currentTarget as HTMLElement
    datePickerPos.value = computePopoverPos(trigger)
  }

  function onTagPickerClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target.closest('[data-tag-picker]')) {
      editingTagsCardId.value = null
    }
  }

  function onDatePickerClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target.closest('[data-date-picker]')) {
      editingDateCardId.value = null
    }
  }

  watch(editingTagsCardId, (open) => {
    if (open) {
      setTimeout(() => document.addEventListener('mousedown', onTagPickerClickOutside, true), 0)
    } else {
      document.removeEventListener('mousedown', onTagPickerClickOutside, true)
    }
  })

  watch(editingDateCardId, (open) => {
    if (open) {
      setTimeout(() => document.addEventListener('mousedown', onDatePickerClickOutside, true), 0)
    } else {
      document.removeEventListener('mousedown', onDatePickerClickOutside, true)
    }
  })

  function cleanup() {
    document.removeEventListener('mousedown', onTagPickerClickOutside, true)
    document.removeEventListener('mousedown', onDatePickerClickOutside, true)
  }

  onUnmounted(cleanup)

  return {
    editingCardId,
    editInputRef,
    onCardClick,
    onCardDblClick,
    onCardInput,
    onCardEditBlur,
    onCardEditKeydown,
    ctxMenu,
    columnCtxMenu,
    onCardContextMenu,
    onColumnContextMenu,
    closeContextMenu,
    closeColumnContextMenu,
    editingTagsCardId,
    editingDateCardId,
    datePickerPos,
    tagPickerPos,
    onTagsClick,
    onDateClick,
  }
}
