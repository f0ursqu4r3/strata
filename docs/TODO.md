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

## Remaining

- [ ] Documentation: user guide, developer setup instructions
- [ ] Rich text editing via Markdown or similar
- [ ] Multi-device sync (CRDTs or server-based merge)
- [ ] Collaboration: real-time multi-user editing
- [ ] Due dates, reminders, and date-based filtering
- [ ] Multiple documents / workspaces
- [ ] Full-text search across all documents
- [ ] Tags / labels with filtering
- [ ] Trash / archive with restore
- [ ] Keyboard shortcut customization
- [ ] Export to more formats (OPML, plain text, CSV)
