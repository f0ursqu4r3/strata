# Strata

A WorkFlowy-style outline + Kanban projection mashup. Single-user, offline-first.

## Quick start

```bash
bun install
bun run dev
```

Open http://localhost:5173

## Keybindings (Outline panel)

| Key | Action |
|---|---|
| **Up / Down** | Move selection |
| **Enter** | Edit selected node (while editing: commit + create sibling below) |
| **Tab** | Indent (make child of previous sibling) |
| **Shift+Tab** | Outdent (move to grandparent level) |
| **Delete / Backspace** | Delete selected node |
| **Space** | Toggle collapse (on nodes with children) |
| **Escape** | Stop editing |
| **Double-click** | Start editing |

## Architecture

### One tree, two views

All data lives in a single tree of `Node` objects. The **Outline** view renders this tree directly. The **Kanban** board is a *projection*: it groups the same nodes by their `status` field. Dragging a card between columns emits a `setStatus` op — it changes the node's status without reparenting it in the tree.

### Op-log design

Every mutation goes through an append-only operation log:

```
Op { opId, clientId, seq, ts, type, payload }
```

Types: `create`, `updateText`, `move`, `setStatus`, `toggleCollapsed`, `tombstone`

State is derived by replaying ops over an optional snapshot. This design enables:

- **Undo/redo** (walk ops backward)
- **Multi-device sync** (exchange op logs between clients)
- **Conflict resolution** (ops are commutative for most cases; last-writer-wins on same field)

Snapshots are taken every 200 ops to bound replay time on load.

### Rank keys (LexoRank-lite)

Sibling ordering uses lexicographically sortable strings instead of integer indices. `rankBetween(a, b)` produces a key that sorts between `a` and `b` without rewriting any other sibling's position. This makes reordering O(1) ops instead of O(n).

### Persistence

All ops and snapshots are persisted to IndexedDB via [Dexie](https://dexie.org/). The app loads by:

1. Finding the latest snapshot
2. Replaying any ops with `seq > snapshot.seqAfter`
3. Building the in-memory `Map<string, Node>`

### Why no hard deletes?

Nodes are tombstoned (`deleted: true`) rather than removed. This is required for:

- Sync: a delete op must be distinguishable from "never existed"
- Undo: restoring a deleted subtree
- Conflict resolution: concurrent edits to a deleted node resolve cleanly

## File tree

```
src/
  types/index.ts      -- Node, Op, Status, ViewMode types
  lib/
    rank.ts            -- LexoRank-lite position key generation
    ops.ts             -- Op creation, application, state rebuild
    idb.ts             -- Dexie wrapper for IndexedDB persistence
  stores/
    doc.ts             -- Pinia store: state, computed views, actions
  components/
    OutlineView.vue    -- Outline container with keyboard handling
    OutlineRow.vue     -- Single outline row (display + inline edit)
    KanbanBoard.vue    -- Kanban columns with drag-and-drop
  App.vue              -- Shell layout, view mode toggle
  main.ts              -- App entry point
```

## Limitations / future work

- No undo/redo yet (op log makes this straightforward to add)
- No search (placeholder in top bar)
- No drag reordering in outline (keyboard indent/outdent only)
- No virtualized rendering (fine up to ~2-3k visible nodes)
- No multi-device sync (op-log structure is ready for it)
