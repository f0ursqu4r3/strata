# Strata Refactor Plan

Streamline and optimize codebase without losing features.

## Critical Priority

- [x] **Decompose `doc.ts` (1,797 → 1,645 lines, -152)**
  - [x] Extract undo/redo logic → `lib/undo-ops.ts` (118 lines)
  - [x] Extract tree-walking utils → `lib/tree-utils.ts` (35 lines)
  - [x] Move export/download logic → `lib/doc-export.ts` (67 lines)
  - [ ] Extract navigation/editing methods → composable or helper
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

- [ ] **Split markdown-serialize.ts**
  - 376 lines combining parse + serialize
  - Separate into `markdown-parse.ts` and `markdown-serialize.ts`

## Medium Priority

- [ ] **Consolidate file-watch handlers in `documents.ts`**
  - `setupTauriFileWatching()` and `setupWebFileWatching()` share 80% logic
  - Extract common handler factory

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
