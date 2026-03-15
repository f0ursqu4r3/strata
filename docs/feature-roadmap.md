# Strata Feature Roadmap

Prioritized feature ideas with implementation details. Items are ordered by value to daily workflows.

---

## 1. Keyboard-Driven Node Moving

**Priority:** High — reordering requires drag-and-drop today, which breaks keyboard flow.

**Behavior:**

- `Alt+Up` / `Alt+Down` — Move selected node up/down among siblings
- `Alt+Shift+Up` / `Alt+Shift+Down` — Move node out to parent's level (outdent+reposition) or into previous sibling (indent+reposition)
- Works in both navigation and editing modes
- Multi-select: moves all selected nodes together

**Implementation:**

- Add 4 new `ShortcutAction` entries in `src/lib/shortcuts.ts`: `moveNodeUp`, `moveNodeDown`, `moveNodeOutUp`, `moveNodeInDown`
- Add store methods in `src/stores/doc.ts`:
  - `moveNodeUp(id)` — Swap with previous sibling using `rankBetween`/`rankBefore`
  - `moveNodeDown(id)` — Swap with next sibling using `rankBetween`/`rankAfter`
  - These create `move` ops so they're undoable
- Wire shortcuts in `src/composables/useGlobalKeyboard.ts`
- Update `src/composables/outline/useVimMode.ts` — Add vim equivalents (e.g., `Ctrl+j`/`Ctrl+k` in normal mode)
- Update `src/docs/user-guide.md` and shortcuts modal

**Files to modify:**

- `src/lib/shortcuts.ts` — New shortcut definitions
- `src/stores/doc.ts` — `moveNodeUp()`, `moveNodeDown()` methods
- `src/composables/useGlobalKeyboard.ts` — Handle new shortcuts
- `src/composables/outline/useVimMode.ts` — Vim bindings
- `src/components/settings/ShortcutsModal.vue` — Display new shortcuts

---

## 2. Drag-to-Move Between Documents

**Priority:** High — no way to move a subtree to another document today.

**Behavior:**

- In the outline, select node(s), then use a context menu action "Move to Document..." which opens a document picker
- Alternatively: cut (Ctrl+X) in one document, switch documents, paste (Ctrl+V)
- Moves the full subtree (node + all descendants) with metadata intact (tags, status, due dates)
- Source document removes the nodes; target document inserts at root level (or at cursor position if a node is selected)

**Implementation:**

- **Clipboard approach** (simpler, more flexible):
  - Add `cutNodes(ids)` to `src/stores/doc.ts` — Serializes selected subtree to an in-memory clipboard, then tombstones from source
  - Add `pasteNodes(parentId?, pos?)` to `src/stores/doc.ts` — Deserializes clipboard into current document, creating new node IDs
  - Clipboard is a `ref<SerializedNode[] | null>` in a shared store or composable
  - Wire `Ctrl+X` / `Ctrl+V` in `src/composables/useGlobalKeyboard.ts`
  - Also wire `Ctrl+C` for copy (clone without deleting source)
- **Context menu approach** (for mouse users):
  - Add "Move to..." menu item in `src/components/shared/ContextMenu.vue`
  - Opens a small document picker modal listing all documents
  - On selection: serialize subtree, switch doc, insert, tombstone from source
- Clipboard format: `{ nodes: Node[], rootIds: string[] }` — enough to reconstruct the subtree

**Files to modify:**

- `src/stores/doc.ts` — `cutNodes()`, `copyNodes()`, `pasteNodes()` methods
- `src/composables/useGlobalKeyboard.ts` — Ctrl+X, Ctrl+C, Ctrl+V handlers
- `src/components/shared/ContextMenu.vue` — "Move to..." and "Copy to..." menu items
- New: `src/components/overlays/DocumentPicker.vue` — Modal to pick target document
- `src/stores/documents.ts` — Helper to insert serialized nodes into a different doc

---

## 3. Quick Filter Bar

**Priority:** High — current filtering requires toolbar dropdowns; no inline keyboard-driven filter.

**Behavior:**

- Press `/` (or configurable shortcut) to open an inline filter bar at the top of the outline
- Type to filter visible nodes by text content (instant, no debounce needed for small docs; 100ms debounce for large)
- Prefix modifiers:
  - `#tag` — Filter by tag
  - `!status` — Filter by status label
  - `@due:today` / `@due:week` / `@due:overdue` — Filter by due date
  - No prefix — Text search
