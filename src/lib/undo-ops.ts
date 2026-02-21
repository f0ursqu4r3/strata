import type { Node, Op, Status } from "@/types";
import { makeOp } from "@/lib/ops";

/**
 * Given an undo entry's original op and the before-snapshot of the affected node,
 * produce the compensating op that restores the previous state.
 *
 * Also applies any necessary in-place mutations to the node in the map
 * (for ops like tombstone/restore/tag changes where snapshot restore alone
 * isn't sufficient).
 *
 * Returns the compensating op to persist.
 */
export function buildCompensatingOp(
  entry: { op: Op; beforeSnapshots: Node[] },
  nodes: Map<string, Node>,
): Op[] {
  const ops: Op[] = [];

  if (entry.op.type === "create") {
    const id = (entry.op.payload as { id: string }).id;
    const node = nodes.get(id);
    if (node) node.deleted = true;
    ops.push(makeOp("tombstone", { type: "tombstone", id }));
    return ops;
  }

  for (const snap of entry.beforeSnapshots) {
    const op = buildCompensatingOpForSnap(entry.op, snap, nodes);
    if (op) ops.push(op);
  }
  return ops;
}

function buildCompensatingOpForSnap(
  originalOp: Op,
  snap: Node,
  nodes: Map<string, Node>,
): Op | null {
  switch (originalOp.type) {
    case "updateText":
      return makeOp("updateText", {
        type: "updateText",
        id: snap.id,
        text: snap.text,
      });

    case "move":
      return makeOp("move", {
        type: "move",
        id: snap.id,
        parentId: snap.parentId,
        pos: snap.pos,
      });

    case "setStatus":
      return makeOp("setStatus", {
        type: "setStatus",
        id: snap.id,
        status: snap.status,
      });

    case "toggleCollapsed":
      return makeOp("toggleCollapsed", { type: "toggleCollapsed", id: snap.id });

    case "tombstone": {
      const node = nodes.get(snap.id);
      if (node) {
        node.deleted = false;
        node.deletedAt = undefined;
      }
      return makeOp("create", {
        type: "create",
        id: snap.id,
        parentId: snap.parentId,
        pos: snap.pos,
        text: snap.text,
        status: snap.status,
      });
    }

    case "addTag": {
      const node = nodes.get(snap.id);
      if (node) node.tags = snap.tags ? [...snap.tags] : [];
      const tag = (originalOp.payload as { tag: string }).tag;
      return makeOp("removeTag", { type: "removeTag", id: snap.id, tag });
    }

    case "removeTag": {
      const node = nodes.get(snap.id);
      if (node) node.tags = snap.tags ? [...snap.tags] : [];
      const tag = (originalOp.payload as { tag: string }).tag;
      return makeOp("addTag", { type: "addTag", id: snap.id, tag });
    }

    case "restore": {
      const node = nodes.get(snap.id);
      if (node) {
        node.deleted = snap.deleted;
        node.deletedAt = snap.deletedAt;
      }
      return makeOp("tombstone", { type: "tombstone", id: snap.id });
    }

    case "setDueDate": {
      const node = nodes.get(snap.id);
      if (node) node.dueDate = snap.dueDate;
      return makeOp("setDueDate", {
        type: "setDueDate",
        id: snap.id,
        dueDate: snap.dueDate ?? null,
      });
    }

    default:
      return null;
  }
}
