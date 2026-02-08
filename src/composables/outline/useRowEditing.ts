import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
import { useDocStore } from '@/stores/doc'
import { useSettingsStore } from '@/stores/settings'
import { matchesCombo, type ShortcutAction } from '@/lib/shortcuts'
import { renderInlineMarkdown } from '@/lib/inline-markdown'
import { getTitle, getBody, combineText } from '@/lib/text-utils'
import type { Node, Status } from '@/types'

export function useRowEditing(
  props: { node: Node; depth: number },
  isEditing: () => boolean,
) {
  const store = useDocStore()
  const settings = useSettingsStore()

  const titleInputRef = ref<HTMLInputElement | null>(null)
  const bodyInputRef = ref<HTMLTextAreaElement | null>(null)
  const showTagPicker = ref(false)
  const showDatePicker = ref(false)
  const datePickerWrapperRef = ref<HTMLElement | null>(null)
  const focusBodyOnEdit = ref(false)

  // ── Picker click-outside ──
  function onDatePickerClickOutside(e: MouseEvent) {
    if (datePickerWrapperRef.value && !datePickerWrapperRef.value.contains(e.target as HTMLElement)) {
      showDatePicker.value = false
    }
  }

  watch(showDatePicker, (open) => {
    if (open) {
      setTimeout(() => document.addEventListener('mousedown', onDatePickerClickOutside, true), 0)
    } else {
      document.removeEventListener('mousedown', onDatePickerClickOutside, true)
    }
  })

  function onTagPickerClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target.closest('[data-tag-picker]')) {
      showTagPicker.value = false
    }
  }

  watch(showTagPicker, (open) => {
    if (open) {
      setTimeout(() => document.addEventListener('mousedown', onTagPickerClickOutside, true), 0)
    } else {
      document.removeEventListener('mousedown', onTagPickerClickOutside, true)
    }
  })

  // ── Status picker ──
  const showStatusPicker = ref(false)
  const statusPickerRef = ref<HTMLElement | null>(null)

  const currentStatusDef = computed(
    () => store.statusMap.get(props.node.status) ?? store.statusDefs[0],
  )

  function onStatusClick(e: MouseEvent) {
    e.stopPropagation()
    showStatusPicker.value = !showStatusPicker.value
  }

  function onPickStatus(status: Status) {
    store.setStatus(props.node.id, status)
    showStatusPicker.value = false
  }

  function onClickOutsideStatus(e: PointerEvent) {
    if (statusPickerRef.value && !statusPickerRef.value.contains(e.target as globalThis.Node)) {
      showStatusPicker.value = false
    }
  }

  watch(showStatusPicker, (open) => {
    if (open) {
      document.addEventListener('pointerdown', onClickOutsideStatus, { capture: true })
    } else {
      document.removeEventListener('pointerdown', onClickOutsideStatus, { capture: true })
    }
  })

  // ── Text editing ──
  const localText = ref(props.node.text)

  const localTitle = computed(() => getTitle(localText.value))
  const localBody = computed(() => getBody(localText.value))

  const renderedLines = computed(() => {
    const text = localText.value
    if (!text) return null
    const lines = text.split('\n')
    return {
      first: renderInlineMarkdown(lines[0]!),
      rest: lines.length > 1 ? lines.slice(1).map((l) => renderInlineMarkdown(l)) : null,
    }
  })

  function autoResizeBody() {
    const el = bodyInputRef.value
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }

  onMounted(async () => {
    await nextTick()
    autoResizeBody()
    if (isEditing()) {
      const input = titleInputRef.value
      if (input && document.activeElement !== input) {
        input.focus()
        if (store.editingTrigger === 'keyboard') {
          const len = input.value.length
          input.setSelectionRange(len, len)
        }
      }
    }
  })

  watch(
    () => store.nodes.get(props.node.id)?.text,
    (v) => {
      if (!isEditing() && v !== undefined) {
        localText.value = v
        nextTick(autoResizeBody)
      }
    },
  )

  watch(
    isEditing,
    async (editing) => {
      if (editing) {
        localText.value = props.node.text
        await nextTick()
        autoResizeBody()
        const cursorColumn = store.editingCursorColumn
        store.editingCursorColumn = null
        const shouldFocusBody =
          focusBodyOnEdit.value || (store.editingFocusBody && localText.value.includes('\n'))
        if (shouldFocusBody) {
          focusBodyOnEdit.value = false
          store.editingFocusBody = false
          await nextTick()
          const body = bodyInputRef.value
          if (body) {
            body.focus()
            if (cursorColumn === -1 || cursorColumn === null) {
              const len = body.value.length
              body.setSelectionRange(len, len)
            } else {
              const pos = Math.min(cursorColumn, body.value.length)
              body.setSelectionRange(pos, pos)
            }
          }
          return
        }
        const input = titleInputRef.value
        if (input) {
          if (document.activeElement !== input) {
            input.focus()
          }
          if (store.editingTrigger === 'keyboard') {
            if (cursorColumn !== null) {
              const pos = Math.min(cursorColumn, input.value.length)
              input.setSelectionRange(pos, pos)
            } else {
              const len = input.value.length
              input.setSelectionRange(len, len)
            }
          }
        }
      }
    },
  )

  function onTitleInput(e: Event) {
    const newTitle = (e.target as HTMLInputElement).value
    const combined = combineText(newTitle, localBody.value)
    localText.value = combined
    store.updateText(props.node.id, combined)
  }

  function onBodyInput(e: Event) {
    const newBody = (e.target as HTMLTextAreaElement).value
    const combined = combineText(localTitle.value, newBody)
    localText.value = combined
    store.updateText(props.node.id, combined)
    autoResizeBody()
  }

  function cleanupEmptyBody() {
    if (localText.value.includes('\n') && localBody.value === '') {
      localText.value = localTitle.value
      store.updateText(props.node.id, localTitle.value)
    }
  }

  function getColumnInLine(textarea: HTMLTextAreaElement): number {
    const pos = textarea.selectionStart ?? 0
    const text = textarea.value
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1
    return pos - lineStart
  }

  function onBlur(e: FocusEvent) {
    const relatedTarget = e.relatedTarget as HTMLElement | null
    if (relatedTarget === titleInputRef.value || relatedTarget === bodyInputRef.value) {
      return
    }
    cleanupEmptyBody()
    if (store.editingId === props.node.id) {
      store.stopEditing()
    }
  }

  // ── Keyboard ──
  function findEditingAction(e: KeyboardEvent): ShortcutAction | null {
    for (const def of settings.resolvedShortcuts) {
      if (def.context !== 'editing') continue
      if (matchesCombo(e, def.combo)) return def.action
    }
    return null
  }

  function handleCommonKeydown(e: KeyboardEvent): boolean {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      const idx = parseInt(e.key) - 1
      if (idx >= 0 && idx < store.statusDefs.length) {
        store.setStatus(props.node.id, store.statusDefs[idx]!.id)
        e.preventDefault()
        return true
      }
    }

    const action = findEditingAction(e)
    if (action === 'stopEditing') {
      store.stopEditing()
      ;(titleInputRef.value?.closest('.outline-focus-target') as HTMLElement)?.focus()
      e.preventDefault()
      return true
    }
    if (action === 'newSibling') {
      store.flushTextDebounce()
      store.createSiblingBelowAndEdit()
      e.preventDefault()
      return true
    }
    if (action === 'indent') {
      e.preventDefault()
      store.indentAndKeepEditing(props.node.id)
      return true
    }
    if (action === 'outdent') {
      e.preventDefault()
      store.outdentAndKeepEditing(props.node.id)
      return true
    }
    return false
  }

  function onTitleKeydown(e: KeyboardEvent) {
    if (handleCommonKeydown(e)) return

    const input = titleInputRef.value

    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      cleanupEmptyBody()
      store.flushTextDebounce()
      store.editNextNode(props.node.id, 0)
      return
    }
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      cleanupEmptyBody()
      store.flushTextDebounce()
      store.editPreviousNode(props.node.id, false, 0)
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!localBody.value) {
        localText.value = localTitle.value + '\n'
        store.updateText(props.node.id, localTitle.value + '\n')
      }
      nextTick(() => {
        autoResizeBody()
        bodyInputRef.value?.focus()
      })
    } else if (e.key === 'Backspace' && input && input.value === '' && !localBody.value) {
      e.preventDefault()
      store.deleteNodeAndEditPrevious(props.node.id)
    } else if (e.key === 'ArrowUp' && !e.shiftKey && input) {
      e.preventDefault()
      cleanupEmptyBody()
      store.flushTextDebounce()
      store.editPreviousNode(props.node.id, true, -1)
    } else if (e.key === 'ArrowDown' && !e.shiftKey && input) {
      e.preventDefault()
      const column = input.selectionStart ?? 0
      if (localBody.value) {
        const body = bodyInputRef.value
        if (body) {
          body.focus()
          const firstLineEnd = body.value.indexOf('\n')
          const firstLineLen = firstLineEnd === -1 ? body.value.length : firstLineEnd
          const targetPos = Math.min(column, firstLineLen)
          body.setSelectionRange(targetPos, targetPos)
        }
      } else {
        cleanupEmptyBody()
        store.flushTextDebounce()
        store.editNextNode(props.node.id, column)
      }
    }
  }

  function onBodyKeydown(e: KeyboardEvent) {
    if (handleCommonKeydown(e)) return

    const input = bodyInputRef.value

    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      cleanupEmptyBody()
      store.flushTextDebounce()
      store.editNextNode(props.node.id, 0)
      return
    }
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      cleanupEmptyBody()
      store.flushTextDebounce()
      store.editPreviousNode(props.node.id, false, 0)
      return
    }

    if (e.key === 'Backspace' && input && input.value === '') {
      e.preventDefault()
      localText.value = localTitle.value
      store.updateText(props.node.id, localTitle.value)
      nextTick(() => {
        titleInputRef.value?.focus()
        const len = titleInputRef.value?.value.length ?? 0
        titleInputRef.value?.setSelectionRange(len, len)
      })
    } else if (e.key === 'ArrowUp' && !e.shiftKey && input) {
      const posBefore = input.selectionStart ?? 0
      const columnBefore = getColumnInLine(input)
      requestAnimationFrame(() => {
        if (!bodyInputRef.value) return
        const posAfter = bodyInputRef.value.selectionStart ?? 0
        if (posBefore === posAfter || (posBefore > 0 && posAfter === 0)) {
          const title = titleInputRef.value
          if (title) {
            title.focus()
            const targetPos = Math.min(columnBefore, title.value.length)
            title.setSelectionRange(targetPos, targetPos)
          }
        }
      })
    } else if (e.key === 'ArrowDown' && !e.shiftKey && input) {
      const posBefore = input.selectionStart ?? 0
      const columnBefore = getColumnInLine(input)
      const textLen = input.value.length
      requestAnimationFrame(() => {
        if (!bodyInputRef.value) return
        const posAfter = bodyInputRef.value.selectionStart ?? 0
        if (posBefore === posAfter || (posBefore < textLen && posAfter === textLen)) {
          cleanupEmptyBody()
          store.flushTextDebounce()
          store.editNextNode(props.node.id, columnBefore)
        }
      })
    }
  }

  function onTitleFocus() {
    if (!isEditing()) {
      store.selectNode(props.node.id)
      store.startEditing(props.node.id, 'click')
    }
  }

  function onBodyFocus() {
    if (!isEditing()) {
      store.selectNode(props.node.id)
      store.startEditing(props.node.id, 'click')
    }
  }

  onUnmounted(() => {
    document.removeEventListener('mousedown', onDatePickerClickOutside, true)
    document.removeEventListener('mousedown', onTagPickerClickOutside, true)
    document.removeEventListener('pointerdown', onClickOutsideStatus, { capture: true } as EventListenerOptions)
  })

  return {
    // Text editing
    localText,
    localTitle,
    localBody,
    renderedLines,
    titleInputRef,
    bodyInputRef,
    focusBodyOnEdit,
    onTitleInput,
    onBodyInput,
    onBlur,
    onTitleKeydown,
    onBodyKeydown,
    onTitleFocus,
    onBodyFocus,
    // Pickers
    showTagPicker,
    showDatePicker,
    datePickerWrapperRef,
    // Status picker
    showStatusPicker,
    statusPickerRef,
    currentStatusDef,
    onStatusClick,
    onPickStatus,
  }
}
