# Strata User Guide

Strata is a local-first outliner and kanban board. All your data stays on your device — no accounts, no servers, no internet required. Think of it as a fast, keyboard-driven tool for organizing tasks, notes, and projects.

---

## Getting Started

When you first open Strata, you'll see a set of starter nodes to help you get oriented. Each node is a line of text that can have children, tags, a due date, and a status.

**Basic workflow:**

1. Click a node or press **Enter** to start editing
2. Press **Escape** to stop editing and return to navigation
3. Use **Arrow keys** to move between nodes
4. Press **Tab** to indent, **Shift+Tab** to outdent

---

## Views

Strata has three view modes, selectable from the toolbar:

- **Outline** — A hierarchical tree. This is where you'll do most of your writing and organizing.
- **Board** — A kanban board with one column per status. Drag cards between columns to change their status.
- **Split** — Outline on the left, kanban on the right, with a resizable divider.

---

## Editing Nodes

- **Click** a node or select it and press **Enter** to start editing.
- **Escape** stops editing and returns to outline navigation.
- Type normally. The text area auto-resizes as you type.
- **Shift+Enter** creates a new sibling node below and starts editing it.
- **Enter** (while editing) inserts a newline for multi-line content.
- **Backspace** on an empty node deletes it and moves editing to the previous node.
- **Arrow Up** at the start of a node moves editing to the previous node.
- **Arrow Down** at the end of a node moves editing to the next node.

### Inline Markdown

When you stop editing, Strata renders basic markdown:

- `**bold**` or `__bold__` → **bold**
- `*italic*` or `_italic_` → *italic*
- `` `code` `` → `code`
- `~~strikethrough~~` → ~~strikethrough~~
- `[link text](url)` → clickable link (opens in new tab)
- URLs are auto-linked

Markdown syntax is shown as-is while editing, and rendered when you're not.

---

## Organizing

### Indent & Outdent

- **Tab**: Make the selected node a child of the node above it.
- **Shift+Tab**: Promote the node up one level in the hierarchy.
- Both work in navigation mode and while editing.

### Collapse & Expand

- Click the **chevron** (▶/▼) next to any parent node.
- Or select a parent node and press **Space**.
- Collapsed nodes show a right-pointing chevron; expanded nodes show a down-pointing chevron.
- Leaf nodes (no children) show a small dot.

### Zoom / Focus

- **Double-click** a bullet to zoom into that node's subtree.
- **Single-click** a leaf bullet to zoom in.
- Right-click → **Zoom in** from the context menu.
- When zoomed, a breadcrumb bar appears below the toolbar. Click any breadcrumb to zoom to that level, or click **Root** to zoom all the way out.
- Exports respect the current zoom level.

### Drag & Drop

- Drag nodes in the outline to reorder them. A blue drop indicator shows where the node will land.
- In the kanban board, drag cards between columns to change their status.

---

## Statuses

Every node has a status. The defaults are:

| Status | Icon | Color |
|---|---|---|
| Todo | ○ | Gray |
| In Progress | ◉ | Blue |
| Blocked | ⊘ | Red |
| Done | ✓ | Green |

### Changing Status

- **Click the status icon** on any row to open an inline picker.
- **Ctrl+1** through **Ctrl+9** set the status to the 1st through 9th status. Works in both navigation and editing modes.
- **Right-click → Set status** to pick from a submenu.

### Custom Statuses

Open the status editor from **Settings → Manage Statuses** or the **gear icon** on the kanban board.

You can:

- **Add** a new status (+ button)
- **Remove** a status (trash icon) — you'll be asked which status to reassign its items to
- **Reorder** statuses (up/down arrows) — this also reorders kanban columns
- **Rename** a status (click the label)
- **Change icon** (click the icon) — choose from: circle, circle-dot, circle-alert, circle-check, circle-x, circle-pause
- **Change color** (click the color swatch) — 16 colors available

At least one status must exist at all times.

---

## Tags

### Adding Tags

1. While editing a node, click **+ tag** on the right side of the row.
2. Type a tag name. An autocomplete dropdown shows existing tags.
3. Press **Enter** to add the tag (either the highlighted suggestion or a new tag).
4. Add multiple tags by continuing to type.

You can also right-click → **Tags** to open the tag picker.

### Removing Tags

In the tag picker, click the **X** next to any tag. Or press **Backspace** on an empty input to remove the last tag.

### Tag Filtering

If any tags exist in the document, a **Tags** button appears in the toolbar. Click it to open a dropdown and select a tag to filter by. Only nodes with that tag (and their ancestors) will be shown. Click **All** or the **X** to clear the filter.

### Display

- Tag pills appear to the right of each node in the outline (when "Show tags" is enabled in Settings).
- Tags on kanban cards have a separate toggle — the **Tag icon** button in the board header.

---

## Due Dates

### Setting a Due Date

- While editing a node, click **+ due** on the right side of the row.
- Right-click → **Due date** to open the date picker.
- Click an existing due date badge to change it.
- Use the **Clear** button (X) in the date picker to remove the date.

### Urgency Badges

Due dates display as color-coded badges:

| Color | Meaning |
|---|---|
| Red | Overdue |
| Amber | Due today |
| Blue | Due within 3 days |
| Gray | More than 3 days away |

Labels are smart: "Today", "Tomorrow", "Yesterday", or a formatted date like "Jan 15".

### Due Date Filtering

The **Due** button in the toolbar lets you filter:

