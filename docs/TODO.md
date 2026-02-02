# Strata TODO

## Done

- Tailwind CSS migration, dark mode, 7 color themes, user settings panel
- Op-log with debounced text ops, undo/redo, debounced IDB writes, export/import JSON
- Search with highlight, zoom into subtree, breadcrumb nav, collapse/expand animations
- Drag reorder, status cycling (Ctrl+1/2/3/4), inline status picker
- Context menus on outline rows and Kanban cards
- Kanban card inline editing, drag between columns, first-line display for multiline
- Splitpanes with resizable divider
- Natural text editing (click-to-edit, arrow/backspace/tab/enter navigation, multiline via Shift+Enter)
- Lucide icons, mobile layout, accessibility (ARIA), virtualized rendering, unit tests
- Onboarding starter nodes, empty-state labels, keyboard shortcut overlay, focus management
- Full design token migration: all components use CSS custom properties
- 11 developer code-editor themes (GitHub Light/Dark, Monokai, Nord, Dracula, Solarized Light/Dark, One Dark, Catppuccin Mocha, Gruvbox Dark, Tokyo Night)
- Theme pairing with light/dark appearance toggle
- Legacy theme migration for existing users
- Bug fix: cursor now moves to newly created items on Enter
- Bug fix: outline status icons update immediately when cards dragged on Kanban board
- Tags/labels with autocomplete picker, per-node tag pills, tag filtering in toolbar
- Multiple documents with per-doc IndexedDB, document sidebar, create/rename/delete/duplicate, migration from single-DB format
- Trash panel with soft-delete, restore, and deletedAt timestamps
- Export to Markdown, OPML, and plain text (in addition to JSON)
- Inline markdown rendering (bold, italic, strikethrough, code, links, images) via markdown-it
- Text edits are undo/redoable (before-snapshot capture on first keystroke)
- Per-document custom statuses: add, remove, reorder, rename, recolor, pick icons; stored in IDB meta table; dynamic kanban columns, status picker, context menu, keyboard shortcuts
- Due dates with visual urgency badges (overdue/today/soon/normal), inline date picker, due date filter in toolbar (All/Overdue/Today/This Week)
- Unified search modal: search current document and all documents from a single overlay (Ctrl+Shift+F), with match highlighting and keyboard navigation
- Keyboard shortcut customization: remap all shortcuts via interactive editor, conflict detection, per-shortcut and bulk reset, persisted in localStorage
- Separate show/hide tags toggle for board view (independent of outline tags setting)
- User guide documentation (docs/user-guide.md)
- Developer setup instructions (docs/developer-setup.md)

## Remaining

### Priority: Tauri + Git-backed persistence

- [ ] Wrap app in Tauri (Rust shell for native filesystem access)
- [ ] File-based persistence layer: serialize each document to `.md` in a user-chosen directory using inline markers (e.g. `- Task text @due(2026-02-15) #tag !status(in-progress)`) with nested lists for hierarchy
- [ ] Keep IndexedDB as fast working cache, sync to filesystem on save
- [ ] Auto-detect git repo in chosen directory; surface git status in UI
- [ ] Git operations from UI: commit, pull, push (via Tauri command bridge)

### Backlog

- [ ] Multi-device sync (via git push/pull — replaces CRDT approach)
- [ ] Collaboration: real-time multi-user editing
