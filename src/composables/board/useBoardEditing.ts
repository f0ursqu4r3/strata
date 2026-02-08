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

  function onCardContextMenu(e: MouseEvent, node: Node) {
    e.preventDefault()
    store.selectNode(node.id)
    ctxMenu.value = { nodeId: node.id, x: e.clientX, y: e.clientY }
  }

  function closeContextMenu() {
    ctxMenu.value = null
  }

  // Tag and date pickers
  const editingTagsCardId = ref<string | null>(null)
  const editingDateCardId = ref<string | null>(null)

  function onTagsClick(e: MouseEvent, nodeId: string) {
    e.stopPropagation()
    editingTagsCardId.value = nodeId
  }

  function onDateClick(e: MouseEvent, nodeId: string) {
    e.stopPropagation()
    editingDateCardId.value = nodeId
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
    onCardContextMenu,
    closeContextMenu,
    editingTagsCardId,
    editingDateCardId,
    onTagsClick,
    onDateClick,
  }
}
