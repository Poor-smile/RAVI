export type MarkdownTableRowInsertion = {
  from: number;
  insert: string;
  selectionFrom: number;
};

function tableColumnCount(line: string) {
  const trimmed = line.trim().replace(/^\|/u, "").replace(/\|$/u, "");
  return trimmed.split("|").length;
}

export function planMarkdownTableRowInsertion(
  source: string,
  blockFrom: number,
  blockTo: number,
): MarkdownTableRowInsertion | null {
  const safeFrom = Math.max(0, Math.min(blockFrom, source.length));
  const safeTo = Math.max(safeFrom, Math.min(blockTo, source.length));
  const block = source.slice(safeFrom, safeTo);
  const lines = block.split(/\r?\n/u).filter((line) => line.trim());
  if (lines.length < 2 || !lines[0]?.includes("|") || !lines[1]?.includes("|")) {
    return null;
  }

  const columns = tableColumnCount(lines[0]);
  if (columns < 2) return null;

  const lineBreak = source.includes("\r\n") ? "\r\n" : "\n";
  const trailingWhitespace = block.match(/(?:\r?\n)*$/u)?.[0] ?? "";
  const from = safeTo - trailingWhitespace.length;
  const row = `| ${Array.from({ length: columns }, () => "").join(" | ")} |`;
  const prefix = from > safeFrom ? lineBreak : block.trim() ? lineBreak : "";
  const insert = `${prefix}${row}`;

  return {
    from,
    insert,
    selectionFrom: from + prefix.length + 2,
  };
}

