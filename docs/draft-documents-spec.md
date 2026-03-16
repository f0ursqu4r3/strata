# Draft Documents Spec

## Overview

New documents start as drafts in `.strata/drafts/` instead of being written directly to the workspace. They remain ephemeral until explicitly saved, similar to VSCode's untitled documents.

## Behavior

### Creating a draft
- File > New Document (or Cmd+N / sidebar +) creates a draft
- Draft is written to `.strata/drafts/{uuid}.md` with standard Strata frontmatter
- Draft appears in sidebar with an "unsaved" visual indicator (dot or italic name)
- Draft is immediately editable — no save dialog

### Saving a draft
- Cmd+S on a draft triggers "Save As" flow:
  - Prompts for document name (pre-filled with first line of text or "Untitled")
  - Optionally pick a subfolder within the workspace
  - Moves the file from `.strata/drafts/{uuid}.md` to `{workspace}/{name}.md`
  - Document becomes a regular filesystem document (indicator removed)
- Context menu: "Save to Workspace..." action on draft documents

### Closing a draft
- Closing a draft (Cmd+W or sidebar delete) shows a confirmation:
  - "Save this document before closing?" with Save / Discard / Cancel
  - Save: triggers the save flow, then closes
  - Discard: deletes the draft file, removes from sidebar
  - Cancel: keeps the draft open

### Quitting
- On app quit, drafts are left as-is in `.strata/drafts/`
- They persist across sessions

### Startup
- On workspace load, scan `.strata/drafts/` for any existing drafts
- Add them to the document list with the draft indicator
- Open the last-active document (draft or saved)

### Visual indicator
- Sidebar: draft documents show a dot or italic styling to distinguish from saved docs
- Toolbar: document name shows "(draft)" suffix or similar

## Implementation

### Filesystem
- `.strata/drafts/` directory created on first draft, inside workspace root
- Add `.strata/` to awareness (don't list as regular workspace docs)
- Draft files use UUID filenames to avoid conflicts: `.strata/drafts/abc123.md`
- The display name comes from the file content (first heading or "Untitled")

### Document registry
- `DocumentMeta` gains an `isDraft: boolean` field
- `createDocument()` splits into `createDraft()` and `saveDraft(draftId, name, folder?)`
- Draft documents have `id` = `.strata/drafts/{uuid}.md` (relative path, same as regular docs)

### Store changes
- `documents.ts`: `createDraft()`, `saveDraft()`, `discardDraft()`, `isDraft(id)`
- `doc.ts`: No changes needed — drafts are regular .md files, just in a different folder
- `settings.ts`: No changes needed

### Tauri backend
- `list_workspace_files` already walks subdirectories — need to EXCLUDE `.strata/` from regular listing
- New or modified: `list_draft_files` to scan `.strata/drafts/` specifically
- `ensure_dir` already exists — use for creating `.strata/drafts/`

### Keyboard
- Cmd+S: if current doc is a draft, trigger save flow; if saved doc, no-op (auto-saves)
- Cmd+Shift+S: "Save As" for any document (drafts or saved)

### Files to modify
- `src/stores/documents.ts` — draft CRUD, isDraft check, startup scan
- `src/components/sidebar/DocumentSidebar.vue` — draft visual indicator
- `src/components/sidebar/FolderTreeItem.vue` — draft styling
- `src/components/sidebar/DocumentContextMenu.vue` — "Save to Workspace" action for drafts
- `src/composables/useGlobalKeyboard.ts` or `src/lib/menu-handler.ts` — Cmd+S handler
- `src/App.vue` — draft indicator in toolbar title
- `src-tauri/src/lib.rs` — exclude `.strata/` from workspace file listing
- New: `src/components/overlays/SaveDraftModal.vue` — name/folder picker for saving drafts
