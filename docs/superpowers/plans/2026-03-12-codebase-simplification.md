# Codebase Simplification & Separation of Concerns

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize magic numbers, deduplicate shared patterns, decompose oversized files, and establish clear separation of concerns across the Strata codebase.

**Architecture:** Extract a constants module for all magic numbers. Deduplicate click-outside, popover positioning, and drag initialization patterns into shared composables. Split the 1,532-line doc store into focused sub-modules (core ops, view computation, file sync, navigation). Extract App.vue initialization and keyboard handling into composables.

**Tech Stack:** Vue 3 + TypeScript + Pinia, Vitest for tests, Bun for tooling.

---

## Chunk 1: Constants & Deduplication

### Task 1: Create centralized constants module

**Files:**
- Create: `src/lib/constants.ts`

- [ ] **Step 1: Create the constants file**

```typescript
// src/lib/constants.ts

// ── Timing ──────────────────────────────────────────────
export const SNAPSHOT_INTERVAL = 200        // ops before auto-snapshot
export const FILE_SAVE_DELAY = 1000         // ms debounce before writing to disk
export const WRITE_COOLDOWN = 2000          // ms minimum between file writes
export const IDB_FLUSH_DELAY = 50           // ms to batch IndexedDB ops
export const INDEX_UPDATE_DELAY = 500       // ms debounce for search index rebuild
export const TEXT_DEBOUNCE_DELAY = 300      // ms debounce for text edits
export const SEARCH_DEBOUNCE_DELAY = 200    // ms debounce for search input
export const VIM_PENDING_TIMEOUT = 500      // ms before vim pending key resets
export const TAG_PICKER_HIDE_DELAY = 150    // ms delay before hiding tag picker
export const FILE_POLL_INTERVAL = 5000      // ms between file polls (web-fs)
export const FILE_POLL_INTERVAL_FAST = 2000 // ms between file polls (single-file)

// ── Undo ────────────────────────────────────────────────
export const MAX_UNDO = 200

// ── Layout ──────────────────────────────────────────────
export const ROW_HEIGHT = 32                // px per outline row
export const VIRTUAL_SCROLL_BUFFER = 10     // extra rows above/below viewport
export const VIRTUAL_SCROLL_THRESHOLD = 100 // min rows before virtualization kicks in

// ── Drag & Drop ─────────────────────────────────────────
export const DRAG_THRESHOLD = 5             // px movement before drag starts
export const DROP_ZONE_BEFORE = 0.25        // top 25% = insert before
export const DROP_ZONE_AFTER = 0.75         // bottom 25% = insert after (middle = into)
export const OVERLAY_Z_INDEX = '9999'
export const DRAG_SCALE = 'scale(1.02)'
export const DRAG_SHADOW_CARD = '0 8px 24px rgba(0,0,0,0.18)'
export const DRAG_SHADOW_ROW = '0 4px 16px rgba(0,0,0,0.15)'
export const DRAG_OPACITY = '0.9'
export const DRAG_BORDER_RADIUS = '4px'
export const DRAG_TRANSITION = 'box-shadow 0.15s, transform 0.15s'

// ── Popover / Dropdown ──────────────────────────────────
export const POPOVER_PADDING = 8            // px from viewport edge
export const POPOVER_OFFSET = 4             // px gap between trigger and popover
export const POPOVER_MIN_EDGE = 4           // px minimum from any viewport edge
export const DEFAULT_DROPDOWN_HEIGHT = 256  // px estimated dropdown height
export const SUBMENU_WIDTH_THRESHOLD = 160  // px remaining space to flip submenu

// ── Outline ─────────────────────────────────────────────
export const OUTLINE_DEPTH_INDENT = 24      // px per depth level
export const OUTLINE_BASE_PADDING = 8       // px left padding at depth 0

// ── Sidebar ─────────────────────────────────────────────
export const SIDEBAR_DEPTH_INDENT = 16      // px per depth level
export const SIDEBAR_BASE_PADDING = 12      // px left padding at depth 0

// ── Tags ────────────────────────────────────────────────
export const MAX_TAG_SUGGESTIONS = 8
export const TAG_ITEM_HEIGHT = 30           // px per suggestion item
export const TAG_DROPDOWN_PADDING = 4       // px padding in dropdown
```

