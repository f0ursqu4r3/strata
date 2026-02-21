import type { Node, StatusDef } from "@/types";
import { exportToMarkdown, exportToOPML, exportToPlaintext } from "@/lib/export-formats";

export type ExportFormat = "json" | "markdown" | "opml" | "plaintext";

export function buildExportJSON(opts: {
  nodes: Map<string, Node>;
  rootId: string;
  statusConfig: StatusDef[];
  tagColors: Record<string, string>;
}): string {
  const allNodes = Array.from(opts.nodes.values());
  const doc = {
    version: 3,
    rootId: opts.rootId,
    nodes: allNodes,
    statusConfig: opts.statusConfig,
    tagColors: opts.tagColors,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(doc, null, 2);
}

export function downloadExport(opts: {
  format: ExportFormat;
  nodes: Map<string, Node>;
  rootId: string;
  statusMap: Map<string, StatusDef>;
  statusConfig: StatusDef[];
  tagColors: Record<string, string>;
  zoomId: string | null;
}) {
  let content: string;
  let ext: string;
  let mime: string;

  switch (opts.format) {
    case "markdown":
      content = exportToMarkdown(opts.nodes, opts.rootId, opts.statusMap, opts.zoomId);
      ext = "md";
      mime = "text/markdown";
      break;
    case "opml":
      content = exportToOPML(opts.nodes, opts.rootId, opts.statusMap, opts.zoomId);
      ext = "opml";
      mime = "application/xml";
      break;
    case "plaintext":
      content = exportToPlaintext(opts.nodes, opts.rootId, opts.statusMap, opts.zoomId);
      ext = "txt";
      mime = "text/plain";
      break;
    default:
      content = buildExportJSON(opts);
      ext = "json";
      mime = "application/json";
      break;
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `strata-export-${new Date().toISOString().slice(0, 10)}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}
