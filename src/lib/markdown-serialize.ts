import type { Node, StatusDef } from "@/types";
import { DEFAULT_STATUSES } from "@/types";
import { getOrderedChildren } from "@/lib/tree-utils";

// Re-export parse from its own module for backward compatibility
export { parseMarkdown, type ParseResult } from "@/lib/markdown-parse";

// ── Serialize ──

export interface SerializeOptions {
  nodes: Map<string, Node>;
  rootId: string;
  statusConfig: StatusDef[];
  tagColors?: Record<string, string>;
}

export function serializeToMarkdown(opts: SerializeOptions): string {
  const { nodes, rootId, statusConfig, tagColors } = opts;
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
  if (tagColors && Object.keys(tagColors).length > 0) {
    lines.push("tag-colors:");
    for (const [tag, color] of Object.entries(tagColors)) {
      lines.push(`  ${tag}: ${color}`);
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

  function walk(parentId: string, depth: number) {
    const children = getOrderedChildren(nodes, parentId);
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

// ── Helpers ──

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