- Filtered view shows matching nodes + their ancestors (to preserve tree context)
- Press `Escape` to clear filter and close bar
- Press `Enter` to jump to first match and close bar (keep filter active)

**Implementation:**

- Add a `filterQuery` ref to `src/stores/doc.ts` (or `doc-view.ts`)
- Add a `filteredRows` computed that wraps `visibleRows` with the filter logic
- Parse filter prefixes in a utility function: `parseFilterQuery(query) => { type: 'text' | 'tag' | 'status' | 'due', value: string }`
- Ancestor inclusion: when a node matches, walk up `parentId` chain and include all ancestors
- Add new `ShortcutAction` `quickFilter` in `src/lib/shortcuts.ts` (default: `/` in outline context)
- Create `FilterBar.vue` component — A minimal input bar that appears above the outline
- Mount in `src/components/outline/OutlineView.vue` conditionally

**Files to modify:**

- `src/stores/doc-view.ts` — `filterQuery` ref, `filteredRows` computed
- `src/lib/shortcuts.ts` — New `quickFilter` action
- New: `src/components/outline/FilterBar.vue` — Inline filter input
- `src/components/outline/OutlineView.vue` — Mount FilterBar, use filteredRows
- `src/composables/useGlobalKeyboard.ts` — Handle `/` shortcut

---

## 4. Recurring Tasks

**Priority:** High — no way to represent repeating work today.

**Behavior:**

- In the context menu or via a keyboard shortcut, set a recurrence rule on a node: daily, weekly, biweekly, monthly, or custom interval
- When a recurring task is marked as "done" (final status), the app:
  1. Keeps the completed instance (marks it done with timestamp)
  2. Creates a new sibling node with the same text, tags, and recurrence rule
  3. Sets the new node's due date to the next occurrence
  4. Sets the new node's status to the default (first) status
- Recurrence data stored as a new optional field on Node: `recurrence?: { interval: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom', customDays?: number }`
- In the file format: `!recur(weekly)` marker appended to the node line, similar to `!status()` and `@due()`

**Implementation:**

- Extend `Node` type in `src/types/index.ts` with `recurrence?: RecurrenceRule`
- Add `RecurrenceRule` type: `{ interval: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom', customDays?: number }`
- Add new op type `setRecurrence` in `src/lib/ops.ts`
- In `src/stores/doc.ts`, hook into `setStatus()` — when status becomes final and node has recurrence, auto-create next occurrence
- New utility `src/lib/recurrence.ts`:
  - `nextDueDate(currentDue: number, rule: RecurrenceRule): number`
  - `formatRecurrence(rule: RecurrenceRule): string` — "Weekly", "Every 3 days", etc.
- Update `src/lib/markdown-serialize.ts` — Serialize `!recur(weekly)` marker
- Update `src/lib/markdown-parse.ts` — Parse `!recur()` marker
- Add recurrence picker UI — Either inline in context menu or a small popover
- Show recurrence indicator on nodes (small repeat icon next to due date)

**Files to modify:**

- `src/types/index.ts` — Add `recurrence` field to `Node`, add `RecurrenceRule` type
- `src/lib/ops.ts` — New `setRecurrence` op type
- `src/stores/doc.ts` — Hook in `setStatus()`, add `setRecurrence()` method
- New: `src/lib/recurrence.ts` — Date calculation utilities
- `src/lib/markdown-serialize.ts` — Serialize `!recur()` marker
- `src/lib/markdown-parse.ts` — Parse `!recur()` marker
- `src/components/shared/ContextMenu.vue` — Recurrence menu item
- `src/components/outline/OutlineRow.vue` — Recurrence indicator icon
- `src/docs/file-format.md` — Document new marker

---

## 5. Node Linking / References

**Priority:** Medium — makes Strata useful for connected notes, not just flat task lists.

**Behavior:**

- Type `[[` to trigger an autocomplete dropdown of node titles (across current document and optionally all documents)
- Selecting a result inserts `[[Node Title]]` syntax
- In read mode, `[[Node Title]]` renders as a clickable link
- Clicking navigates to the referenced node (zooms in if same doc, switches doc if cross-doc)
- Backlinks: optionally show "Referenced by" at the bottom of a node when viewing it
- Broken links (deleted target) render with strikethrough styling

