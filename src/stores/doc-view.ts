import { computed, type Ref, type ComputedRef, type ShallowRef } from 'vue'
import type { Node, StatusDef } from '@/types'
import { matchesDueDateFilter } from '@/lib/due-date'
import { markAncestors } from '@/lib/tree-utils'

interface DocViewDeps {
  nodes: ShallowRef<Map<string, Node>>
  rootId: Ref<string>
  zoomId: Ref<string | null>
  filters: { search: string; tag: string | null; dueDate: string | null }
  statusConfig: Ref<StatusDef[]>
  childrenMap: ComputedRef<Map<string | null, Node[]>>
}

export function useDocView(deps: DocViewDeps) {
  function getChildren(parentId: string): Node[] {
    return deps.childrenMap.value.get(parentId) ?? []
  }

  // ── Visible rows (flattened DFS for outline) ──
  const effectiveZoomId = computed(() => deps.zoomId.value ?? deps.rootId.value)

  // ── Search: set of matching node IDs + ancestors that should be visible ──
  const searchMatchIds = computed(() => {
    const q = deps.filters.search.trim().toLowerCase()
    if (!q) return null
    const direct = new Set<string>()
    for (const node of deps.nodes.value.values()) {
      if (!node.deleted && node.text.toLowerCase().includes(q)) {
        direct.add(node.id)
      }
    }
    return markAncestors(deps.nodes.value, direct)
  })

  const allTags = computed(() => {
    const tagSet = new Set<string>()
    for (const node of deps.nodes.value.values()) {
      if (node.deleted) continue
      if (node.tags) {
        for (const tag of node.tags) tagSet.add(tag)
      }
    }
    return Array.from(tagSet).sort()
  })

  const tagMatchIds = computed(() => {
    const tag = deps.filters.tag
    if (!tag) return null
    const direct = new Set<string>()
    for (const node of deps.nodes.value.values()) {
      if (!node.deleted && node.tags?.includes(tag)) {
        direct.add(node.id)
      }
    }
    return markAncestors(deps.nodes.value, direct)
  })

  const dueDateMatchIds = computed(() => {
    const filter = deps.filters.dueDate
    if (filter === 'all') return null
    const direct = new Set<string>()
    for (const node of deps.nodes.value.values()) {
      if (
        !node.deleted &&
        matchesDueDateFilter(node.dueDate, filter as 'overdue' | 'today' | 'week')
      ) {
        direct.add(node.id)
      }
    }
    return markAncestors(deps.nodes.value, direct)
  })

  const visibleRows = computed(() => {
    const rows: { node: Node; depth: number }[] = []
    const root = effectiveZoomId.value
    if (!root) return rows
    const searchFilter = searchMatchIds.value
    const tagF = tagMatchIds.value
    const dueF = dueDateMatchIds.value

    function walk(parentId: string, depth: number) {
      const children = getChildren(parentId)
      for (const child of children) {
        if (searchFilter && !searchFilter.has(child.id)) continue
        if (tagF && !tagF.has(child.id)) continue
        if (dueF && !dueF.has(child.id)) continue
        rows.push({ node: child, depth })
        const isFiltering = searchFilter || tagF || dueF
        if (!child.collapsed || isFiltering) {
          walk(child.id, depth + 1)
        }
      }
    }
    walk(root, 0)
    return rows
  })

  // ── Kanban: nodes grouped by status ──
  function subtreeNodes(rootNodeId: string): Node[] {
    const result: Node[] = []
    function walk(pid: string) {
      const children = getChildren(pid)
      for (const child of children) {
        result.push(child)
        walk(child.id)
      }
    }
    walk(rootNodeId)
    return result
  }

  const kanbanNodes = computed(() => {
    const root = effectiveZoomId.value
    if (!root) return []
    let all = subtreeNodes(root)
    const tag = deps.filters.tag
    if (tag) all = all.filter((n) => n.tags && n.tags.includes(tag))
    const dueFilter = deps.filters.dueDate
    if (dueFilter && dueFilter !== 'all')
      all = all.filter((n) =>
        matchesDueDateFilter(n.dueDate, dueFilter as 'overdue' | 'today' | 'week'),
      )
    return all
  })

  const kanbanColumns = computed(() => {
    const cols = deps.statusConfig.value.map((def) => ({ def, nodes: [] as Node[] }))
    const colMap = new Map(cols.map((c) => [c.def.id, c]))
    for (const node of kanbanNodes.value) {
      const col = colMap.get(node.status)
      if (col) col.nodes.push(node)
      else if (cols.length > 0) cols[0]!.nodes.push(node)
    }
    return cols
  })

  // ── Zoom breadcrumb path ──
  const zoomBreadcrumbs = computed(() => {
    const crumbs: { id: string; text: string }[] = []
    if (!deps.zoomId.value) return crumbs
    let cur = deps.nodes.value.get(deps.zoomId.value)
    while (cur && cur.id !== deps.rootId.value) {
      crumbs.unshift({ id: cur.id, text: cur.text || '(empty)' })
      if (!cur.parentId) break
      cur = deps.nodes.value.get(cur.parentId)
    }
    return crumbs
  })

  const trashedNodes = computed(() => {
    const result: Node[] = []
    for (const node of deps.nodes.value.values()) {
      if (node.deleted && node.parentId !== null) {
        result.push(node)
      }
    }
    return result.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
  })

  return {
    effectiveZoomId,
    searchMatchIds,
    allTags,
    tagMatchIds,
    dueDateMatchIds,
    visibleRows,
    kanbanNodes,
    kanbanColumns,
    zoomBreadcrumbs,
    trashedNodes,
    subtreeNodes,
  }
}
