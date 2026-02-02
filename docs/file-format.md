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
---
```

Each status has:

| Field | Description |
| --- | --- |
| `id` | Internal identifier (snake_case) |
| `label` | Human-readable name shown in the UI and used in `!status()` markers |
| `color` | Hex color for the status badge |
| `icon` | Lucide icon name |

The **first status** in the list is the default. Nodes without an explicit `!status()` marker are assigned this status.

## Document body

The body is a nested bullet list. Each item starts with `- ` and nesting uses **2-space indentation**.

```markdown
- Top level item
  - Child item
    - Grandchild
  - Another child
- Another top level item
```

### Multiline text

Continuation lines are indented to the same depth as the item's children (parent indent + 2 spaces) and do **not** start with `- `:

```markdown
- First line of text
  This is still part of the same item.
  So is this.
  - This is a child item
```

## Inline markers

Markers are appended to the first line of an item, separated from the text by **two spaces**. Multiple markers are separated by a single space.

```markdown
- Ship v1.0  !status(In Progress)  #release  @due(2025-06-01)
```

### `!status(Label)`

Sets the item's status. The value inside the parentheses is the human-readable **label**, matched case-insensitively.

```markdown
- Fix auth bug  !status(Done)
- Write docs  !status(In Progress)
- Deploy  !status(Blocked)
```

If omitted, the item gets the default status (first in the list, typically "Todo"). The default status is **not written** to the file — omitting it is the correct representation.

### `#tag`

Assigns one or more tags. Tags can contain letters, numbers, and hyphens.

```markdown
- Improve search  #perf #backend
- Update colors  #ui
```

### `@due(YYYY-MM-DD)`

Sets a due date in ISO 8601 format.

```markdown
- Submit report  @due(2025-03-15)
```

### `!collapsed`

Marks the node as collapsed in the outline view. No arguments.

```markdown
- Archived tasks  !collapsed
  - Old task 1
  - Old task 2
```

## Marker order

Markers can appear in any order. The conventional order is:

```
- Text  !status(Label)  #tag1 #tag2  @due(YYYY-MM-DD)  !collapsed
```

## Complete example

```markdown
---
doc-type: strata
---

- Ship v1.0  #release
  - Fix auth token refresh  !status(Done)  #api
  - Write migration guide  !status(In Progress)  @due(2025-02-14)
  - Update changelog
  - Tag release on GitHub  !status(Blocked)
- Backlog  !collapsed
  - Dark mode improvements  #ui
  - Search performance  #perf
```

## Rules for agents

1. **Always include frontmatter** with at least `doc-type: strata`.
2. **Use 2-space indentation** for nesting. No tabs.
3. **Use human-readable labels** in `!status()`, not internal IDs.
4. **Do not write the default status**. If a node is "Todo" (or whatever the first status is), omit the `!status()` marker entirely.
5. **Separate markers from text with two spaces**, and separate markers from each other with two spaces.
6. **Dates must be `YYYY-MM-DD`** format inside `@due()`.
7. **Tags are `#word`** where word is `[\w-]+` (letters, digits, hyphens, underscores).
8. **Preserve ordering**. The order of items in the file is their display order. Do not reorder items unless asked to.
9. **Do not add blank lines** between list items — blank lines are treated as continuation line separators.
10. **Round-trip fidelity**. If you read a file and write it back without changes, the output should be identical to the input.