**Implementation:**

- Extend `src/lib/inline-markdown.ts` — Add a markdown-it plugin or post-processing rule for `[[...]]` syntax
- Render as `<a class="strata-node-link" data-node-ref="title">Title</a>`
- Click handler in `OutlineRow.vue` — Intercept clicks on `.strata-node-link`, resolve the title to a node ID, navigate
- Resolution: search current doc first, then cross-doc index
- Autocomplete: trigger on `[[` keystroke in the editing input
  - Reuse the existing search index (`src/lib/search-index.ts`) for candidates
  - Show a dropdown (similar to tag autocomplete) with matching node titles
- Store links as plain text `[[Title]]` — no special data model changes needed
- Backlinks computation: scan all nodes for `[[Title]]` references to the current node

**Files to modify:**

- `src/lib/inline-markdown.ts` — Parse and render `[[...]]` links
- `src/components/outline/OutlineRow.vue` — Click handler for node links
- `src/composables/outline/useRowEditing.ts` — `[[` autocomplete trigger
- New: `src/components/outline/NodeLinkAutocomplete.vue` — Autocomplete dropdown
- `src/lib/search-index.ts` — Query function for node title lookup
- `src/styles/main.css` — `.strata-node-link` styling

---

## 6. Bulk Operations from Multi-Select

**Priority:** Medium — multi-select exists but only supports delete and set-status.

**Behavior:**

