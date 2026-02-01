export type Status = 'todo' | 'in_progress' | 'blocked' | 'done'

export interface Node {
  id: string
  parentId: string | null
  pos: string
  text: string
  collapsed: boolean
  status: Status
  deleted: boolean
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

export type OpPayload =
  | CreatePayload
  | UpdateTextPayload
  | MovePayload
  | SetStatusPayload
  | ToggleCollapsedPayload
  | TombstonePayload

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

export interface Snapshot {
  id: string
  nodes: Node[]
  rootId: string
  seqAfter: number
  ts: number
}

export type ViewMode = 'outline' | 'board' | 'split'
