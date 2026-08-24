import type { AiFrozenContext } from "./types";

export function currentFrozenText(context: AiFrozenContext, document: string) {
  if (context.source === "table") return context.content;
  if (context.from === undefined || context.to === undefined) return null;
  return document.slice(context.from, context.to);
}

export function frozenContextIsCurrent(
  context: AiFrozenContext,
  document: string,
  tableValue?: string,
  tableKey?: string,
) {
  if (context.kind === "document") return context.content === document;
  if (context.source === "table") {
    return tableKey === context.tableKey && tableValue === context.content;
  }
  return currentFrozenText(context, document) === context.content;
}

export function frozenBlockIsCurrent(
  context: AiFrozenContext,
  document: string,
) {
  if (
    context.blockFrom === undefined ||
    context.blockTo === undefined ||
    context.blockContent === undefined
  ) return false;
  return document.slice(context.blockFrom, context.blockTo) === context.blockContent;
}

export function insertionAfterBlock(document: string, to: number, insert: string) {
  const before = document.slice(0, to);
  const after = document.slice(to);
  const prefix = before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const suffix = !after || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  return { from: to, to, insert: `${prefix}${insert}${suffix}` };
}