- When multiple nodes are selected (Shift+click or Cmd+click), the context menu shows bulk actions:
  - Set status (already works)
  - Delete (already works)
  - Add tag (new)
  - Remove tag (new)
  - Set due date (new)
  - Clear due date (new)
  - Move to document (new, see feature #2)
- Toolbar could show a selection count badge: "3 selected"

**Implementation:**

- Add bulk methods to `src/stores/doc.ts`:
  - `bulkAddTag(tag: string)` — Adds tag to all selected nodes
  - `bulkRemoveTag(tag: string)` — Removes tag from all selected nodes
  - `bulkSetDueDate(dueDate: number | null)` — Sets due date on all selected
- Update `src/components/shared/ContextMenu.vue`:
  - When `isMultiSelect` is true, show expanded menu with tag/due date options
  - Tag submenu: list existing tags + "Add tag..." input
  - Due date: show date picker that applies to all selected
- Add selection count indicator to `src/App.vue` toolbar (e.g., "3 items selected" badge near the view mode selector)

**Files to modify:**

- `src/stores/doc.ts` — `bulkAddTag()`, `bulkRemoveTag()`, `bulkSetDueDate()` methods
- `src/components/shared/ContextMenu.vue` — Expanded multi-select menu
- `src/App.vue` — Selection count badge in toolbar

---

## 7. Template Nodes

**Priority:** Medium — useful for repeating project structures.

**Behavior:**

- Right-click a node with children, select "Save as Template"
- Template is saved with a name (e.g., "Sprint Planning", "Meeting Notes")
- Templates stored in localStorage (simple) or a dedicated IDB store
- "Insert Template" command in command palette and context menu
- Inserts the template subtree as children of the selected node (or at root)
- Template preserves: text, hierarchy, tags, statuses. Clears: due dates, completion status

**Implementation:**

- Template data structure: `{ name: string, nodes: SerializedNode[] }` — same serialization as copy/paste
- New: `src/lib/templates.ts`:
  - `saveTemplate(name, rootNodeId, store)` — Serialize subtree
  - `loadTemplates(): Template[]` — Read from storage
  - `deleteTemplate(name)` — Remove
  - `insertTemplate(template, parentId, store)` — Deserialize into doc
- Storage: `localStorage` key `strata-templates` (JSON array)
- Context menu: "Save as Template..." (only shown when node has children)
- Command palette: "Insert Template" → shows template list
- Template manager: accessible from Settings or Document Settings

**Files to modify:**

- New: `src/lib/templates.ts` — Template CRUD operations
- `src/components/shared/ContextMenu.vue` — "Save as Template" menu item
- `src/composables/overlays/useCommandPalette.ts` — "Insert Template" commands
- New: `src/components/overlays/TemplatePicker.vue` — Template selection modal
- `src/components/settings/SettingsPanel.vue` — Template management section (optional)

---

## 8. Sort Children

**Priority:** Medium — currently order is manual-only.

**Behavior:**

- Right-click a parent node, select "Sort children by..." submenu:
  - Alphabetical (A-Z / Z-A)
  - Due date (earliest first / latest first)
  - Status (follows status definition order)
  - Created date (newest first / oldest first)
- Sorting physically reorders the nodes (creates `move` ops), so it's undoable
- Only sorts direct children, not recursively
- Keyboard shortcut: could add to command palette as "Sort Children by..."

**Implementation:**

- Add `sortChildren(parentId, key, direction)` to `src/stores/doc.ts`:
  - Get children via `getChildren(parentId)`
  - Sort by the chosen key
  - Reassign `pos` values using `rankBetween`/`rankAfter` to match new order
  - Create `move` ops for each repositioned node
- Sort keys:
  - `text` — Case-insensitive alphabetical on first line
  - `dueDate` — Epoch timestamp, nulls at end
  - `status` — Index in `statusDefs` array
  - `created` — Op sequence number of the `create` op (would need to look up in ops)
- Add to context menu as a submenu (only shown when node has 2+ children)
- Add to command palette: "Sort Children: A-Z", "Sort Children: By Due Date", etc.

**Files to modify:**

- `src/stores/doc.ts` — `sortChildren()` method
- `src/components/shared/ContextMenu.vue` — "Sort children" submenu
- `src/composables/overlays/useCommandPalette.ts` — Sort commands

---

## 9. Print / PDF Export

**Priority:** Low — useful for sharing in meetings but not daily workflow.

**Behavior:**

- Command palette action or Export menu option: "Print / PDF"
- Opens a print-optimized view in a new window/tab
- Respects current zoom level (exports subtree if zoomed)
- Print styles: clean typography, no UI chrome, proper page breaks between top-level nodes
- Includes: node text, status indicators (text labels, not icons), tags, due dates
- Excludes: collapsed state (shows all nodes expanded)

**Implementation:**

- Add `@media print` styles to `src/styles/main.css`:
  - Hide toolbar, sidebar, status icons, hover actions
  - Show status as text labels
  - Expand all collapsed nodes
  - Clean typography with proper margins
- Alternatively: generate a standalone HTML document and open in new tab
  - Reuse `src/lib/export-formats.ts` markdown export, render through markdown-it
  - Add print button that calls `window.print()`
- Simpler approach: add a "Print" button to the Export menu that triggers `window.print()` with print media styles already in place

**Files to modify:**

- `src/styles/main.css` — `@media print` rules
- `src/components/overlays/ExportMenu.vue` — "Print" option
- Alternatively new: `src/lib/print.ts` — Generate printable HTML

---

## 10. Completed Items Auto-Archive

**Priority:** Low — quality of life for long-running documents.

**Behavior:**

- Per-document setting: "Auto-archive completed items after N days" (default: off)
- Completed nodes (final status) older than N days are automatically moved to a collapsible "Archived" section at the bottom of their parent
- Archived nodes are visually distinct (dimmed text, smaller)
- Can be restored by changing status back to non-final
- Archive happens on document load, not in real-time (avoid mid-work surprises)

**Implementation:**

- Add `archiveDays?: number` to document frontmatter (YAML)
- On document load in `src/stores/doc.ts`, run archive pass:
  - Find all nodes with final status where `statusChangedAt < now - archiveDays`
  - Move them to end of their sibling list (create `move` ops)
  - Add a `archived: true` transient flag (not persisted to file)
- Visual treatment in `OutlineRow.vue`: archived nodes get `opacity-60 text-sm`
- Settings in `DocumentSettingsPanel.vue`: slider or input for archive days (0 = off)
- Need to track when status was last changed — could use op log timestamp or add `statusChangedAt` to Node

**Files to modify:**

- `src/types/index.ts` — Optional `statusChangedAt` field on Node
- `src/stores/doc.ts` — Archive pass on load, track status change timestamps
- `src/components/outline/OutlineRow.vue` — Archived visual treatment
- `src/components/settings/DocumentSettingsPanel.vue` — Archive days setting
- `src/lib/markdown-serialize.ts` — Persist `archiveDays` in frontmatter
- `src/lib/markdown-parse.ts` — Parse `archiveDays` from frontmatter
