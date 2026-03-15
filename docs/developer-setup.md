# Developer Setup

## Prerequisites

- **Node.js** `^20.19.0` or `>=22.12.0`
- **Bun** (recommended) or npm

## Tech Stack

| Tool              | Version |
| ----------------- | ------- |
| Vue               | 3.5     |
| TypeScript        | 5.9     |
| Vite              | 7.3     |
| Tailwind CSS      | 4.1     |
| Pinia             | 3.0     |
| Dexie (IndexedDB) | 4.3     |
| Vitest            | 4.0     |
| Lucide Icons      | 0.563   |
| markdown-it       | 14.1    |
| Splitpanes        | 4.0     |
| Tauri             | 2.10    |

## Getting Started

```bash
# Install dependencies
bun install

# Start dev server (http://localhost:5173)
bun run dev

# Start Tauri desktop app
bun run tauri:dev
```

## Scripts

| Command               | Description                        |
| --------------------- | ---------------------------------- |
| `bun run dev`         | Start development server           |
| `bun run build`       | Type-check and production build    |
| `bun run build-only`  | Production build (skip type-check) |
| `bun run build:web`   | Web build with base path           |
| `bun run preview`     | Preview production build           |
| `bun run type-check`  | Run `vue-tsc --build`              |
| `bun run test:unit`   | Run unit tests (Vitest)            |
| `bun run lint`        | Run all linters (oxlint + eslint)  |
| `bun run format`      | Format source with oxfmt           |
| `bun run tauri:dev`   | Start Tauri desktop dev            |
| `bun run tauri:build` | Build Tauri desktop app            |

All scripts work with `npm run` as well.

## Project Structure

```text
src/
├── __tests__/              # Unit tests (Vitest + jsdom)
│   ├── due-date.spec.ts
│   ├── export-formats.spec.ts
│   ├── inbox.spec.ts
│   ├── inline-markdown.spec.ts
│   ├── markdown-parse.spec.ts
│   ├── markdown-serialize.spec.ts
│   ├── ops.spec.ts
│   ├── rank.spec.ts
│   ├── search-index.spec.ts
│   ├── shortcuts.spec.ts
│   └── view-state.spec.ts
├── components/
│   ├── board/              # Kanban board
│   │   ├── KanbanBoard.vue
│   │   └── ColumnContextMenu.vue
│   ├── outline/            # Outline tree
│   │   ├── OutlineView.vue
│   │   ├── OutlineRow.vue
│   │   └── NodeHistory.vue
│   ├── overlays/           # Modals & floating panels
│   │   ├── CommandPalette.vue
│   │   ├── ExportMenu.vue
│   │   ├── GlobalSearch.vue
│   │   ├── TrashPanel.vue
│   │   └── WorkspacePicker.vue
│   ├── settings/           # Settings UIs
│   │   ├── SettingsPanel.vue         # Global settings (theme, font, display)
│   │   ├── DocumentSettingsPanel.vue # Per-doc settings (statuses, tag colors)
│   │   ├── ShortcutsModal.vue
│   │   ├── ShortcutEditor.vue
│   │   └── StatusEditor.vue
│   ├── shared/             # Reusable components
│   │   ├── BaseContextMenu.vue
│   │   ├── ContextMenu.vue
│   │   ├── TagPicker.vue
│   │   └── DatePicker.vue
│   ├── sidebar/            # Document browser
│   │   ├── DocumentSidebar.vue
│   │   ├── DocumentContextMenu.vue
│   │   ├── FolderContextMenu.vue
│   │   └── FolderTreeItem.vue
│   └── ui/                 # Generic UI primitives
│       ├── UiButton.vue, UiIconButton.vue, UiToggle.vue, UiModal.vue, ...
│       └── index.ts
├── composables/
│   ├── board/              # Board-specific logic
│   │   ├── useBoardDrag.ts
│   │   └── useBoardEditing.ts
│   ├── outline/            # Outline-specific logic
│   │   ├── useDragReorder.ts
│   │   ├── useFileDrop.ts
│   │   ├── useRowEditing.ts
│   │   ├── useVimMode.ts
│   │   └── useVirtualScroll.ts
│   ├── overlays/
│   │   ├── useCommandPalette.ts
│   │   └── useGlobalSearch.ts
│   ├── settings/
│   │   ├── useShortcutCapture.ts
│   │   └── useStatusCrud.ts
│   ├── sidebar/
│   │   └── useDocumentRename.ts
│   ├── useAppInit.ts       # App initialization
│   ├── useClickOutside.ts
│   ├── useDropdownPosition.ts
│   ├── useEscapeKey.ts
│   ├── useGlobalKeyboard.ts  # Global keyboard handler (Cmd+W, Cmd+N, etc.)
│   ├── useMenuPosition.ts    # Viewport-aware context menu positioning
│   ├── usePickerClickOutside.ts
│   └── useReducedMotion.ts
├── data/
│   └── theme-registry.ts   # Theme definitions (11 themes)
├── lib/
│   ├── constants.ts         # App-wide constants
│   ├── doc-export.ts        # Document export helpers
│   ├── doc-registry.ts      # Document registry helpers
│   ├── due-date.ts          # Due date helpers
│   ├── export-formats.ts   # Export to MD/OPML/TXT
│   ├── folder-tree.ts      # Folder tree for sidebar
│   ├── fs.ts               # Unified filesystem adapter
│   ├── idb.ts              # IndexedDB persistence (Dexie)
│   ├── import-formats.ts   # Import from MD/OPML/TXT
│   ├── inbox.ts            # Scratch Pad (quick capture) utilities
│   ├── inline-markdown.ts  # Markdown rendering
│   ├── markdown-parse.ts   # Parse .md files into nodes
│   ├── markdown-serialize.ts # Serialize nodes to .md with frontmatter
│   ├── menu-handler.ts     # Tauri native menu handler
│   ├── migrate-to-files.ts # IDB → filesystem migration
│   ├── ops.ts              # Op-log: create, apply, rebuild
│   ├── platform.ts         # Platform detection (Tauri/web/FS)
│   ├── rank.ts             # LexoRank-style ordering
│   ├── reconcile.ts        # External file change reconciliation
│   ├── search-index.ts     # Cross-document search index
│   ├── shortcuts.ts        # Keyboard shortcut definitions
│   ├── status-icons.ts     # Status icon resolver
│   ├── tag-colors.ts       # Per-tag color presets and helpers
│   ├── tauri-fs.ts         # Tauri filesystem operations
│   ├── text-utils.ts       # Title/body text helpers
│   ├── tree-utils.ts       # Tree traversal utilities
│   ├── undo-ops.ts         # Undo/redo operation helpers
│   ├── view-state.ts       # Per-document view state (collapsed, zoom)
│   └── web-fs.ts           # File System Access API adapter
├── stores/
│   ├── doc.ts              # Main document store (nodes, ops, undo)
│   ├── doc-nav.ts          # Document navigation state
│   ├── doc-sync.ts         # Document synchronization
│   ├── doc-view.ts         # View state management
│   ├── documents.ts        # Multi-document management
│   └── settings.ts         # User preferences (localStorage)
├── styles/
│   ├── main.css            # Global styles
│   ├── themes.css          # Theme CSS variables
│   └── transitions.css     # FLIP animations and transitions
├── types/
│   └── index.ts            # TypeScript interfaces
├── capture.ts              # Quick capture window entry point (Tauri)
├── capture.css             # Quick capture window styles
├── App.vue                 # Root component
└── main.ts                 # Entry point
```

