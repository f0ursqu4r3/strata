# Strata

Your outline is the truth. Everything else is a projection.

A keyboard-first outliner with kanban, due dates, tags, and plain-text markdown files you actually own.

[Download](https://github.com/f0ursqu4r3/strata/releases/latest) &middot; [Website](https://f0ursqu4r3.github.io/strata/)

---

## What is Strata?

Strata is a desktop app for managing tasks and notes as a single nested outline. The outline can be viewed as a tree (like WorkFlowy) or projected into a kanban board grouped by status. Both views operate on the same data — changes in one are instantly reflected in the other.

Documents are plain `.md` files with YAML frontmatter. Edit them in any text editor, grep them from the terminal, version them with git.

```markdown
---
doc-type: strata
---

- Ship v1.0  #release
  - Fix auth token refresh  !status(Done)  #api
  - Write migration guide  !status(In Progress)  @due(2025-02-14)
  - Update changelog
  - Tag release on GitHub  !status(Blocked)
- Backlog
  - Dark mode improvements  #ui
  - Search performance  #perf
```

## Features

### Views

- Outline tree with infinite nesting, collapse/expand, and zoom
- Kanban board grouped by status with drag-and-drop between columns
- Split view showing both simultaneously

### Organization

- Statuses — Todo, In Progress, Blocked, Done (customizable per document)
- Tags — filter outline and board by tag
- Due dates — filter by overdue, today, or this week
- Full-text search across current document or all documents

### Editing

- Keyboard-driven — navigate, indent/outdent, change status, all from the keyboard
- Customizable shortcuts
- Undo/redo with full operation history
- Duplicate, delete, restore from trash

### Files

- Plain markdown — human-readable, no proprietary formats
- Recursive file discovery — point at a folder, Strata finds all `.md` files with `doc-type: strata`
- File watcher — external edits are picked up automatically

### Export

- JSON, Markdown, OPML, Plain Text
- Exports respect current zoom level

### Themes

- Light and dark modes
- 13 built-in themes including GitHub, Nord, Dracula, Solarized, Catppuccin, Tokyo Night
- Adjustable font size

## Keybindings

| Key                   | Action                                                            |
| --------------------- | ----------------------------------------------------------------- |
| Up / Down             | Move selection                                                    |
| Enter                 | Edit selected node (while editing: commit + create sibling below) |
| Tab                   | Indent (make child of previous sibling)                           |
| Shift+Tab             | Outdent (move to grandparent level)                               |
| Delete / Backspace    | Delete selected node                                              |
| Space                 | Toggle collapse                                                   |
| Escape                | Stop editing                                                      |
| Ctrl+1..9             | Set status (by position in status list)                           |
| Ctrl+Z / Ctrl+Shift+Z | Undo / Redo                                                       |
| Ctrl+Shift+F          | Global search                                                     |
| Double-click          | Start editing / Create new node (empty area)                      |

All shortcuts are customizable in Settings.

## Architecture

### One tree, two views

All data lives in a single tree of `Node` objects. The **Outline** view renders this tree directly. The **Kanban** board is a *projection*: it groups the same nodes by their `status` field. Dragging a card between columns changes the node's status without reparenting it in the tree.

### Op-log design

Every mutation goes through an append-only operation log. State is derived by replaying ops over an optional snapshot. This enables:

- **Undo/redo** — walk ops backward with compensating operations
- **Future sync** — exchange op logs between clients
- **Conflict resolution** — ops are commutative for most cases; last-writer-wins on same field

Snapshots are taken every 200 ops to bound replay time on load.

### Rank keys (LexoRank-lite)

Sibling ordering uses lexicographically sortable strings instead of integer indices. `rankBetween(a, b)` produces a key that sorts between `a` and `b` without rewriting any other sibling's position. This makes reordering O(1) ops instead of O(n).

### Persistence

**Desktop (Tauri):** Documents are `.md` files on disk. The workspace folder is watched for changes. Strata recursively discovers any `.md` file with `doc-type: strata` frontmatter.

**Browser fallback:** Ops and snapshots are persisted to IndexedDB via Dexie.

## Tech Stack

- [Tauri 2](https://v2.tauri.app/) — Rust backend, native webview
- [Vue 3](https://vuejs.org/) + [Pinia](https://pinia.vuejs.org/) — frontend
- [Tailwind CSS 4](https://tailwindcss.com/) — styling
- [Vite](https://vite.dev/) — build tooling

## Development

Prerequisites: [Rust](https://rustup.rs/), [Bun](https://bun.sh/), and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform.

```sh
bun install
bun run tauri:dev
```

Build for production:

```sh
bun run tauri:build
```

Run tests:

```sh
bunx vitest run
```

## License

MIT