- **All** — Show everything
- **Overdue** — Only overdue items
- **Due Today** — Today and overdue
- **This Week** — Next 7 days and overdue

---

## Kanban Board

The board view shows one column per status. Each card displays:

- The first line of the node's text
- A breadcrumb showing the node's parent hierarchy
- Child count (if the node has children)
- Due date badge (color-coded)
- Tags (if board tags are enabled)

### Board Actions

- **Drag** a card between columns to change its status.
- **Double-click** a card to edit it inline.
- **Right-click** a card for the context menu.
- **Tag toggle** (Tag icon, top-right): Show/hide tags on cards. This is independent of the outline's "Show tags" setting.
- **Manage statuses** (gear icon, top-right): Open the status editor.

---

## Search

Press **Ctrl+Shift+F** or click the **Search icon** in the toolbar to open the search modal.

The search modal has two sections:

- **Current Document** — Results from the document you're currently viewing.
- **All Documents** — Results from other documents, grouped by document name.

Type to search. Results update as you type (200ms debounce). Matching text is highlighted.

**Keyboard navigation:**
- **↑ / ↓**: Move through results
- **Enter**: Jump to the selected result (switches documents if needed)
- **Escape**: Close search

---

## Documents

### Document Sidebar

Click the **sidebar toggle** (left side of toolbar) to open the document sidebar. Documents are sorted by last modified.

- **Create**: Click the **+** button in the sidebar header. A new "Untitled" document is created and you can immediately rename it.
- **Switch**: Click any document name.
- **Rename**: Double-click a document name.
- **Delete**: Click the trash icon that appears on hover. You must have at least 2 documents — the last one can't be deleted.

When you delete the active document, Strata switches to the most recently modified remaining document.

---

## Trash & Restore

Deleted nodes aren't gone forever. Click the **Trash icon** in the toolbar to open the trash panel.

Each deleted item shows:

- A text preview (first line)
- When it was deleted
- A **Restore** button (appears on hover)

Restoring a node brings it back to its original position with all metadata intact (tags, status, due date, children).

---

## Export & Import

### Export

Click the **Export** button (download icon) in the toolbar. Choose a format:

| Format | Description |
|---|---|
| **JSON** | Complete document data. Can be re-imported. Best for backups. |
| **Markdown** | Hierarchical bullet list with status indicators and #tags. |
| **OPML** | XML outline format. Compatible with other outliner apps. |
| **Plain Text** | Simple indented text with status labels in brackets. |

All exports respect the current zoom level — if you're zoomed into a subtree, only that subtree is exported.

### Import

Click the **Import** button (upload icon) to import a JSON file previously exported from Strata.

---

## Keyboard Shortcuts

### Default Shortcuts

| Shortcut | Action | Context |
|---|---|---|
| **↑** | Move selection up | Outline navigation |
| **↓** | Move selection down | Outline navigation |
| **Enter** | Start editing | Outline navigation |
| **Space** | Toggle collapse/expand | Outline navigation |
| **Tab** | Indent node | Outline navigation / Editing |
| **Shift+Tab** | Outdent node | Outline navigation / Editing |
| **Delete** | Delete node | Outline navigation |
| **Escape** | Stop editing | Editing |
| **Shift+Enter** | New sibling below | Editing |
| **Ctrl+Z** | Undo | Global |
| **Ctrl+Shift+Z** | Redo | Global |
| **Ctrl+Shift+F** | Search | Global |
| **Ctrl+1–9** | Set status | Global |
| **?** | Keyboard shortcuts | Global |

On Mac, **Ctrl** maps to **Cmd** automatically.

### Customizing Shortcuts

1. Press **?** to open the shortcuts modal.
2. Click **Customize** in the top-right.
3. Click **Edit** next to any shortcut.
4. Press the new key combination. If it conflicts with another shortcut, a warning is shown.
5. Click **Save** to confirm or **Cancel** to discard.
6. Use **Reset** (per shortcut) or **Reset all** to revert to defaults.

Custom shortcuts are saved to your browser's local storage.

---

## Settings

Click the **gear icon** in the toolbar to open the settings panel.

### Themes

Strata includes 11 themes:

| Theme | Appearance |
|---|---|
| GitHub Light | Light |
| GitHub Dark | Dark |
| Monokai | Dark |
| Nord | Dark |
| Dracula | Dark |
| Solarized Light | Light |
| Solarized Dark | Dark |
| One Dark | Dark |
| Catppuccin | Dark |
| Gruvbox | Dark |
| Tokyo Night | Dark |

Click any theme to switch. The appearance toggle (sun/moon icon) switches between the current theme's light/dark pair.

### Font Size

Adjust from 11px to 20px using the slider or +/- buttons.

### Display

- **Show tags on rows**: Toggle tag pill visibility on outline rows.

### Statuses

Click **Manage Statuses** to open the status editor (see [Statuses](#statuses) above).

---

## Tips

- **Everything is local.** Your data lives in your browser's IndexedDB. No account, no server, no internet required.
- **Export regularly.** JSON export is a full backup. Keep copies if your data is important.
- **Large documents perform well.** Strata uses virtual scrolling for outlines with 100+ items.
- **Right-click everything.** Context menus are available on outline rows and kanban cards.
- **Zoom for focus.** Double-click a bullet to zoom into a subtree. Great for focusing on one part of a large outline.
- **Keyboard-first.** Almost everything can be done without a mouse — navigation, editing, status changes, search.
