import type { Node, StatusDef } from "@/types";

export interface ParsedTree {
  nodes: Map<string, Node>;
  rootId: string;
  statusConfig: StatusDef[];
  tagColors: Record<string, string>;
}

/**
 * Reconcile a freshly-parsed tree with the existing node tree so that
 * matching nodes keep their existing IDs. This prevents TransitionGroup
 * from tearing down and re-creating DOM elements on every external edit,
 * which was causing a visible flash.
 *
 * Matching strategy per tree level:
 *  1. Text match (first line) — order-preserving scan
 *  2. Position fallback — remaining unmatched nodes paired in order
 *     (handles text edits where the title changed)
 */
export function reconcileParsed(
  oldMap: Map<string, Node>,
  oldRootId: string,
  parsed: ParsedTree,
): ParsedTree {
  const newMap = parsed.nodes;
  const newRootId = parsed.rootId;

  function childrenOf(map: Map<string, Node>, parentId: string): Node[] {
    const kids: Node[] = [];
    for (const n of map.values()) {
      if (n.parentId === parentId && !n.deleted) kids.push(n);
    }
    kids.sort((a, b) => a.pos.localeCompare(b.pos));
    return kids;
  }

  function firstLine(text: string): string {
    const idx = text.indexOf("\n");
    return idx >= 0 ? text.substring(0, idx) : text;
  }

  // new ID → old ID
  const idMap = new Map<string, string>();
  idMap.set(newRootId, oldRootId);

  function matchLevel(oldParentId: string, newParentId: string) {
    const oldKids = childrenOf(oldMap, oldParentId);
    const newKids = childrenOf(newMap, newParentId);

    // Build text → indices for old children
    const oldByText = new Map<string, number[]>();
    for (let i = 0; i < oldKids.length; i++) {
      const t = firstLine(oldKids[i]!.text);
      if (!oldByText.has(t)) oldByText.set(t, []);
      oldByText.get(t)!.push(i);
    }

    // Phase 1: exact first-line text match, order-preserving
    const matchedOld = new Set<number>();
    const matchedNew = new Set<number>();
    let lastOldIdx = -1;

    for (let ni = 0; ni < newKids.length; ni++) {
      const t = firstLine(newKids[ni]!.text);
      const candidates = oldByText.get(t);
      if (!candidates) continue;
      for (const oi of candidates) {
        if (oi > lastOldIdx && !matchedOld.has(oi)) {
          matchedOld.add(oi);
          matchedNew.add(ni);
          lastOldIdx = oi;
          idMap.set(newKids[ni]!.id, oldKids[oi]!.id);
          matchLevel(oldKids[oi]!.id, newKids[ni]!.id);
          break;
        }
      }
    }

    // Phase 2: positional fallback for remaining (handles title edits)
    const unmatchedNew: number[] = [];
    const unmatchedOld: number[] = [];
    for (let ni = 0; ni < newKids.length; ni++) {
      if (!matchedNew.has(ni)) unmatchedNew.push(ni);
    }
    for (let oi = 0; oi < oldKids.length; oi++) {
      if (!matchedOld.has(oi)) unmatchedOld.push(oi);
    }
    const pairLen = Math.min(unmatchedNew.length, unmatchedOld.length);
    for (let i = 0; i < pairLen; i++) {
      const ni = unmatchedNew[i]!;
      const oi = unmatchedOld[i]!;
      idMap.set(newKids[ni]!.id, oldKids[oi]!.id);
      matchLevel(oldKids[oi]!.id, newKids[ni]!.id);
    }

    // Truly new nodes — recurse in case they have children
    for (let i = pairLen; i < unmatchedNew.length; i++) {
      matchLevel("", newKids[unmatchedNew[i]!]!.id);
    }
  }

  matchLevel(oldRootId, newRootId);

  // Rebuild nodes map with resolved IDs
  const result = new Map<string, Node>();
  for (const [newId, node] of newMap) {
    const resolvedId = idMap.get(newId) ?? newId;
    const resolvedParent =
      node.parentId != null ? (idMap.get(node.parentId) ?? node.parentId) : null;
    const oldNode = oldMap.get(resolvedId);
    result.set(resolvedId, {
      ...node,
      id: resolvedId,
      parentId: resolvedParent,
      collapsed: oldNode?.collapsed ?? node.collapsed,
    });
  }

  return {
    rootId: idMap.get(newRootId) ?? newRootId,
    nodes: result,
    statusConfig: parsed.statusConfig,
    tagColors: parsed.tagColors,
  };
}