- [ ] **Step 2: Verify it compiles**

Run: `bunx vue-tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add centralized constants module"
```

---

### Task 2: Wire constants into stores/doc.ts

**Files:**
- Modify: `src/stores/doc.ts`

- [ ] **Step 1: Replace inline constants in doc.ts with imports**

Add import at top of `src/stores/doc.ts`:
```typescript
import {
  SNAPSHOT_INTERVAL,
  FILE_SAVE_DELAY,
  WRITE_COOLDOWN,
  INDEX_UPDATE_DELAY,
  TEXT_DEBOUNCE_DELAY,
  MAX_UNDO,
} from '@/lib/constants'
```

Replace these occurrences:
- Line 35: `const SNAPSHOT_INTERVAL = 200` → remove (use import)
- Line 78: `const FILE_SAVE_DELAY = 1000` → remove (use import)
- Line 79: `const WRITE_COOLDOWN = 2000` → remove (use import)
- Line 153: `const MAX_UNDO = 200` → remove (use import)
- Any `300` used for text debounce → `TEXT_DEBOUNCE_DELAY`
- Any `500` used for index timer → `INDEX_UPDATE_DELAY`

- [ ] **Step 2: Verify type-check passes**

Run: `bunx vue-tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run existing tests**

Run: `bun test`
Expected: All tests pass (ops, rank, markdown, etc.)

- [ ] **Step 4: Commit**

```bash
git add src/stores/doc.ts
git commit -m "refactor: use centralized constants in doc store"
```

---

### Task 3: Wire constants into composables and components

**Files:**
- Modify: `src/composables/outline/useVirtualScroll.ts`
- Modify: `src/composables/outline/useDragReorder.ts`
- Modify: `src/composables/board/useBoardDrag.ts`
- Modify: `src/composables/board/useBoardEditing.ts`
- Modify: `src/composables/useMenuPosition.ts`
- Modify: `src/composables/useDropdownPosition.ts`
- Modify: `src/composables/outline/useVimMode.ts`
- Modify: `src/composables/overlays/useGlobalSearch.ts`
- Modify: `src/components/shared/ContextMenu.vue`
- Modify: `src/components/shared/TagPicker.vue`
- Modify: `src/components/outline/OutlineRow.vue`
- Modify: `src/components/sidebar/FolderTreeItem.vue`
- Modify: `src/components/settings/DocumentSettingsPanel.vue`
- Modify: `src/lib/idb.ts`
- Modify: `src/lib/web-fs.ts`

- [ ] **Step 1: Replace constants in virtual scroll**

In `src/composables/outline/useVirtualScroll.ts`, replace:
```typescript
const ROW_HEIGHT = 32
const BUFFER = 10
const VIRTUAL_THRESHOLD = 100
```
With import from `@/lib/constants`:
```typescript
import { ROW_HEIGHT, VIRTUAL_SCROLL_BUFFER, VIRTUAL_SCROLL_THRESHOLD } from '@/lib/constants'
```
Update all references: `BUFFER` → `VIRTUAL_SCROLL_BUFFER`, `VIRTUAL_THRESHOLD` → `VIRTUAL_SCROLL_THRESHOLD`.

**Note:** `useVirtualScroll.ts` currently exports `ROW_HEIGHT` (used by `OutlineView.vue`). After removing the local constant, add a re-export: `export { ROW_HEIGHT } from '@/lib/constants'` — or update `OutlineView.vue` to import directly from `@/lib/constants`.

- [ ] **Step 2: Replace constants in drag composables**

In `src/composables/outline/useDragReorder.ts`, replace:
```typescript
const DRAG_THRESHOLD = 5
```
With import. Also replace inline magic numbers:
- `h * 0.25` → `h * DROP_ZONE_BEFORE`
- `h * 0.75` → `h * DROP_ZONE_AFTER`
- `'0.9'` opacity → `DRAG_OPACITY`
- `'0 4px 16px rgba(0,0,0,0.15)'` → `DRAG_SHADOW_ROW`
- `'4px'` border-radius → `DRAG_BORDER_RADIUS`
- `'9999'` z-index → `OVERLAY_Z_INDEX`

In `src/composables/board/useBoardDrag.ts`, replace:
```typescript
const DRAG_THRESHOLD = 5
```
With import. Also replace:
- `'9999'` z-index → `OVERLAY_Z_INDEX`
- `'0 8px 24px rgba(0,0,0,0.18)'` → `DRAG_SHADOW_CARD`
- `'scale(1.02)'` → `DRAG_SCALE`
- `'box-shadow 0.15s, transform 0.15s'` → `DRAG_TRANSITION`

- [ ] **Step 3: Replace constants in positioning composables**

In `src/composables/useMenuPosition.ts`:
- Replace `const PADDING = 8` with import of `POPOVER_PADDING`

In `src/composables/useDropdownPosition.ts`:
- Replace `256` → `DEFAULT_DROPDOWN_HEIGHT`
- Replace `8` (spacing) → `POPOVER_PADDING`
- Replace `4` (offset/gap) → `POPOVER_OFFSET` and `POPOVER_MIN_EDGE`

In `src/composables/board/useBoardEditing.ts`:
- Replace `120`, `220` popover dimensions with named constants or computed from trigger
- Replace `4` and `8` spacing values → `POPOVER_OFFSET`, `POPOVER_PADDING`

- [ ] **Step 4: Replace constants in components**

In `src/components/shared/ContextMenu.vue`:
- Replace `160` → `SUBMENU_WIDTH_THRESHOLD`

In `src/components/shared/TagPicker.vue`:
- Replace `8` (max suggestions) → `MAX_TAG_SUGGESTIONS`
- Replace `30` (item height) → `TAG_ITEM_HEIGHT`
- Replace `4` (padding) → `TAG_DROPDOWN_PADDING`
- Replace `256` (max height) → `DEFAULT_DROPDOWN_HEIGHT`
- Replace `150` (hide delay) → `TAG_PICKER_HIDE_DELAY`

In `src/components/outline/OutlineRow.vue`:
- Replace `24` (depth indent) → `OUTLINE_DEPTH_INDENT`
- Replace `8` (base padding) → `OUTLINE_BASE_PADDING`

In `src/components/sidebar/FolderTreeItem.vue`:
- Replace `16` (depth indent) → `SIDEBAR_DEPTH_INDENT`
- Replace `12` (base padding) → `SIDEBAR_BASE_PADDING`

In `src/components/settings/DocumentSettingsPanel.vue`:
- Replace `9999` z-index → `OVERLAY_Z_INDEX`

- [ ] **Step 5: Replace constants in lib files**

In `src/lib/idb.ts`:
- Replace local `const FLUSH_DELAY = 50` with import of `IDB_FLUSH_DELAY` (already named, just moving the definition)

In `src/lib/web-fs.ts`:
- Replace `5000` poll interval → `FILE_POLL_INTERVAL`
- Replace `2000` poll interval → `FILE_POLL_INTERVAL_FAST`

In `src/composables/outline/useVimMode.ts`:
- Replace `500` timeout → `VIM_PENDING_TIMEOUT`

In `src/composables/overlays/useGlobalSearch.ts`:
- Replace `200` debounce → `SEARCH_DEBOUNCE_DELAY`

- [ ] **Step 6: Verify everything compiles and tests pass**

Run: `bunx vue-tsc --noEmit && bun test`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: replace magic numbers with centralized constants"
```

