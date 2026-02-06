export type Status = string

export interface StatusDef {
  id: string
  label: string
  color: string
  icon: string
  final?: boolean
}

export const DEFAULT_STATUSES: StatusDef[] = [
  { id: 'todo',        label: 'Todo',        color: '#94a3b8', icon: 'circle' },
  { id: 'in_progress', label: 'In Progress', color: '#3b82f6', icon: 'circle-dot' },
  { id: 'blocked',     label: 'Blocked',     color: '#ef4444', icon: 'circle-alert' },
  { id: 'done',        label: 'Done',        color: '#22c55e', icon: 'circle-check', final: true },
]

export interface Node {
  id: string
  parentId: string | null
  pos: string
  text: string
  collapsed: boolean
  status: Status
  deleted: boolean
  tags: string[]
  deletedAt?: number
  dueDate?: number | null
}

export interface Op {
  opId: string
  clientId: string
  seq: number
  ts: number
  type: OpType
  payload: OpPayload
}

export type OpType =
  | 'create'
  | 'updateText'
  | 'move'
  | 'setStatus'
  | 'toggleCollapsed'
  | 'tombstone'
  | 'addTag'
  | 'removeTag'
  | 'restore'
  | 'setDueDate'

export type OpPayload =
  | CreatePayload
  | UpdateTextPayload
  | MovePayload
  | SetStatusPayload
  | ToggleCollapsedPayload
  | TombstonePayload
  | AddTagPayload
  | RemoveTagPayload
  | RestorePayload
  | SetDueDatePayload

export interface CreatePayload {
  type: 'create'
  id: string
  parentId: string | null
  pos: string
  text: string
  status: Status
}

export interface UpdateTextPayload {
  type: 'updateText'
  id: string
  text: string
}

export interface MovePayload {
  type: 'move'
  id: string
  parentId: string | null
  pos: string
}

export interface SetStatusPayload {
  type: 'setStatus'
  id: string
  status: Status
}

export interface ToggleCollapsedPayload {
  type: 'toggleCollapsed'
  id: string
}

export interface TombstonePayload {
  type: 'tombstone'
  id: string
}

export interface AddTagPayload {
  type: 'addTag'
  id: string
  tag: string
}

export interface RemoveTagPayload {
  type: 'removeTag'
  id: string
  tag: string
}

export interface RestorePayload {
  type: 'restore'
  id: string
}

export interface SetDueDatePayload {
  type: 'setDueDate'
  id: string
  dueDate: number | null
}

export interface Snapshot {
  id: string
  nodes: Node[]
  rootId: string
  seqAfter: number
  ts: number
}

export type ViewMode = 'outline' | 'board' | 'split'
