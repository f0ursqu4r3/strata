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

## Remaining

- [ ] Documentation: user guide, developer setup instructions
- [ ] Multi-device sync (CRDTs or server-based merge)
- [ ] Collaboration: real-time multi-user editing
- [ ] Due dates, reminders, and date-based filtering
- [ ] Full-text search across all documents
- [ ] Keyboard shortcut customization
