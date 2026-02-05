# Strata TODO

## Done

- Tailwind CSS, dark mode, 7 color themes, 11 code-editor themes, light/dark toggle, design tokens
- Op-log with undo/redo, debounced IDB writes, export/import JSON
- Outline: search, zoom, breadcrumbs, collapse/expand, drag reorder (with subtree), drop-as-child
- Kanban: card editing, drag between columns, context menus
- Natural text editing, multiline (Shift+Enter), inline markdown rendering
- Status system: custom per-doc statuses, cycling (Ctrl+1-N), inline picker, keyboard shortcuts
- Tags with autocomplete, per-node pills, filtering; due dates with urgency badges and date picker
- Multi-document support, document sidebar, trash panel with restore
- Export: Markdown, OPML, plain text, JSON
- Tauri native shell, file-based `.md` persistence, IDB migration, file watcher
- Git repo auto-detection, workspace picker
- Unified cross-document search (Ctrl+Shift+F), keyboard shortcut customization
- Splitpanes, virtualized rendering, mobile layout, accessibility (ARIA)
- Onboarding, keyboard shortcut overlay, user guide, developer docs
- Command palette (Ctrl+K): fuzzy-search all actions, shortcuts displayed
- Vim keyboard mode: j/k nav, i edit, o new sibling, dd delete, gg/G jump, zc/zo collapse, / search
- Node history: per-node changelog timeline from the op-log
- Multi-select: shift-click range, cmd-click toggle, bulk delete and status change
- Unique document names ("Untitled", "Untitled 2", etc.), conflict detection on rename, file rename on disk
- Drag-and-drop file import: Markdown, OPML, plain text, JSON with visual drop zone
- Git branch name displayed in header badge when workspace is a git repo

## Remaining

### Priority

- [ ] Git operations from UI: commit, pull, push (via Tauri command bridge)

### Backlog

- [ ] Multi-device sync (via git push/pull)
- [ ] Collaboration: real-time multi-user editing
