# Strata File Format

Strata documents are plain `.md` files with YAML frontmatter. This page describes the format so that AI agents, scripts, and external editors can read and write Strata files correctly.

## Frontmatter

Every Strata file starts with a YAML frontmatter block. The only required field is `doc-type: strata`.

```yaml
---
doc-type: strata
---
```

### Custom statuses

Statuses can be customized per document. If omitted, the defaults below are used.

```yaml
---
doc-type: strata
statuses:
  - id: todo
    label: Todo
    color: "#94a3b8"
    icon: circle
  - id: in_progress
    label: In Progress
    color: "#3b82f6"
    icon: circle-dot
  - id: blocked
    label: Blocked
    color: "#ef4444"
    icon: circle-alert
  - id: done
    label: Done
    color: "#22c55e"
    icon: circle-check
    final: true
---
```

Each status has:

| Field   | Description                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------- |
| `id`    | Internal identifier (snake_case)                                                                                    |
| `label` | Human-readable name shown in the UI and used in `!status()` markers                                                 |
| `color` | Hex color for the status badge                                                                                      |
| `icon`  | Lucide icon name                                                                                                    |
| `final` | (optional) If `true`, this status represents completion. Items with this status are serialized with `[x]` checkbox. |

The **first status** in the list is the default. Nodes without an explicit `!status()` marker are assigned this status.

### Tag colors

Per-document tag colors can be defined in frontmatter. Each entry maps a tag name to a color preset key.

```yaml
---
doc-type: strata
tag-colors:
  backend: orange
  design: purple
  docs: blue
---
```

Available color keys: `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `pink`. If omitted, tags use the default accent color.

Tag colors are optional. If the `tag-colors` block is absent, all tags render with the theme's accent color.

## Document body

The body is a nested bullet list. Each item starts with `- ` followed by a checkbox (`[ ]` or `[x]`), and nesting uses **2-space indentation**.

```markdown
- [ ] Top level item
  - [ ] Child item
    - [ ] Grandchild
  - [x] Completed child
- [ ] Another top level item
```

### Checkbox syntax

Every item uses checkbox syntax:

- `[ ]` — unchecked (status is not "final")
- `[x]` — checked (status has `final: true`, e.g., Done)

The checkbox state syncs with the status system:

- When parsing, `[x]` sets the status to the first `final` status (unless an explicit `!status()` overrides it)
- When serializing, items with a `final` status are written as `[x]`, others as `[ ]`

### Multiline text

Continuation lines are indented to the same depth as the item's children (parent indent + 2 spaces) and do **not** start with `- `:

```markdown
- [ ] First line of text
  This is still part of the same item.
  So is this.
  - [ ] This is a child item
```

## Inline markers

Markers are appended to the first line of an item (after the checkbox), separated from the text by **two spaces**. Multiple markers are separated by a single space.

```markdown
- [ ] Ship v1.0  !status(In Progress)  #release  @due(2025-06-01)
```

### `!status(Label)`

Sets the item's status. The value inside the parentheses is the human-readable **label**, matched case-insensitively.

```markdown
- [x] Fix auth bug
- [ ] Write docs  !status(In Progress)
- [ ] Deploy  !status(Blocked)
```

Status marker rules:

- If omitted, the item gets the default status (first in the list, typically "Todo")
- The default status is **not written** to the file
- If there is only one `final` status and the checkbox is `[x]`, the `!status()` marker is omitted (the checkbox implies it)
- If there are multiple `final` statuses, include `!status()` to disambiguate

### `#tag`

Assigns one or more tags. Tags can contain letters, numbers, and hyphens.

```markdown
- [ ] Improve search  #perf #backend
- [ ] Update colors  #ui
```

### `@due(YYYY-MM-DD)`

Sets a due date in ISO 8601 format.

```markdown
- [ ] Submit report  @due(2025-03-15)
```

### `!collapsed`

Marks the node as collapsed in the outline view. No arguments.

```markdown
- [ ] Archived tasks  !collapsed
  - [ ] Old task 1
  - [x] Old task 2
```

## Marker order

Markers can appear in any order. The conventional order is:

```text
- [ ] Text  !status(Label)  #tag1 #tag2  @due(YYYY-MM-DD)  !collapsed
```

## Complete example

```markdown
---
doc-type: strata
tag-colors:
  release: blue
  api: green
  ui: purple
  perf: orange
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

## Rules for agents

1. **Always include frontmatter** with at least `doc-type: strata`.
2. **Use 2-space indentation** for nesting. No tabs.
3. **Always use checkbox syntax** — every item must start with `- [ ]` or `- [x]`.
4. **Use `[x]` for final statuses** (like Done) and `[ ]` for all others.
5. **Use human-readable labels** in `!status()`, not internal IDs.
6. **Do not write the default status**. If a node is "Todo" (or whatever the first status is), omit the `!status()` marker entirely.
7. **Omit redundant `!status()` for final statuses**. If there is only one `final` status and the item is `[x]`, the status is implied.
8. **Separate markers from text with two spaces**, and separate markers from each other with two spaces.
9. **Dates must be `YYYY-MM-DD`** format inside `@due()`.
10. **Tags are `#word`** where word is `[\w-]+` (letters, digits, hyphens, underscores).
11. **Preserve ordering**. The order of items in the file is their display order. Do not reorder items unless asked to.
12. **Do not add blank lines** between list items — blank lines are treated as continuation line separators.
13. **Round-trip fidelity**. If you read a file and write it back without changes, the output should be identical to the input.
14. **Preserve tag-colors**. If the file has a `tag-colors` block, keep it. Valid color keys are: `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `pink`.
