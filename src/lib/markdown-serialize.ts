import type { Node, StatusDef } from "@/types";
import { DEFAULT_STATUSES } from "@/types";
import { initialRank, rankAfter } from "@/lib/rank";

// ── Inline marker regexes ──

const STATUS_RE = /\s*!status\(([^)]+)\)/;
const DUE_RE = /\s*@due\((\d{4}-\d{2}-\d{2})\)/;
const COLLAPSED_RE = /\s*!collapsed\b/;
const TAG_SUFFIX_RE = /(?:\s+#[\w-]+)+\s*$/;

// ── Serialize ──

export interface SerializeOptions {
  nodes: Map<string, Node>;
  rootId: string;
  statusConfig: StatusDef[];
}

export function serializeToMarkdown(opts: SerializeOptions): string {
  const { nodes, rootId, statusConfig } = opts;
  const lines: string[] = [];

  // YAML frontmatter — minimal when using default statuses
  lines.push("---");
  lines.push("doc-type: strata");
  if (!isDefaultStatuses(statusConfig)) {
    lines.push("statuses:");
    for (const s of statusConfig) {
      lines.push(`  - id: ${s.id}`);
      lines.push(`    label: "${s.label}"`);
      lines.push(`    color: "${s.color}"`);
      lines.push(`    icon: ${s.icon}`);
      if (s.final) {
        lines.push(`    final: true`);
      }
    }
  }
  lines.push("---");
  lines.push("");

  const defaultStatus = statusConfig[0]?.id ?? "todo";

  // Build id → label map for serialization
  const statusLabelById = new Map<string, string>();
  const statusFinalById = new Map<string, boolean>();
  for (const s of statusConfig) {
    statusLabelById.set(s.id, s.label);
    statusFinalById.set(s.id, s.final ?? false);
  }

  // Find final statuses for checkbox logic
  const finalStatuses = statusConfig.filter((s) => s.final);
  const firstFinalStatusId = finalStatuses[0]?.id;

  function getOrderedChildren(parentId: string): Node[] {
    const children: Node[] = [];
    for (const node of nodes.values()) {
      if (node.parentId === parentId && !node.deleted) {
        children.push(node);
      }
    }
    return children.sort((a, b) => (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0));
  }

  function walk(parentId: string, depth: number) {
    const children = getOrderedChildren(parentId);
    for (const child of children) {
      const indent = "  ".repeat(depth);
      const textLines = (child.text || "").split("\n");
      const firstLine = textLines[0] ?? "";

      // Determine checkbox state based on status finality
      const isFinal = statusFinalById.get(child.status) ?? false;
      const checkbox = isFinal ? "[x] " : "[ ] ";

      const meta: string[] = [];

      // Status marker logic:
      // - Omit if default status (non-final, checkbox will be [ ])
      // - Omit if it's the only final status (checkbox [x] implies it)
      // - Include if non-default non-final, or if multiple final statuses exist
      const shouldOmitStatus =
        child.status === defaultStatus ||
        (isFinal && finalStatuses.length === 1 && child.status === firstFinalStatusId);

      if (child.status && !shouldOmitStatus) {
        const label = statusLabelById.get(child.status) ?? child.status;
        meta.push(`!status(${label})`);
      }

      // Tags
      if (child.tags?.length) {
        meta.push(child.tags.map((t) => `#${t}`).join(" "));
      }

      // Due date
      if (child.dueDate) {
        const d = new Date(child.dueDate);
        const dateStr = d.toISOString().slice(0, 10);
        meta.push(`@due(${dateStr})`);
      }

      // Collapsed
      if (child.collapsed) {
        meta.push("!collapsed");
      }

      const suffix = meta.length > 0 ? "  " + meta.join(" ") : "";
      lines.push(`${indent}- ${checkbox}${firstLine}${suffix}`);

      // Continuation lines for multiline text
      for (let i = 1; i < textLines.length; i++) {
        lines.push(`${indent}  ${textLines[i]}`);
      }

      walk(child.id, depth + 1);
    }
  }

  walk(rootId, 0);
  return lines.join("\n") + "\n";
}

// ── Parse ──

export interface ParseResult {
  nodes: Map<string, Node>;
  rootId: string;
  statusConfig: StatusDef[];
}

export function parseMarkdown(content: string): ParseResult {
  const { frontmatter, body } = splitFrontmatter(content);
  const statusConfig = parseFrontmatterStatuses(frontmatter);
  const defaultStatus = statusConfig[0]?.id ?? "todo";

  // Build label → id map for resolving human-readable status labels
  const statusIdByLabel = new Map<string, string>();
  for (const s of statusConfig) {
    statusIdByLabel.set(s.label.toLowerCase(), s.id);
  }

  // Find first final status for checkbox mapping
  const firstFinalStatus = statusConfig.find((s) => s.final)?.id ?? defaultStatus;

  const rootId = crypto.randomUUID();
  const nodes = new Map<string, Node>();

  nodes.set(rootId, {
    id: rootId,
    parentId: null,
    pos: initialRank(),
    text: "Root",
    collapsed: false,
    status: defaultStatus,
    deleted: false,
    tags: [],
  });

  const lines = body.split("\n");
  // Stack tracks parent resolution: { id, depth }
  const stack: { id: string; depth: number }[] = [{ id: rootId, depth: -1 }];
  // Track last pos per parent to generate ordered positions
  const lastPosByParent = new Map<string, string>();
  // Track pending blank lines to preserve them within body text (but not trailing)
  let pendingBlankLines = 0;

  for (let li = 0; li < lines.length; li++) {
    const rawLine = lines[li]!;

    // Only match bullet items with checkboxes: - [ ] or - [x]
    const match = rawLine.match(/^(\s*)- \[( |x)\] (.*)$/);
    if (!match) {
      // Check if this is a continuation line for the previous node
      if (stack.length > 1) {
        const prevNode = nodes.get(stack[stack.length - 1]!.id);
        if (prevNode) {
          const prevDepth = stack[stack.length - 1]!.depth;
          const expectedIndent = "  ".repeat(prevDepth + 1);

          if (rawLine.trim() === "") {
            // Track blank lines to preserve them if more content follows
            pendingBlankLines++;
          } else if (rawLine.startsWith(expectedIndent) || rawLine.match(/^\s+/)) {
            // Flush pending blank lines before adding content
            for (let i = 0; i < pendingBlankLines; i++) {
              prevNode.text += "\n";
            }
            pendingBlankLines = 0;

            // Include bullet lists and other content as body text
            const trimmedLine = rawLine.replace(/^\s*/, "");
            prevNode.text += "\n" + trimmedLine;
          }
        }
      }
      continue;
    }

    // Reset pending blank lines when we hit a new checkbox item
    pendingBlankLines = 0;

    const indentStr = match[1]!;
    const depth = Math.floor(indentStr.length / 2);
    const isChecked = match[2] === "x";
    let lineContent = match[3]!

    // Extract status — resolve human-readable label to internal id
    // Explicit !status() takes precedence over checkbox state
    let status = defaultStatus;
    let hasExplicitStatus = false;
    const statusMatch = lineContent.match(STATUS_RE);
    if (statusMatch) {
      const raw = statusMatch[1]!;
      status = statusIdByLabel.get(raw.toLowerCase()) ?? raw;
      lineContent = lineContent.replace(STATUS_RE, "");
      hasExplicitStatus = true;
    }

    // If no explicit status but checkbox is checked, use first final status
    if (!hasExplicitStatus && isChecked) {
      status = firstFinalStatus;
    }

    // Extract collapsed
    let collapsed = false;
    if (COLLAPSED_RE.test(lineContent)) {
      collapsed = true;
      lineContent = lineContent.replace(COLLAPSED_RE, "");
    }

    // Extract due date
    let dueDate: number | null = null;
    const dueMatch = lineContent.match(DUE_RE);
    if (dueMatch) {
      dueDate = new Date(dueMatch[1]! + "T00:00:00").getTime();
      lineContent = lineContent.replace(DUE_RE, "");
    }

    // Extract tags from the end of the line
    const tags: string[] = [];
    const tagSuffixMatch = lineContent.match(TAG_SUFFIX_RE);
    if (tagSuffixMatch) {
      const tagStr = tagSuffixMatch[0];
      const tagMatches = tagStr.matchAll(/#([\w-]+)/g);
      for (const tm of tagMatches) {
        tags.push(tm[1]!);
      }
      lineContent = lineContent.slice(0, lineContent.length - tagStr.length);
    }

    const text = lineContent.trimEnd();

    // Pop stack to find parent at depth - 1
    while (stack.length > 1 && stack[stack.length - 1]!.depth >= depth) {
      stack.pop();
    }
    const parentId = stack[stack.length - 1]!.id;

    // Generate position key
    const lastPos = lastPosByParent.get(parentId);
    const pos = lastPos ? rankAfter(lastPos) : initialRank();
    lastPosByParent.set(parentId, pos);

    const id = crypto.randomUUID();
    nodes.set(id, {
      id,
      parentId,
      pos,
      text,
      collapsed,
      status,
      deleted: false,
      tags,
      dueDate,
    });

    stack.push({ id, depth });
  }

  return { nodes, rootId, statusConfig };
}

// ── Frontmatter helpers ──

function isDefaultStatuses(statuses: StatusDef[]): boolean {
  if (statuses.length !== DEFAULT_STATUSES.length) return false;
  return statuses.every((s, i) => {
    const d = DEFAULT_STATUSES[i]!;
    return (
      s.id === d.id &&
      s.label === d.label &&
      s.color === d.color &&
      s.icon === d.icon &&
      (s.final ?? false) === (d.final ?? false)
    );
  });
}

function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fmMatch) {
    return {
      frontmatter: fmMatch[1]!,
      body: content.slice(fmMatch[0]!.length),
    };
  }
  return { frontmatter: "", body: content };
}

