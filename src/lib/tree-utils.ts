import type { Node } from "@/types";

/**
 * Get ordered, non-deleted children of a parent node.
 */
export function getOrderedChildren(nodes: Map<string, Node>, parentId: string): Node[] {
  const children: Node[] = [];
  for (const node of nodes.values()) {
    if (node.parentId === parentId && !node.deleted) {
      children.push(node);
    }
  }
  return children.sort((a, b) => (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0));
}

/**
 * Given a set of directly matching node IDs, expand the set to include
 * all ancestor IDs so that matches are reachable in the outline tree.
 * Returns the expanded set, or null if no direct matches were found.
 */
export function markAncestors(
  nodes: Map<string, Node>,
  directMatchIds: Set<string>,
): Set<string> {
  const result = new Set(directMatchIds);
  for (const id of directMatchIds) {
    let cur = nodes.get(id);
    while (cur?.parentId) {
      if (result.has(cur.parentId)) break; // already traced this path
      result.add(cur.parentId);
      cur = nodes.get(cur.parentId);
    }
  }
  return result;
}
