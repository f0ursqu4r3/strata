# Developer Setup

## Prerequisites

- **Node.js** `^20.19.0` or `>=22.12.0`
- **Bun** (recommended) or npm

## Tech Stack

| Tool | Version |
|---|---|
| Vue | 3.5 |
| TypeScript | 5.9 |
| Vite | 7.3 |
| Tailwind CSS | 4.1 |
| Pinia | 3.0 |
| Dexie (IndexedDB) | 4.3 |
| Vitest | 4.0 |
| Lucide Icons | 0.563 |
| markdown-it | 14.1 |
| Splitpanes | 4.0 |

## Getting Started

```bash
# Install dependencies
bun install

# Start dev server (http://localhost:5173)
bun run dev
```

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start development server |
| `bun run build` | Type-check and production build |
| `bun run build-only` | Production build (skip type-check) |
| `bun run preview` | Preview production build |
| `bun run type-check` | Run `vue-tsc --build` |
| `bun run test:unit` | Run unit tests (Vitest) |
| `bun run lint` | Run all linters (oxlint + eslint) |
| `bun run format` | Format source with oxfmt |

All scripts work with `npm run` as well.

## Project Structure

```
src/
├── __tests__/              # Unit tests (Vitest + jsdom)
│   ├── ops.spec.ts
│   └── rank.spec.ts
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
│   │   ├── ContextMenu.vue
│   │   ├── TagPicker.vue
│   │   └── DatePicker.vue
│   ├── sidebar/            # Document browser
│   │   ├── DocumentSidebar.vue
│   │   └── DocumentContextMenu.vue
│   └── ui/                 # Generic UI primitives
│       ├── UiButton.vue, UiToggle.vue, UiModal.vue, ...
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
│   ├── useClickOutside.ts
│   ├── useEscapeKey.ts
│   └── useMenuPosition.ts  # Viewport-aware context menu positioning
├── data/
│   └── theme-registry.ts   # Theme definitions (11 themes)
├── lib/
│   ├── ops.ts              # Op-log: create, apply, rebuild
│   ├── rank.ts             # LexoRank-style ordering
│   ├── shortcuts.ts        # Keyboard shortcut definitions
│   ├── search-index.ts     # Cross-document search index
│   ├── due-date.ts         # Due date helpers
│   ├── inline-markdown.ts  # Markdown rendering
│   ├── export-formats.ts   # Export to MD/OPML/TXT
│   ├── import-formats.ts   # Import from MD/OPML/TXT/JSON
│   ├── markdown-serialize.ts # .md file read/write with frontmatter
│   ├── tag-colors.ts       # Per-tag color presets and helpers
│   ├── text-utils.ts       # Title/body text helpers
│   ├── status-icons.ts     # Status icon resolver
│   ├── doc-registry.ts     # Document registry helpers
│   ├── platform.ts         # Platform detection (Tauri/web/FS)
│   ├── fs.ts               # Unified filesystem adapter
│   ├── tauri-fs.ts         # Tauri filesystem operations
│   ├── web-fs.ts           # File System Access API adapter
│   ├── idb.ts              # IndexedDB persistence (Dexie)
│   ├── menu-handler.ts     # Tauri native menu handler
│   └── migrate-to-files.ts # IDB → filesystem migration
├── stores/
│   ├── doc.ts              # Main document store (nodes, ops, undo)
│   ├── documents.ts        # Multi-document management
│   └── settings.ts         # User preferences (localStorage)
├── types/
│   └── index.ts            # TypeScript interfaces
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

- **Tauri (desktop)**: Documents are `.md` files on disk with YAML frontmatter. Strata watches the workspace folder for external changes via the `notify` crate.
- **Web FS (Chromium)**: Uses the File System Access API to read/write `.md` files in a user-selected folder. Same file format as Tauri.
- **Web IDB (fallback)**: Each document is stored in its own **IndexedDB** database via Dexie. Three tables per database: `ops` (operation log), `meta` (snapshots, custom statuses, tag colors), `nodes` (latest state).

In all modes, user settings and the document list are stored in **localStorage**. A cross-document search index is also maintained in localStorage.

### Reactivity

- Node state is a `Map<string, Node>` held in a Pinia store using `shallowRef` + `triggerRef` for performance.
- Computed properties derive visible rows, kanban columns, tag lists, and search results.
- The outline uses virtual scrolling (recycled DOM) for documents with 100+ nodes.

### Ordering

Sibling order uses a **LexoRank-lite** string scheme (`rankBefore`, `rankBetween`, `rankAfter`). This allows inserting between any two items without renumbering.

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

Current test coverage: op-log operations and ranking utilities.

## Building

```bash
# Full build (type-check + vite build)
bun run build

# Output goes to dist/
```

The build produces a static site (single `index.html` + JS/CSS bundles). No server required — open `dist/index.html` directly or serve with any static file server.