---

### Task 4: Extract shared picker click-outside composable

**Files:**
- Create: `src/composables/usePickerClickOutside.ts`
- Modify: `src/composables/outline/useRowEditing.ts`
- Modify: `src/composables/board/useBoardEditing.ts`

- [ ] **Step 1: Create the shared composable**

```typescript
// src/composables/usePickerClickOutside.ts
import { watch, onUnmounted, type Ref } from 'vue'

/**
 * Adds a document-level mousedown listener (capture phase) while `isOpen` is true.
 * The listener is deferred by one tick so the opening click doesn't immediately close.
 */
export function usePickerClickOutside(
  isOpen: Ref<boolean> | Ref<string | null>,
  handler: (e: MouseEvent) => void,
) {
  let bound = false

  function add() {
    if (bound) return
    bound = true
    document.addEventListener('mousedown', handler, true)
  }

  function remove() {
    if (!bound) return
    bound = false
    document.removeEventListener('mousedown', handler, true)
  }

  watch(isOpen, (open) => {
    if (open) {
      setTimeout(add, 0)
    } else {
      remove()
    }
  })

  onUnmounted(remove)
}
```

- [ ] **Step 2: Refactor useRowEditing.ts to use it**

Replace the two inline watch blocks (date picker and tag picker click-outside) with:
```typescript
import { usePickerClickOutside } from '@/composables/usePickerClickOutside'

// In setup:
usePickerClickOutside(showDatePicker, onDateClickOutside)
usePickerClickOutside(showTagPicker, onTagClickOutside)
```

