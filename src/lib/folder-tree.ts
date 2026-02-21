import type { DocumentMeta } from '@/lib/doc-registry'

export interface FolderTreeNode {
  name: string
  path: string
  type: 'folder' | 'file'
  children: FolderTreeNode[]
  docId?: string
}

function ensureFolderNode(root: FolderTreeNode, folderPath: string): FolderTreeNode {
  const segments = folderPath.split('/')
  let current = root
  let pathSoFar = ''
  for (const seg of segments) {
    pathSoFar = pathSoFar ? `${pathSoFar}/${seg}` : seg
    let child = current.children.find((c) => c.type === 'folder' && c.name === seg)
    if (!child) {
      child = { name: seg, path: pathSoFar, type: 'folder', children: [] }
      current.children.push(child)
    }
    current = child
  }
  return current
}

function sortTree(node: FolderTreeNode): void {
  node.children.sort((a, b) => {
    // Folders first, then files
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const child of node.children) {
    if (child.type === 'folder') sortTree(child)
  }
}

export function buildFolderTree(
  documents: DocumentMeta[],
  folders: string[],
): FolderTreeNode {
  const root: FolderTreeNode = {
    name: '',
    path: '',
    type: 'folder',
    children: [],
  }

  // Insert all known folder paths
  for (const folder of folders) {
    ensureFolderNode(root, folder)
  }

  // Insert all documents into the tree
  for (const doc of documents) {
    const parts = doc.id.split('/')
    const fileName = parts.pop()!
    const folderPath = parts.join('/')
    const parent = folderPath ? ensureFolderNode(root, folderPath) : root
    const displayName = doc.name.includes('/')
      ? doc.name.substring(doc.name.lastIndexOf('/') + 1)
      : doc.name
    parent.children.push({
      name: displayName,
      path: doc.id,
      type: 'file',
      children: [],
      docId: doc.id,
    })
  }

  sortTree(root)
  return root
}