function parseFrontmatterStatuses(fm: string): StatusDef[] {
  if (!fm.trim()) return [...DEFAULT_STATUSES];

  // If frontmatter has no statuses block, use defaults
  if (!fm.includes("statuses:")) return [...DEFAULT_STATUSES];

  const statuses: StatusDef[] = [];
  // Split on each "  - " entry (first split element is the "statuses:" header)
  const blocks = fm.split(/\n\s{2}- /);

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]!;
    const obj: Record<string, string> = {};
    const entryLines = block.split("\n");
    for (const line of entryLines) {
      // Match "key: value" or "key: \"value\""
      const m = line.match(/^\s*(\w+):\s*"?([^"]*?)"?\s*$/);
      if (m) obj[m[1]!] = m[2]!;
    }
    // First line of each block is the "id: ..." line
    const idMatch = entryLines[0]?.match(/^\s*id:\s*(.+)$/);
    if (idMatch) obj.id = idMatch[1]!.trim();

    if (obj.id && obj.label && obj.color && obj.icon) {
      statuses.push({
        id: obj.id,
        label: obj.label,
        color: obj.color,
        icon: obj.icon,
        final: obj.final === "true",
      });
    }
  }

  return statuses.length > 0 ? statuses : [...DEFAULT_STATUSES];
}