Remove the corresponding `watch(showDatePicker, ...)` and `watch(showTagPicker, ...)` blocks, plus the manual `removeEventListener` calls in the cleanup section.

- [ ] **Step 3: Refactor useBoardEditing.ts to use it**

**Note:** In `useBoardEditing.ts`, the watched refs are `editingTagsCardId` (type `Ref<string | null>`) and `editingDateCardId` (type `Ref<string | null>`), not boolean refs. The broadened signature (`Ref<boolean> | Ref<string | null>`) handles this.

Replace the two inline watch blocks with:
```typescript
import { usePickerClickOutside } from '@/composables/usePickerClickOutside'

usePickerClickOutside(editingTagsCardId, onTagClickOutside)
usePickerClickOutside(editingDateCardId, onDateClickOutside)
```

Remove the corresponding watch blocks and manual cleanup.

- [ ] **Step 4: Verify**

Run: `bunx vue-tsc --noEmit && bun test`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/composables/usePickerClickOutside.ts src/composables/outline/useRowEditing.ts src/composables/board/useBoardEditing.ts
git commit -m "refactor: extract shared picker click-outside composable"
```

---

### Task 5: Consolidate popover positioning

**Files:**
- Modify: `src/composables/useDropdownPosition.ts`
- Modify: `src/composables/board/useBoardEditing.ts`
- Modify: `src/components/settings/DocumentSettingsPanel.vue`

- [ ] **Step 1: Enhance useDropdownPosition to cover all use cases**

Update `src/composables/useDropdownPosition.ts` to use centralized constants and add horizontal clamping. Keep the current function-argument API (pass trigger element to `update()`) since `useBoardEditing.ts` calls it with different trigger elements depending on which card button was clicked — a constructor-ref pattern wouldn't work here.

```typescript
import { ref } from 'vue'
import {
  DEFAULT_DROPDOWN_HEIGHT,
  POPOVER_PADDING,
  POPOVER_OFFSET,
  POPOVER_MIN_EDGE,
} from '@/lib/constants'

interface DropdownPositionOpts {
  dropHeight?: number
  dropWidth?: number
}

