import Dexie, { type EntityTable } from 'dexie'
import type { Op, Snapshot, Node, StatusDef } from '@/types'

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

interface MetaRecord {
  key: string
  value: unknown
}

type StrataDB = Dexie & {
  ops: EntityTable<OpRecord, 'opId'>
  snapshots: EntityTable<SnapshotRecord, 'id'>
  meta: EntityTable<MetaRecord, 'key'>
}

// ── Database cache ──
const dbCache = new Map<string, StrataDB>()

function openDocDB(docId: string): StrataDB {
  const cached = dbCache.get(docId)
  if (cached) return cached

  const name = `strata-doc-${docId}`
  const db = new Dexie(name) as StrataDB
  db.version(1).stores({
    ops: 'opId, seq, ts',
    snapshots: 'id, seqAfter',
  })
  db.version(2).stores({
    ops: 'opId, seq, ts',
    snapshots: 'id, seqAfter',
    meta: 'key',
  })
  db.version(3).stores({
    ops: 'opId, seq, ts, payload.id',
    snapshots: 'id, seqAfter',
    meta: 'key',
  })
  dbCache.set(docId, db)
  return db
}

// ── Current document ──
let _currentDocId = ''

export function setCurrentDocId(docId: string): void {
  // Flush pending ops for previous doc before switching
  if (_currentDocId && _currentDocId !== docId) {
    flushOpBuffer()
  }
  _currentDocId = docId
}

function db(): StrataDB {
  if (!_currentDocId) throw new Error('No document selected')
  return openDocDB(_currentDocId)
}

// ── Batched write queue ──
let _opBuffer: Op[] = []
let _flushTimer: ReturnType<typeof setTimeout> | null = null
let _flushPromise: Promise<void> | null = null
let _flushDocId = ''
const FLUSH_DELAY = 50

function _scheduleFlush() {
  if (_flushTimer) return
  _flushDocId = _currentDocId
  _flushTimer = setTimeout(() => {
    _flushTimer = null
    flushOpBuffer()
  }, FLUSH_DELAY)
}

export function flushOpBuffer(): Promise<void> {
  if (_opBuffer.length === 0) return Promise.resolve()
  const batch = _opBuffer
  const docId = _flushDocId || _currentDocId
  _opBuffer = []
  if (!docId) return Promise.resolve()
  const target = openDocDB(docId)
  _flushPromise = target.ops.bulkPut(batch as OpRecord[]).then(() => {
    _flushPromise = null
  })
  return _flushPromise
}

export async function saveOp(op: Op): Promise<void> {
  _opBuffer.push(op)
  _scheduleFlush()
}

export async function saveOps(ops: Op[]): Promise<void> {
  await flushOpBuffer()
  await db().ops.bulkPut(ops as OpRecord[])
}

export async function loadOpsAfter(seqAfter: number): Promise<Op[]> {
  return db().ops.where('seq').above(seqAfter).sortBy('seq')
}

export async function loadAllOps(): Promise<Op[]> {
  return db().ops.orderBy('seq').toArray()
}

export async function loadOpsForNode(nodeId: string): Promise<Op[]> {
  return db().ops.where('payload.id').equals(nodeId).sortBy('seq')
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  await db().snapshots.put(snapshot as SnapshotRecord)
}

export async function loadLatestSnapshot(): Promise<Snapshot | undefined> {
  const all = await db().snapshots.orderBy('seqAfter').reverse().limit(1).toArray()
  return all[0] as Snapshot | undefined
}

export async function loadStatusConfig(): Promise<StatusDef[] | null> {
  const row = await db().meta.get('statusConfig')
  if (!row || !Array.isArray(row.value)) return null
  return row.value as StatusDef[]
}

export async function saveStatusConfig(statuses: StatusDef[]): Promise<void> {
  await db().meta.put({ key: 'statusConfig', value: statuses })
}

export async function loadTagColors(): Promise<Record<string, string> | null> {
  const row = await db().meta.get('tagColors')
  if (!row || typeof row.value !== 'object') return null
  return row.value as Record<string, string>
}

export async function saveTagColors(colors: Record<string, string>): Promise<void> {
  await db().meta.put({ key: 'tagColors', value: colors })
}

export async function clearAll(): Promise<void> {
  await db().ops.clear()
  await db().snapshots.clear()
}

export async function deleteDocDB(docId: string): Promise<void> {
  const cached = dbCache.get(docId)
  if (cached) {
    cached.close()
    dbCache.delete(docId)
  }
  await Dexie.delete(`strata-doc-${docId}`)
}

// ── Migration: move old single "strata" DB to new per-doc format ──
export async function migrateOldDB(): Promise<string | null> {
  // Check if old "strata" database exists
  if (!await Dexie.exists('strata')) return null

  const oldDb = new Dexie('strata') as StrataDB
  oldDb.version(1).stores({
    ops: 'opId, seq, ts',
    snapshots: 'id, seqAfter',
  })

  const opCount = await oldDb.ops.count()
  if (opCount === 0) {
    oldDb.close()
    await Dexie.delete('strata')
    return null
  }

  // Create a new document ID and copy data
  const newDocId = crypto.randomUUID()
  const newDb = openDocDB(newDocId)

  const allOps = await oldDb.ops.toArray()
  const allSnapshots = await oldDb.snapshots.toArray()

  if (allOps.length > 0) {
    await newDb.ops.bulkPut(allOps)
  }
  if (allSnapshots.length > 0) {
    await newDb.snapshots.bulkPut(allSnapshots)
  }

  oldDb.close()
  await Dexie.delete('strata')

  return newDocId
}
