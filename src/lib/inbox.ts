import Dexie, { type EntityTable } from 'dexie'
import type { Node, Op } from '@/types'
import { makeOp, rebuildState, setSeq } from '@/lib/ops'
import { rankBefore, initialRank } from '@/lib/rank'

export const INBOX_DOC_ID = '__inbox__'
const INBOX_ROOT_ID = 'inbox-root'

// ── Dedicated inbox database (independent of the main doc context) ──

type OpRecord = Op

interface InboxDB extends Dexie {
  ops: EntityTable<OpRecord, 'opId'>
}

let _inboxDB: InboxDB | null = null

function inboxDB(): InboxDB {
  if (_inboxDB) return _inboxDB
  const db = new Dexie(`strata-doc-${INBOX_DOC_ID}`) as InboxDB
  db.version(1).stores({
    ops: 'opId, seq, ts',
  })
  _inboxDB = db
  return db
}

async function loadAllInboxOps(): Promise<Op[]> {
  return (await inboxDB().ops.orderBy('seq').toArray()) as Op[]
}

async function saveInboxOps(ops: Op[]): Promise<void> {
  await inboxDB().ops.bulkPut(ops as OpRecord[])
}

/**
 * Ensure the inbox root node exists by creating it if needed.
 */
async function ensureInboxRoot(): Promise<void> {
  const allOps = await loadAllInboxOps()
  if (allOps.length === 0) {
    setSeq(0)
    const op = makeOp('create', {
      type: 'create',
      id: INBOX_ROOT_ID,
      parentId: null,
      pos: initialRank(),
      text: 'Inbox',
      status: 'todo',
    })
    await saveInboxOps([op])
  }
}

/**
 * Add a text item to the inbox. Creates the inbox if it doesn't exist.
 */
export async function addToInbox(text: string, status = 'todo'): Promise<void> {
  await ensureInboxRoot()

  const allOps = await loadAllInboxOps()
  const nodeMap = rebuildState([], allOps)

  // Find the max seq to continue from
  const maxSeq = allOps.reduce((m, o) => Math.max(m, o.seq), 0)
  setSeq(maxSeq)

  // Find children of root and get the first position
  const children: Node[] = []
  for (const node of nodeMap.values()) {
    if (node.parentId === INBOX_ROOT_ID && !node.deleted) {
      children.push(node)
    }
  }
  children.sort((a, b) => a.pos.localeCompare(b.pos))

  // Place new item before the first child (newest at top)
  const pos = children.length > 0 ? rankBefore(children[0]!.pos) : initialRank()

  const id = `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const op = makeOp('create', {
    type: 'create',
    id,
    parentId: INBOX_ROOT_ID,
    pos,
    text,
    status,
  })
  await saveInboxOps([op])
}

/**
 * Load all inbox nodes (for display in the main app).
 */
export async function loadInboxNodes(): Promise<Node[]> {
  const allOps = await loadAllInboxOps()
  if (allOps.length === 0) return []

  const nodeMap = rebuildState([], allOps)
  const nodes = [...nodeMap.values()]
  const root = nodes.find((n) => n.parentId === null)
  if (!root) return []

  const items = nodes.filter((n) => n.parentId === root.id && !n.deleted)
  items.sort((a, b) => a.pos.localeCompare(b.pos))
  return [root, ...items]
}