## Architecture

### Data Model

Strata uses an **op-log** (event sourcing) architecture:

- Every change is recorded as an `Op` (operation) with a sequence number.
- State is rebuilt by replaying ops over a periodic snapshot.
- Undo/redo works by storing before-snapshots and applying compensating ops.
- Text edits are debounced (300ms) to batch rapid keystrokes into single ops.

### Persistence

Strata supports three storage modes:

- **Tauri (desktop)**: Documents are `.md` files on disk with YAML frontmatter. Strata watches the workspace folder for external changes via the `notify` crate. Supports single-file mode (open one `.md` file directly) and folder mode (open a workspace directory).
- **Web FS (Chromium)**: Uses the File System Access API to read/write `.md` files in a user-selected folder. Same file format as Tauri.
- **Web IDB (fallback)**: Each document is stored in its own **IndexedDB** database via Dexie. Three tables per database: `ops` (operation log), `meta` (snapshots, custom statuses, tag colors), `nodes` (latest state).

In all modes, user settings and the document list are stored in **localStorage**. A cross-document search index is also maintained in localStorage. Per-document view state (collapsed nodes, zoom level) is stored in localStorage via `view-state.ts`, not in the document files.

### Reactivity

- Node state is a `Map<string, Node>` held in a Pinia store using `shallowRef` + `triggerRef` for performance.
- Computed properties derive visible rows, kanban columns, tag lists, and search results.
- The outline uses virtual scrolling (recycled DOM) for documents with 100+ nodes.

### Ordering

Sibling order uses a **LexoRank-lite** string scheme (`rankBefore`, `rankBetween`, `rankAfter`). This allows inserting between any two items without renumbering.

### Window Management (Tauri)

The desktop app supports multi-window operation:

- **New Window** opens a separate window to the same workspace.
- **Scratch Pad** (Cmd+Shift+S) opens a dedicated quick-capture window backed by IndexedDB, even in filesystem mode.
- **Quick Capture** (Ctrl+Shift+Space) opens a minimal capture overlay for rapid item entry with status selection.

## Configuration

### TypeScript

Three tsconfig files referenced from `tsconfig.json`:

- `tsconfig.app.json` — App source (extends `@vue/tsconfig/tsconfig.dom.json`)
- `tsconfig.node.json` — Build tooling (extends `@tsconfig/node24`)
- `tsconfig.vitest.json` — Tests (extends app config, adds `jsdom` types)

Path alias: `@/` → `src/`

### Vite

Plugins: Vue, Vue DevTools, Tailwind CSS v4.

### Linting

- **oxlint** — Fast linter (correctness rules as errors)
- **ESLint** — Vue + TypeScript rules, flat config format
- **oxfmt** — Formatter (no semicolons, single quotes)
- Config files: `eslint.config.ts`, `.oxlintrc.json`, `.oxfmtrc.json`, `.editorconfig`

## Testing

Tests live in `src/__tests__/` and run with Vitest + jsdom.

```bash
# Run all tests
bun run test:unit

# Run in watch mode
bunx vitest
```

Test coverage includes: op-log operations, ranking utilities, due-date helpers, export formats, inline markdown rendering, markdown parse/serialize round-tripping, search indexing, keyboard shortcuts, view state persistence, and Scratch Pad (inbox) utilities.

## Building

```bash
# Full build (type-check + vite build)
bun run build

# Output goes to dist/
```

The build produces a static site (single `index.html` + JS/CSS bundles). No server required — open `dist/index.html` directly or serve with any static file server.

For the Tauri desktop app:

```bash
bun run tauri:build
```
