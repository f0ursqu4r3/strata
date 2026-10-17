import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import FolderTreeItem from '@/components/sidebar/FolderTreeItem.vue'
import type { FolderTreeNode } from '@/lib/folder-tree'

function mountItem(node: FolderTreeNode, renamingId: string) {
  const renameInputRef = ref<HTMLInputElement[]>([])
  const wrapper = mount(FolderTreeItem, {
    props: {
      node,
      depth: 0,
      activeDocId: '',
      renamingId,
      renameText: node.name,
      renameConflict: false,
    },
    global: {
      provide: {
        expandedFolders: ref(new Set<string>()),
        renameInputRef,
      },
    },
  })
  return { wrapper, renameInputRef }
}

describe('FolderTreeItem rename input ref', () => {
  it('stores the document rename input as an array so the sidebar can focus it', () => {
    const node: FolderTreeNode = {
      name: 'Notes',
      path: 'Notes.md',
      type: 'file',
      children: [],
      docId: 'Notes.md',
    }
    const { wrapper, renameInputRef } = mountItem(node, 'Notes.md')
    const input = wrapper.find('input[aria-label="Document name"]').element
    expect(Array.isArray(renameInputRef.value)).toBe(true)
    expect(renameInputRef.value[0]).toBe(input)
  })

  it('stores the folder rename input as an array so the sidebar can focus it', () => {
    const node: FolderTreeNode = { name: 'notes', path: 'notes', type: 'folder', children: [] }
    const { wrapper, renameInputRef } = mountItem(node, 'notes')
    const input = wrapper.find('input[aria-label="Folder name"]').element
    expect(Array.isArray(renameInputRef.value)).toBe(true)
    expect(renameInputRef.value[0]).toBe(input)
  })
})
