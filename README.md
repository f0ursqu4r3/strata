<p align="center">
  <img src="ghpages/icon.png" alt="Strata" width="96" height="96">
</p>

<h1 align="center">Strata</h1>

<p align="center">
  A keyboard-first outliner with kanban, due dates, tags, and plain-text markdown files you actually own.
</p>

<p align="center">
  <a href="https://github.com/f0ursqu4r3/strata/releases/latest">Download</a>&nbsp;&middot;&nbsp;<a href="https://f0ursqu4r3.github.io/strata/">Website</a>
</p>

![Strata split view showing outline and kanban board](ghpages/assets/screenshot.png)

## What is Strata?

Strata is a task manager built around one idea: **your outline is the source of truth**.

You write everything as a nested list — tasks, notes, sub-tasks, whatever you need. That outline can be viewed as a tree (like WorkFlowy or Dynalist) or flipped into a kanban board grouped by status. Both views show the same data, so changes in one show up instantly in the other.

Your documents are plain `.md` files that live on your filesystem. Open them in any text editor, grep them from the terminal, version them with git. No accounts, no cloud, no lock-in.

## Features

**Three ways to look at your work** — Outline tree with infinite nesting and zoom. Kanban board with drag-and-drop between columns. Split view showing both side by side.

**Statuses, tags, and due dates** — Organize with custom statuses (Todo, In Progress, Done — or whatever you want). Tag items with `#hashtags`. Set due dates and filter by overdue, today, or this week.

**Keyboard-driven** — Navigate, edit, indent, change status, all without touching the mouse. Vim-style navigation if you want it. Every shortcut is customizable.

**Search everywhere** — Full-text search across the current document or all documents in your workspace. Command palette for quick actions.

**Themes** — Light and dark modes with 13 built-in themes including GitHub, Nord, Dracula, Solarized, Catppuccin, and Tokyo Night.

**Export** — JSON, Markdown, OPML, or plain text. Exports respect your current zoom level.

## File format

Strata documents are regular markdown files. The format is simple enough to write by hand and documented in [docs/file-format.md](docs/file-format.md).

```markdown
---
doc-type: strata
---

- [ ] Ship v1.0  #release
  - [x] Fix auth token refresh  #api
  - [ ] Write migration guide  !status(In Progress)  @due(2025-02-14)
  - [ ] Update changelog
  - [ ] Tag release on GitHub  !status(Blocked)
- [ ] Backlog  !collapsed
  - [ ] Dark mode improvements  #ui
  - [ ] Search performance  #perf
```

## Installation

Download the latest release for your platform:

| Platform | Download |
| --- | --- |
| macOS | [`.dmg`](https://github.com/f0ursqu4r3/strata/releases/latest) |
| Windows | [`.exe`](https://github.com/f0ursqu4r3/strata/releases/latest) |
| Linux | [`.AppImage` / `.deb`](https://github.com/f0ursqu4r3/strata/releases/latest) |

Strata also runs in the browser — just open the [web app](https://f0ursqu4r3.github.io/strata/) (Chromium-based browsers get filesystem access; others use local storage).

## How it works

**One tree, two views.** All data lives in a tree of nodes. The outline renders this tree directly. The kanban board is a *projection* — it groups the same nodes by status. Dragging a card between columns changes the node's status without moving it in the tree.

**Op-log under the hood.** Every change goes through an append-only operation log, which gives you undo/redo and lays the groundwork for future sync between devices.

**Files, not databases.** On desktop, documents are `.md` files on disk. Strata watches your workspace folder and picks up external edits automatically. In the browser, data is persisted to IndexedDB with an option to connect a local folder via the File System Access API.

## Development

Prerequisites: [Rust](https://rustup.rs/), [Bun](https://bun.sh/), and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform.

```sh
bun install
bun run tauri:dev    # desktop app
bun run dev          # web only
```

Build for production:

```sh
bun run tauri:build
```

### Tech stack

[Tauri 2](https://v2.tauri.app/) (Rust) &middot; [Vue 3](https://vuejs.org/) + [Pinia](https://pinia.vuejs.org/) &middot; [Tailwind CSS 4](https://tailwindcss.com/) &middot; [Vite](https://vite.dev/)

## License

MIT
