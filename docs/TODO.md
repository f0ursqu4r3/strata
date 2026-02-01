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

- [ ] Right-click context menu on outline rows (set status, zoom, delete, duplicate)
- [ ] Inline status picker dropdown on outline rows
- [ ] Kanban card inline editing (click card title to edit text)
- [ ] Empty-state improvements (better onboarding for new documents)

## Phase 3: Persistence & reliability

- [ ] Export/import JSON (full document dump + restore)
- [ ] Debounce IDB writes (batch multiple ops into single transaction)
- [ ] Clear data / reset document action

## Phase 4: Polish & UX

- [ ] Dark mode (CSS custom properties, toggle in top bar)
- [ ] Keyboard shortcut overlay (`?` key shows cheat sheet modal)
- [ ] Breadcrumb nav bar for zoom path (clickable segments)
- [ ] Collapse/expand animations
- [ ] Focus management: auto-focus outline panel on view switch
- [ ] Lucide icons throughout the app
- [ ] Mobile layout improvements (better responsive design)
- [ ] User settings panel (theme, font size, etc.)
- [ ] Proper Splitpanes implementation with resizable dividers
- [ ] Accessibility improvements (ARIA roles, keyboard nav, screen reader support)
  