export function useDropdownPosition(opts?: DropdownPositionOpts) {
  const style = ref({ top: '0px', left: '0px' })

  function update(triggerEl: HTMLElement | null) {
    if (!triggerEl) return
    const rect = triggerEl.getBoundingClientRect()
    const vh = window.innerHeight
    const vw = window.innerWidth
    const dropH = opts?.dropHeight ?? DEFAULT_DROPDOWN_HEIGHT
    const dropW = opts?.dropWidth ?? rect.width

    const spaceBelow = vh - rect.bottom - POPOVER_PADDING
    const top = spaceBelow >= dropH
      ? rect.bottom + POPOVER_OFFSET
      : Math.max(POPOVER_MIN_EDGE, rect.top - dropH - POPOVER_OFFSET)

    let left = rect.left
    if (left + dropW > vw - POPOVER_PADDING) {
      left = Math.max(POPOVER_MIN_EDGE, vw - dropW - POPOVER_PADDING)
    }

    style.value = { top: `${top}px`, left: `${left}px` }
  }

  return { style, update }
}
```

- [ ] **Step 2: Replace computePopoverPos in useBoardEditing.ts**

Remove the inline `computePopoverPos` function and use `useDropdownPosition` instead, calling `update()` when opening a picker.

- [ ] **Step 3: Replace inline positioning in DocumentSettingsPanel.vue**

Replace the manual position calculation with `useDropdownPosition`.

- [ ] **Step 4: Verify**

Run: `bunx vue-tsc --noEmit && bun test`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/composables/useDropdownPosition.ts src/composables/board/useBoardEditing.ts src/components/settings/DocumentSettingsPanel.vue
git commit -m "refactor: consolidate popover positioning into useDropdownPosition"
```

---

## Chunk 2: Split doc.ts Store

### Task 6: Extract doc store — view computations

**Files:**
- Create: `src/stores/doc-view.ts`
- Modify: `src/stores/doc.ts`

The view layer computes derived data from the node tree: visible rows, kanban columns, breadcrumbs, tag lists, and filter matching. These are all pure computations over core state.

- [ ] **Step 1: Create doc-view.ts with extracted computeds**

```typescript
// src/stores/doc-view.ts
import { computed, type Ref, type ShallowRef } from 'vue'
import type { Node, StatusDef, ViewMode } from '@/types'

interface DocViewDeps {
  nodes: ShallowRef<Map<string, Node>>
  rootId: Ref<string>
  zoomId: Ref<string | null>
  filters: { search: string; tag: string | null; dueDate: string | null }
  statusConfig: Ref<StatusDef[]>
  childrenMap: ReturnType<typeof computed<Map<string | null, Node[]>>>
}

export function useDocView(deps: DocViewDeps) {
  // Move these computed properties here:
  // - effectiveZoomId
  // - searchMatchIds
  // - allTags
  // - tagMatchIds
  // - dueDateMatchIds
  // - visibleRows
  // - kanbanNodes
  // - kanbanColumns
  // - zoomBreadcrumbs
  // - trashedNodes

  // Each keeps its exact current implementation, just receives deps via parameter
  // instead of closing over store refs directly.

  return {
    effectiveZoomId,
    searchMatchIds,
    allTags,
    tagMatchIds,
    dueDateMatchIds,
    visibleRows,
    kanbanNodes,
    kanbanColumns,
    zoomBreadcrumbs,
    trashedNodes,
  }
}
```

Move the following computed blocks from `doc.ts` into this file (preserving logic exactly):
- `effectiveZoomId` (line 187)
- `searchMatchIds` (lines 190-200)
- `allTags` (lines 202-211)
- `tagMatchIds` (lines 213-223)
- `dueDateMatchIds` (lines 225-235)
- `visibleRows` (lines 237-260)
- `kanbanNodes` (lines 276-285)
- `kanbanColumns` (lines 287-296)
- `zoomBreadcrumbs` (lines 1257-1267)
- `trashedNodes` (lines 653-661)
- Helper `subtreeNodes` (lines 263-274) — used by kanbanNodes

- [ ] **Step 2: Wire doc-view into doc.ts**

In `doc.ts`, import and call `useDocView()`, passing the required deps. Spread or destructure the returned computeds into the store's return object so the public API doesn't change.

```typescript
import { useDocView } from './doc-view'

// Inside defineStore:
const view = useDocView({ nodes, rootId, zoomId, filters, statusConfig, childrenMap })
// Then return { ...view, ... } to preserve the same public API
```

- [ ] **Step 3: Verify no API changes**

Run: `bunx vue-tsc --noEmit && bun test`
Expected: All pass. No consumer changes needed since the store's return shape is identical.

- [ ] **Step 4: Commit**

