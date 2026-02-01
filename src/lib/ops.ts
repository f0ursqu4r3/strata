import type {
  Node,
  Op,
  OpType,
  OpPayload,
  CreatePayload,
  UpdateTextPayload,
  MovePayload,
  SetStatusPayload,
  TombstonePayload,
  AddTagPayload,
  RemoveTagPayload,
  RestorePayload,
} from '@/types'

let clientId: string | null = null
let seq = 0

export function getClientId(): string {
  if (!clientId) {
    clientId = crypto.randomUUID()
  }
  return clientId
}

export function getNextSeq(): number {
  return ++seq
}

export function setSeq(n: number): void {
  seq = n
}

export function makeOp(type: OpType, payload: OpPayload): Op {
  return {
    opId: crypto.randomUUID(),
    clientId: getClientId(),
    seq: getNextSeq(),
    ts: Date.now(),
    type,
    payload,
  }
}

/**
 * Apply a single op to the nodes map (mutates in place for performance).
 * Returns the affected node id, or null if no change.
 */
export function applyOp(nodes: Map<string, Node>, op: Op): string | null {
  const p = op.payload

  switch (p.type) {
    case 'create': {
      const cp = p as CreatePayload
      nodes.set(cp.id, {
        id: cp.id,
        parentId: cp.parentId,
        pos: cp.pos,
        text: cp.text,
        collapsed: false,
        status: cp.status,
        deleted: false,
        tags: [],
      })
      return cp.id
    }
    case 'updateText': {
      const up = p as UpdateTextPayload
      const node = nodes.get(up.id)
      if (node) {
        node.text = up.text
        return up.id
      }
      return null
    }
    case 'move': {
      const mp = p as MovePayload
      const node = nodes.get(mp.id)
      if (node) {
        node.parentId = mp.parentId
        node.pos = mp.pos
        return mp.id
      }
      return null
    }
    case 'setStatus': {
      const sp = p as SetStatusPayload
      const node = nodes.get(sp.id)
      if (node) {
        node.status = sp.status
        return sp.id
      }
      return null
    }
    case 'toggleCollapsed': {
      const id = (p as { type: string; id: string }).id
      const node = nodes.get(id)
      if (node) {
        node.collapsed = !node.collapsed
        return id
      }
      return null
    }
    case 'tombstone': {
      const tp = p as TombstonePayload
      const node = nodes.get(tp.id)
      if (node) {
        node.deleted = true
        node.deletedAt = Date.now()
        return tp.id
      }
      return null
    }
    case 'addTag': {
      const atp = p as AddTagPayload
      const node = nodes.get(atp.id)
      if (node) {
        if (!node.tags) node.tags = []
        if (!node.tags.includes(atp.tag)) {
          node.tags.push(atp.tag)
        }
        return atp.id
      }
      return null
    }
    case 'removeTag': {
      const rtp = p as RemoveTagPayload
      const node = nodes.get(rtp.id)
      if (node) {
        node.tags = (node.tags || []).filter((t) => t !== rtp.tag)
        return rtp.id
      }
      return null
    }
    case 'restore': {
      const rp = p as RestorePayload
      const node = nodes.get(rp.id)
      if (node) {
        node.deleted = false
        node.deletedAt = undefined
        return rp.id
      }
      return null
    }
  }
  return null
}

/**
 * Rebuild full state from a snapshot's nodes + a list of ops.
 */
export function rebuildState(
  snapshotNodes: Node[],
  ops: Op[],
): Map<string, Node> {
  const nodes = new Map<string, Node>()
  for (const n of snapshotNodes) {
    nodes.set(n.id, { ...n })
  }
  // Sort ops by seq to apply in order
  const sorted = [...ops].sort((a, b) => a.seq - b.seq)
  for (const op of sorted) {
    applyOp(nodes, op)
  }
  return nodes
}
