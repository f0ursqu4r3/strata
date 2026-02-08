import { loadRegistry } from '@/lib/doc-registry'
import { setCurrentDocId, loadLatestSnapshot, loadOpsAfter, loadAllOps, loadStatusConfig } from '@/lib/idb'
import { applyOp, setSeq } from '@/lib/ops'
import { serializeToMarkdown } from '@/lib/markdown-serialize'
import { writeFile } from '@/lib/fs'
import { DEFAULT_STATUSES } from '@/types'
import type { Node, StatusDef } from '@/types'

export async function migrateIdbToFiles(workspacePath: string): Promise<number> {
  const registry = loadRegistry()
  if (registry.documents.length === 0) return 0

  let migrated = 0

  for (const doc of registry.documents) {
    try {
      setCurrentDocId(doc.id)

      // Rebuild node map from IDB (same pattern as doc.ts init)
      const snapshot = await loadLatestSnapshot()
      let nodeMap: Map<string, Node>
      let rootId = ''

      if (snapshot) {
        nodeMap = new Map(snapshot.nodes.map((n) => [n.id, { ...n }]))
        rootId = snapshot.rootId
        setSeq(snapshot.seqAfter)

        const recentOps = await loadOpsAfter(snapshot.seqAfter)
        for (const op of recentOps) {
          applyOp(nodeMap, op)
        }
      } else {
        const allOps = await loadAllOps()
        if (allOps.length === 0) continue // empty document

        nodeMap = new Map()
        for (const op of allOps) {
          applyOp(nodeMap, op)
        }
        // Find root
        for (const [id, node] of nodeMap) {
          if (node.parentId === null && !node.deleted) {
            rootId = id
            break
          }
        }
      }

      if (!rootId) continue

      // Ensure tags array exists
      for (const node of nodeMap.values()) {
        if (!node.tags) node.tags = []
      }

      // Load status config
      const savedStatuses = await loadStatusConfig()
      const statusConfig: StatusDef[] =
        savedStatuses && savedStatuses.length > 0 ? savedStatuses : [...DEFAULT_STATUSES]

      // Serialize to markdown
      const content = serializeToMarkdown({ nodes: nodeMap, rootId, statusConfig })

      // Write file (sanitize name for filesystem)
      const safeName = doc.name.replace(/[<>:"/\\|?*]/g, '_')
      const filePath = `${workspacePath}/${safeName}.md`
      await writeFile(filePath, content)
      migrated++
    } catch (err) {
      console.error(`Failed to migrate document "${doc.name}":`, err)
    }
  }

  return migrated
}

export function hasExistingIdbDocs(): boolean {
  const registry = loadRegistry()
  return registry.documents.length > 0
}