```bash
git add src/stores/doc-view.ts src/stores/doc.ts
git commit -m "refactor: extract view computations from doc store into doc-view"
```

---

### Task 7: Extract doc store — file sync

**Files:**
- Create: `src/stores/doc-sync.ts`
- Modify: `src/stores/doc.ts`

File I/O orchestration: debounced saves, file path resolution, write cooldowns, search index scheduling.

- [ ] **Step 1: Create doc-sync.ts**

Extract these functions and state from `doc.ts`:
- `getFilePath()` (lines 99-107)
- `saveToFile()` (lines 109-123)
- `scheduleFileSave()` (lines 82-89)
- `scheduleIndexUpdate()` (lines 66-74)
- `hasUnsavedChanges()` (lines 91-93)
- `recentlyWritten()` (lines 95-97)
- Private state: `_fileSaveTimer`, `_lastWriteAt`, `_indexTimer`

```typescript
// src/stores/doc-sync.ts
import { FILE_SAVE_DELAY, WRITE_COOLDOWN, INDEX_UPDATE_DELAY } from '@/lib/constants'
import type { Node } from '@/types'
import type { Ref, ShallowRef } from 'vue'

interface DocSyncDeps {
  nodes: ShallowRef<Map<string, Node>>
  rootId: Ref<string>
  statusConfig: Ref<StatusDef[]>
  tagColors: Ref<Record<string, string>>
  currentDocId: Ref<string>
}

export function useDocSync(deps: DocSyncDeps) {
  // Move file save/sync logic here
  // Return: { scheduleFileSave, scheduleIndexUpdate, saveToFile, getFilePath, hasUnsavedChanges, recentlyWritten }
}
```

- [ ] **Step 2: Wire into doc.ts**

```typescript
import { useDocSync } from './doc-sync'

const sync = useDocSync({ nodes, rootId, statusConfig, tagColors, currentDocId })
```

Replace all internal calls to use `sync.scheduleFileSave()`, etc.

- [ ] **Step 3: Verify**

Run: `bunx vue-tsc --noEmit && bun test`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/stores/doc-sync.ts src/stores/doc.ts
git commit -m "refactor: extract file sync logic from doc store into doc-sync"
```

---

### Task 8: Extract doc store — navigation & editing state

**Files:**
- Create: `src/stores/doc-nav.ts`
- Modify: `src/stores/doc.ts`

Keyboard navigation, selection management, edit state, and zoom — these are UI-coordination concerns, not core data operations.

- [ ] **Step 1: Create doc-nav.ts**

Extract:
- `selectNode`, `clearSelection`, `toggleSelectNode`, `rangeSelectTo`, `isSelected` (selection)
- `bulkSetStatus`, `bulkTombstone` (bulk operations on selection)
- `startEditing`, `stopEditing` (edit state)
- `setViewMode`, `zoomIn`, `zoomOut` (view mode / zoom)
- `moveSelectionUp`, `moveSelectionDown` (outline nav)
- `createSiblingBelow`, `indentNode`, `outdentNode` (outline structure nav)
- `editPreviousNode`, `editNextNode`, `deleteNodeAndEditPrevious`, `indentAndKeepEditing`, `outdentAndKeepEditing`, `createSiblingBelowAndEdit` (edit-aware nav)
- `navigateToNode` (deep link navigation)

```typescript
// src/stores/doc-nav.ts
export function useDocNav(deps: DocNavDeps) {
  // All nav/selection/edit-state functions
  // deps includes: nodes, editing, selection, filters, visibleRows,
  //                dispatch, createNode, moveNode, tombstone, etc.
}
```

- [ ] **Step 2: Wire into doc.ts**

```typescript
import { useDocNav } from './doc-nav'

const nav = useDocNav({ ... })
```

- [ ] **Step 3: Verify**

Run: `bunx vue-tsc --noEmit && bun test`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/stores/doc-nav.ts src/stores/doc.ts
git commit -m "refactor: extract navigation and editing state from doc store"
```

---

## Chunk 3: Simplify App.vue

