import Dexie, { type EntityTable } from 'dexie'
import type { Op, Snapshot, Node } from '@/types'

interface OpRecord extends Op {
  // seq is also the primary key
}

interface SnapshotRecord {
  id: string
  nodes: Node[]
  rootId: string
  seqAfter: number
  ts: number
}

const db = new Dexie('strata') as Dexie & {
  ops: EntityTable<OpRecord, 'opId'>
  snapshots: EntityTable<SnapshotRecord, 'id'>
}

db.version(1).stores({
  ops: 'opId, seq, ts',
  snapshots: 'id, seqAfter',
})

// ── Batched write queue ──
// Buffers individual ops and flushes them in a single bulkPut after a short delay
let _opBuffer: Op[] = []
let _flushTimer: ReturnType<typeof setTimeout> | null = null
let _flushPromise: Promise<void> | null = null
const FLUSH_DELAY = 50 // ms

function _scheduleFlush() {
  if (_flushTimer) return
  _flushTimer = setTimeout(() => {
    _flushTimer = null
    flushOpBuffer()
  }, FLUSH_DELAY)
}

export function flushOpBuffer(): Promise<void> {
  if (_opBuffer.length === 0) return Promise.resolve()
  const batch = _opBuffer
  _opBuffer = []
  _flushPromise = db.ops.bulkPut(batch as OpRecord[]).then(() => {
    _flushPromise = null
  })
  return _flushPromise
}

export async function saveOp(op: Op): Promise<void> {
  _opBuffer.push(op)
  _scheduleFlush()
}

export async function saveOps(ops: Op[]): Promise<void> {
  // For bulk saves (init, import), flush any pending buffer first then write directly
  await flushOpBuffer()
  await db.ops.bulkPut(ops as OpRecord[])
}

export async function loadOpsAfter(seqAfter: number): Promise<Op[]> {
  return db.ops.where('seq').above(seqAfter).sortBy('seq')
}

export async function loadAllOps(): Promise<Op[]> {
  return db.ops.orderBy('seq').toArray()
}

export async function getOpCount(): Promise<number> {
  return db.ops.count()
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  await db.snapshots.put(snapshot as SnapshotRecord)
}

export async function loadLatestSnapshot(): Promise<Snapshot | undefined> {
  const all = await db.snapshots.orderBy('seqAfter').reverse().limit(1).toArray()
  return all[0] as Snapshot | undefined
}

export async function clearAll(): Promise<void> {
  await db.ops.clear()
  await db.snapshots.clear()
}

export { db }
