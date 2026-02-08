import { ref, nextTick } from 'vue'
import { useDocStore } from '@/stores/doc'
import { STATUS_COLOR_PALETTE } from '@/lib/status-icons'
import type { StatusDef } from '@/types'

export function useStatusCrud(emit: { (e: 'close'): void }) {
  const store = useDocStore()

  const deletingId = ref<string | null>(null)
  const replacementId = ref<string>('')
  const labelInputs = ref<HTMLInputElement[]>([])

  function onLabelChange(statusId: string, value: string) {
    store.updateStatus(statusId, { label: value })
  }

  function focusInput(idx: number) {
    nextTick(() => {
      labelInputs.value[idx]?.focus()
      labelInputs.value[idx]?.select()
    })
  }

  function onLabelKeydown(e: KeyboardEvent, idx: number) {
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault()
      const nextIdx = idx + 1
      if (nextIdx < store.statusDefs.length) {
        focusInput(nextIdx)
      }
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      const prevIdx = idx - 1
      if (prevIdx >= 0) {
        focusInput(prevIdx)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIdx = idx + 1
      if (nextIdx < store.statusDefs.length) {
        focusInput(nextIdx)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prevIdx = idx - 1
      if (prevIdx >= 0) {
        focusInput(prevIdx)
      }
    }
  }

  function onIconChange(statusId: string, icon: string) {
    store.updateStatus(statusId, { icon })
  }

  function onColorChange(statusId: string, color: string) {
    store.updateStatus(statusId, { color })
  }

  function onToggleFinal(statusId: string, currentFinal: boolean | undefined) {
    store.updateStatus(statusId, { final: !currentFinal })
  }

  function onMoveUp(idx: number) {
    if (idx <= 0) return
    const ids = store.statusDefs.map((s) => s.id)
    ;[ids[idx - 1], ids[idx]] = [ids[idx]!, ids[idx - 1]!]
    store.reorderStatuses(ids)
    focusInput(idx - 1)
  }

  function onMoveDown(idx: number) {
    if (idx >= store.statusDefs.length - 1) return
    const ids = store.statusDefs.map((s) => s.id)
    ;[ids[idx], ids[idx + 1]] = [ids[idx + 1]!, ids[idx]!]
    store.reorderStatuses(ids)
    focusInput(idx + 1)
  }

  function onAddStatus() {
    const usedColors = new Set(store.statusDefs.map((s) => s.color))
    const color = STATUS_COLOR_PALETTE.find((c) => !usedColors.has(c)) ?? STATUS_COLOR_PALETTE[0]!
    const def: StatusDef = {
      id: crypto.randomUUID().slice(0, 8),
      label: 'New Status',
      color,
      icon: 'circle',
    }
    store.addStatus(def)
  }

  function onStartDelete(statusId: string) {
    deletingId.value = statusId
    const other = store.statusDefs.find((s) => s.id !== statusId)
    replacementId.value = other?.id ?? ''
  }

  function onConfirmDelete() {
    if (!deletingId.value || !replacementId.value) return
    store.removeStatus(deletingId.value, replacementId.value)
    deletingId.value = null
    replacementId.value = ''
  }

  function onCloseMain() {
    if (deletingId.value) {
      deletingId.value = null
    } else {
      emit('close')
    }
  }

  return {
    deletingId,
    replacementId,
    labelInputs,
    onLabelChange,
    onLabelKeydown,
    onIconChange,
    onColorChange,
    onToggleFinal,
    onMoveUp,
    onMoveDown,
    onAddStatus,
    onStartDelete,
    onConfirmDelete,
    onCloseMain,
  }
}