### Task 9: Extract App.vue initialization logic

**Files:**
- Create: `src/composables/useAppInit.ts`
- Modify: `src/App.vue`

The `onMounted` block in App.vue (lines 114-260) handles platform detection, workspace loading, file watching, git detection, menu setup, and update checking. This should be a composable.

- [ ] **Step 1: Create useAppInit.ts**

Move the entire onMounted body into a composable that accepts the stores and reactive refs it needs:

```typescript
// src/composables/useAppInit.ts
import { onMounted, type Ref } from 'vue'
import { useDocStore } from '@/stores/doc'
import { useSettingsStore } from '@/stores/settings'
import { useDocumentsStore } from '@/stores/documents'
import { isTauri, hasFileSystemAccess, isFileSystemMode, isSingleFileMode } from '@/lib/platform'

interface AppInitOptions {
  showWorkspacePicker: Ref<boolean>
}

export function useAppInit(opts: AppInitOptions) {
  const store = useDocStore()
  const settings = useSettingsStore()
  const docs = useDocumentsStore()

  onMounted(async () => {
    // Move the entire onMounted block from App.vue here.
    // This includes:
    // - settings.init()
    // - Tauri path resolution
    // - Web FS directory/file handle restoration
    // - IDB fallback
    // - Git detection
    // - Menu handler setup
    // - File watcher setup
    // - Update checker
  })
}
```

- [ ] **Step 2: Replace in App.vue**

Replace the `onMounted(async () => { ... })` block with:
```typescript
import { useAppInit } from '@/composables/useAppInit'

useAppInit({ showWorkspacePicker })
```

- [ ] **Step 3: Verify**

Run: `bunx vue-tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/composables/useAppInit.ts src/App.vue
git commit -m "refactor: extract App.vue initialization into useAppInit composable"
```

---

### Task 10: Extract App.vue global keyboard handling

**Files:**
- Create: `src/composables/useGlobalKeyboard.ts`
- Modify: `src/App.vue`

- [ ] **Step 1: Create useGlobalKeyboard.ts**

Move the `onGlobalKeydown` function and its event listener setup:

```typescript
// src/composables/useGlobalKeyboard.ts
import { onMounted, onUnmounted, type Ref } from 'vue'
import { useDocStore } from '@/stores/doc'
import { useSettingsStore } from '@/stores/settings'
import { matchesCombo, type ShortcutDef } from '@/lib/shortcuts'

interface GlobalKeyboardOptions {
  showShortcuts: Ref<boolean>
  showGlobalSearch: Ref<boolean>
  showCommandPalette: Ref<boolean>
}

export function useGlobalKeyboard(opts: GlobalKeyboardOptions) {
  const store = useDocStore()
  const settings = useSettingsStore()

  function onGlobalKeydown(e: KeyboardEvent) {
    // Move the keyboard handler logic from App.vue here
  }

  onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
  onUnmounted(() => document.removeEventListener('keydown', onGlobalKeydown))
}
```

- [ ] **Step 2: Replace in App.vue**

```typescript
import { useGlobalKeyboard } from '@/composables/useGlobalKeyboard'

useGlobalKeyboard({ showShortcuts, showGlobalSearch, showCommandPalette })
```

- [ ] **Step 3: Verify**

Run: `bunx vue-tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/composables/useGlobalKeyboard.ts src/App.vue
git commit -m "refactor: extract global keyboard handling from App.vue"
```

---

### Task 11: Final cleanup and type-check

**Files:**
- Modify: Various (cleanup unused imports, dead code)

- [ ] **Step 1: Remove unused `useClickOutside.ts` if fully replaced**

Check if any file still imports `useClickOutside`. If not, delete it. If some files still use it, leave it.

- [ ] **Step 2: Full type-check and test run**

Run: `bunx vue-tsc --noEmit && bun test`
Expected: All pass

- [ ] **Step 3: Verify the app runs**

Run: `bun run dev`
Expected: App loads without console errors. Test outline, kanban, drag, pickers, search.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "refactor: cleanup unused imports and dead code"
```
