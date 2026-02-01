# Strata TODO

## Phase 1: Core polish (make it feel like a real tool)

- [x] Migrate all component CSS to Tailwind utility classes
- [x] Debounce text ops (batch keystrokes into one op per ~300ms pause)
- [x] Undo/redo (walk the op log backward/forward with Ctrl+Z / Ctrl+Shift+Z)
- [x] Search: filter outline + highlight matches (wire up the top-bar input)
- [x] Zoom into subtree via bullet click (single-click toggles collapse, double-click zooms)
- [x] Drag reorder nodes within the outline (drop indicator + move op)
- [x] Status cycling keyboard shortcut (Ctrl+1/2/3/4 to set status)

## Phase 2: Views & projections

- [x] Right-click context menu on outline rows (set status, zoom, delete, duplicate)
- [x] Inline status picker dropdown on outline rows (click status icon)
- [x] Kanban card inline editing (double-click card title to edit)
- [x] Empty-state improvements (onboarding starter nodes + empty column labels)
- [x] Lucide icons throughout (outline bullets, status icons, search, app logo)
- [x] Splitpanes with resizable divider in split mode

## Phase 3: Persistence & reliability

- [x] Export/import JSON (full document dump + restore)
- [x] Debounce IDB writes (batch multiple ops into single transaction)
- [x] Clear data / reset document action

## Phase 4: Polish & UX

- [x] Dark mode (CSS custom properties, toggle in top bar)
- [x] Keyboard shortcut overlay (`?` key shows cheat sheet modal)
- [x] Breadcrumb nav bar for zoom path (clickable segments)
- [x] Collapse/expand animations
- [x] Focus management: auto-focus outline panel on view switch
- [x] Mobile layout improvements (better responsive design)
- [x] User settings panel (theme, font size, etc.)
- [x] Accessibility improvements (ARIA roles, keyboard nav, screen reader support)
- [x] Performance optimizations for large documents (virtualized rendering)
- [x] Testing: unit tests for core logic, integration tests for UI flows
- [ ] Documentation: user guide, developer setup instructions
- [x] _Many_ themes! (7 themes: Slate Blue, Ocean, Forest, Rose, Amber, Violet, Mono)
  