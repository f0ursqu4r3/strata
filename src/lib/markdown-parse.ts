import type { Node, StatusDef } from "@/types";
import { DEFAULT_STATUSES } from "@/types";
import { initialRank, rankAfter } from "@/lib/rank";

// ── Inline marker regexes ──

const STATUS_RE = /\s*!status\(([^)]+)\)/;
const DUE_RE = /\s*@due\((\d{4}-\d{2}-\d{2})\)/;
const COLLAPSED_RE = /\s*!collapsed\b/;
const TAG_SUFFIX_RE = /(?:\s+#[\w-]+)+\s*$/;

// ── Parse ──

export interface ParseResult {
  nodes: Map<string, Node>;
  rootId: string;
  statusConfig: StatusDef[];
  tagColors: Record<string, string>;
}

export function parseMarkdown(content: string): ParseResult {
  const { frontmatter, body } = splitFrontmatter(content);
  const statusConfig = parseFrontmatterStatuses(frontmatter);
  const tagColors = parseFrontmatterTagColors(frontmatter);
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

    // Match bullet items: with checkboxes (- [ ] / - [x]) or plain (- text)
    const cbMatch = rawLine.match(/^(\s*)- \[( |x)\] (.*)$/);
    const plainMatch = !cbMatch ? rawLine.match(/^(\s*)- (.+)$/) : null;
    if (!cbMatch && !plainMatch) {
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

    // Reset pending blank lines when we hit a new bullet item
    pendingBlankLines = 0;

    const indentStr = cbMatch ? cbMatch[1]! : plainMatch![1]!;
    const depth = Math.floor(indentStr.length / 2);
    const isChecked = cbMatch ? cbMatch[2] === "x" : false;
    let lineContent = cbMatch ? cbMatch[3]! : plainMatch![2]!

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

  return { nodes, rootId, statusConfig, tagColors };
}

// ── Frontmatter helpers ──

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

function parseFrontmatterTagColors(fm: string): Record<string, string> {
  if (!fm.trim() || !fm.includes("tag-colors:")) return {};

  const colors: Record<string, string> = {};
  const tcIdx = fm.indexOf("tag-colors:");
  const afterTc = fm.slice(tcIdx + "tag-colors:".length);
  const lines = afterTc.split("\n");
  for (const line of lines) {
    const m = line.match(/^\s{2}([\w-]+):\s*([\w-]+)\s*$/);
    if (m) {
      colors[m[1]!] = m[2]!;
    } else if (line.trim() && !line.startsWith("  ")) {
      // Reached next top-level key, stop
      break;
    }
  }
  return colors;
}
