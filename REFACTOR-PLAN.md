# Strata Refactor Plan

Streamline and optimize codebase without losing features.

## Critical Priority

- [x] **Decompose `doc.ts` (1,797 → 1,528 lines, -269)**
  - [x] Extract undo/redo logic → `lib/undo-ops.ts` (118 lines)
  - [x] Extract tree-walking utils → `lib/tree-utils.ts` (35 lines)
  - [x] Move export/download logic → `lib/doc-export.ts` (67 lines)
  - [x] Extract `reconcileParsed` → `lib/reconcile.ts` (126 lines)
  - [ ] Group scattered refs into state objects (editing, filters, selection)

- [x] **Deduplicate `getOrderedChildren()`**
  - Was identical in `markdown-serialize.ts` and `export-formats.ts`
  - Now shared from `lib/tree-utils.ts`

- [x] **Deduplicate tree-walking patterns**
  - 3 filter computeds in `doc.ts` now use shared `markAncestors()` from `lib/tree-utils.ts`

## High Priority

- [x] **Shared context menu base component**
  - Created `BaseContextMenu.vue` wrapping Teleport + positioning + click-outside + styling
  - Refactored `ContextMenu.vue`, `DocumentContextMenu.vue`, `ColumnContextMenu.vue`

- [x] **`useDropdownPosition` composable**
  - Extracted to `composables/useDropdownPosition.ts`
  - `TagPicker.vue` refactored to use it for both autocomplete and color picker popovers

- [x] **Split `markdown-serialize.ts` (376 → 132 + 242)**
  - `markdown-serialize.ts` — serialize only (132 lines)
  - `markdown-parse.ts` — parse + frontmatter helpers (242 lines)
  - Backward-compatible re-export keeps all existing imports working

## Medium Priority

- [x] **Consolidate file-watch handlers in `documents.ts` (355 → 328, -27)**
  - Extracted shared `onFileCreated`, `onFileDeleted`, `onFileModified` handlers
  - Tauri and Web setup functions now just wire up events

- [ ] **Create CSS utility classes**
  - Menu styling repeated 15+ times
  - Button hover pattern repeated 20+ times
  - Codify into reusable classes

- [ ] **Optimize IDB queries in `idb.ts`**
  - `loadOpsForNode()` fetches entire op log then filters
  - Add IDB index on `payload.id`

## Low Priority

- [x] **Remove unused `vue-router` dependency**
- [ ] **Audit legacy migration code** (`migrate-to-files.ts`)
- [ ] **Formalize web-fs/tauri-fs interface** with shared TypeScript interface
