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

export async function saveOp(op: Op): Promise<void> {
  await db.ops.put(op as OpRecord)
}

export async function saveOps(ops: Op[]): Promise<void> {
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
