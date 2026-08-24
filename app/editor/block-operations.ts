import type { MarkdownBlockRange } from "./block-types";
import {
  planMarkdownBlockDuplicate,
  planMarkdownBlockMove,
  resolveMarkdownBlockRanges,
  type MarkdownBlockChange,
} from "./rich-blocks";

export type StructuralBlockId = string & { readonly __structuralBlockId: unique symbol };
export type StructuralMoveDirection = "up" | "down";

export type StructuralSelection = {
  anchor: number;
  head: number;
};

export type StructuralBlockDescriptor = {
  id: StructuralBlockId;
  index: number;
  range: MarkdownBlockRange;
};

export type StructuralBlockOperation = {
  operation: "insertAfter" | "duplicate" | "move" | "moveTo";
  blockId: StructuralBlockId;
  changes: MarkdownBlockChange[];
  sourceRange: MarkdownBlockRange;
  resultRange: { from: number; to: number };
  selection: StructuralSelection;
  focus: "editor";
  announcement: string;
  userEvent: string;
};

function preferredLineBreak(source: string) {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, maximum));
}

function blockFingerprint(source: string, range: MarkdownBlockRange) {
  let hash = 2166136261;
  const value = `${range.kind}:${source.slice(range.from, range.to)}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function blockId(
  source: string,
  range: MarkdownBlockRange,
  index: number,
): StructuralBlockId {
  return `block:${index}:${range.from}:${range.to}:${blockFingerprint(source, range)}` as StructuralBlockId;
}

function lineNumberAt(source: string, position: number) {
  return (
    source.slice(0, clamp(position, 0, source.length)).match(/\r\n|\n|\r/gu)
      ?.length ?? 0
  ) + 1;
}

function structuralRanges(
  source: string,
  activeRange?: { from: number; to: number } | null,
) {
  const ranges = resolveMarkdownBlockRanges(source);
  if (!activeRange) return ranges;
  const from = clamp(activeRange.from, 0, source.length);
  const to = clamp(activeRange.to, from, source.length);
  const overlapping = ranges.filter(
    (range) =>
      (range.from < to && range.to > from) ||
      range.from === from ||
      (from === to && range.from <= from && range.to >= to),
  );
  const first = overlapping[0] ?? ranges.find(
    (range) => range.from <= from && range.to >= from,
  );
  if (!first) return ranges;
  const kind = overlapping.find((range) => range.kind !== "blank")?.kind ??
    first.kind;
  const merged: MarkdownBlockRange = {
    from,
    to,
    kind,
    lineFrom: lineNumberAt(source, from),
    lineTo: lineNumberAt(source, to),
  };
  return [
    ...ranges.filter((range) => range.from < from && range.to <= from),
    merged,
    ...ranges.filter((range) => range.from >= to && range.from !== from),
  ];
}

/**
 * A document-bound structural editing service. Every public mutation returns
 * one complete edit plan so UI adapters can commit it as exactly one undoable
 * transaction.
 */
export class StructuralBlockOperations {
  readonly blocks: StructuralBlockDescriptor[];

  private readonly byId: Map<StructuralBlockId, StructuralBlockDescriptor>;

  constructor(
    private readonly source: string,
    private readonly selection: StructuralSelection,
    activeRange?: { from: number; to: number } | null,
  ) {
    this.blocks = structuralRanges(source, activeRange).map((range, index) => ({
      id: blockId(source, range, index),
      index,
      range,
    }));
    this.byId = new Map(this.blocks.map((block) => [block.id, block]));
  }

  blockIdAt(position: number): StructuralBlockId {
    const safePosition = clamp(position, 0, this.source.length);
    const block = this.blocks.find(
      (candidate) =>
        safePosition >= candidate.range.from &&
        safePosition <= candidate.range.to,
    ) ?? this.blocks.at(-1);
    // structuralRanges always returns at least the empty document block.
    return block!.id;
  }

  blockIndexAt(position: number): number {
    const id = this.blockIdAt(position);
    return this.byId.get(id)!.index;
  }

  insertAfter(blockId: StructuralBlockId): StructuralBlockOperation | null {
    const block = this.byId.get(blockId);
    if (!block) return null;

    const lineBreak = preferredLineBreak(this.source);
    const nextBlock = this.blocks
      .slice(block.index + 1)
      .find((candidate) => candidate.range.kind !== "blank");
    const existingSeparator = nextBlock
      ? this.source.slice(block.range.to, nextBlock.range.from)
      : "";
    const separatorBreaks = existingSeparator.match(/\r\n|\n|\r/gu)?.length ?? 0;
    const insertedBreaks = nextBlock && separatorBreaks < 2 ? 3 : 2;
    const insert = lineBreak.repeat(insertedBreaks);
    const caret = block.range.to + lineBreak.length * 2;
    return {
      operation: "insertAfter",
      blockId,
      changes: [{ from: block.range.to, to: block.range.to, insert }],
      sourceRange: block.range,
      resultRange: { from: caret, to: caret },
      selection: { anchor: caret, head: caret },
      focus: "editor",
      announcement: "بلوک متن جدید اضافه شد.",
      userEvent: "input.block.commit.insertAfter",
    };
  }

  duplicate(blockId: StructuralBlockId): StructuralBlockOperation | null {
    const block = this.byId.get(blockId);
    if (!block) return null;

    const plan = planMarkdownBlockDuplicate(
      this.source,
      block.range.from,
      block.range,
    );
    const relative = this.relativeSelection(block.range);
    const blockLength = block.range.to - block.range.from;
    return {
      operation: "duplicate",
      blockId,
      changes: plan.changes,
      sourceRange: block.range,
      resultRange: {
        from: plan.selectionFrom,
        to: plan.selectionFrom + blockLength,
      },
      selection: {
        anchor: plan.selectionFrom + clamp(relative.anchor, 0, blockLength),
        head: plan.selectionFrom + clamp(relative.head, 0, blockLength),
      },
      focus: "editor",
      announcement: "بلوک تکثیر شد.",
      userEvent: "input.block.duplicate",
    };
  }

  move(
    blockId: StructuralBlockId,
    direction: StructuralMoveDirection,
  ): StructuralBlockOperation | null {
    const block = this.byId.get(blockId);
    if (!block) return null;

    const step = direction === "up" ? -1 : 1;
    let targetIndex = block.index + step;
    while (
      targetIndex >= 0 &&
      targetIndex < this.blocks.length &&
      this.blocks[targetIndex].range.kind === "blank"
    ) {
      targetIndex += step;
    }
    const targetBlock = this.blocks[targetIndex];
    if (!targetBlock) return null;
    return this.moveToRange(block, targetBlock, "move", direction);
  }

  moveTo(
    blockId: StructuralBlockId,
    targetIndex: number,
  ): StructuralBlockOperation | null {
    const block = this.byId.get(blockId);
    const target = this.blocks[targetIndex];
    if (!block || !target) return null;
    return this.moveToRange(block, target, "moveTo");
  }

  private relativeSelection(range: MarkdownBlockRange): StructuralSelection {
    const length = range.to - range.from;
    return {
      anchor: clamp(this.selection.anchor - range.from, 0, length),
      head: clamp(this.selection.head - range.from, 0, length),
    };
  }

  private moveToRange(
    block: StructuralBlockDescriptor,
    target: StructuralBlockDescriptor,
    operation: "move" | "moveTo",
    direction?: StructuralMoveDirection,
  ): StructuralBlockOperation | null {
    const plan = planMarkdownBlockMove(
      this.source,
      block.range.from,
      target.range.from,
      block.range,
      target.range,
    );
    if (!plan) return null;

    const relative = this.relativeSelection(block.range);
    const blockLength = block.range.to - block.range.from;
    return {
      operation,
      blockId: block.id,
      changes: plan.changes,
      sourceRange: block.range,
      resultRange: {
        from: plan.selectionFrom,
        to: plan.selectionFrom + blockLength,
      },
      selection: {
        anchor: plan.selectionFrom + clamp(relative.anchor, 0, blockLength),
        head: plan.selectionFrom + clamp(relative.head, 0, blockLength),
      },
      focus: "editor",
      announcement: operation === "move"
        ? direction === "up"
          ? "بلاک یک موقعیت به بالا منتقل شد."
          : "بلاک یک موقعیت به پایین منتقل شد."
        : "بلاک جابه‌جا شد.",
      userEvent: operation === "move" ? "input.block.move" : "input.block.moveTo",
    };
  }
}

export function createStructuralBlockOperations(
  source: string,
  selection: StructuralSelection,
  activeRange?: { from: number; to: number } | null,
) {
  return new StructuralBlockOperations(source, selection, activeRange);
}
