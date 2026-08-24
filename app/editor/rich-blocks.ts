import type {
  MarkdownBlockKind,
  MarkdownBlockRange,
} from "./block-types";

export type FenceDescriptor = {
  language: string;
  code: string;
  mermaid: boolean;
};

export type TableDescriptor = {
  headers: string[];
  rows: string[][];
  alignments: Array<"start" | "center" | "end">;
};

export type ImageDescriptor = {
  alt: string;
  source: string;
  title: string;
};

export type CalloutDescriptor = {
  kind: "note" | "tip" | "important" | "warning";
  title: string;
  body: string;
};

const CALLOUT_TITLES: Record<CalloutDescriptor["kind"], string> = {
  note: "یادداشت",
  tip: "نکته",
  important: "مهم",
  warning: "هشدار",
};

type MarkdownSourceLine = {
  number: number;
  from: number;
  to: number;
  breakTo: number;
  text: string;
};

export type MarkdownBlockChange = {
  from: number;
  to: number;
  insert: string;
};

export type MarkdownBlockEditPlan = {
  changes: MarkdownBlockChange[];
  selectionFrom: number;
  selectionTo: number;
  sourceRange: MarkdownBlockRange;
};

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/u;
const FORMULA_EDGE = /^\s*\$\$/u;
const ATX_HEADING = /^ {0,3}#{1,6}(?:[\t ]+|$)/u;
const SETEXT_HEADING = /^ {0,3}(?:=+|-+)[\t ]*$/u;
const QUOTE_LINE = /^ {0,3}>/u;
const LIST_ITEM = /^([\t ]*)(?:[-+*]|\d{1,9}[.)])(?:[\t ]+|$)/u;
const IMAGE_LINE = /^\s*!\[[^\]]*\]\(.*\)\s*$/u;
const TABLE_DELIMITER = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/u;

function markdownSourceLines(source: string): MarkdownSourceLine[] {
  if (!source.length) {
    return [{ number: 1, from: 0, to: 0, breakTo: 0, text: "" }];
  }

  const lines: MarkdownSourceLine[] = [];
  let from = 0;
  let number = 1;
  while (from < source.length) {
    const breakMatch = /\r\n|\n|\r/gu.exec(source.slice(from));
    const to = breakMatch ? from + (breakMatch.index ?? 0) : source.length;
    const breakTo = breakMatch ? to + breakMatch[0].length : to;
    lines.push({ number, from, to, breakTo, text: source.slice(from, to) });
    number += 1;
    from = breakTo;
  }
  if (/\r\n$|[\n\r]$/u.test(source)) {
    lines.push({
      number,
      from: source.length,
      to: source.length,
      breakTo: source.length,
      text: "",
    });
  }
  return lines;
}

function rangeFromLines(
  lines: MarkdownSourceLine[],
  start: number,
  end: number,
  kind: MarkdownBlockKind,
): MarkdownBlockRange {
  return {
    from: lines[start].from,
    to: lines[end].to,
    kind,
    lineFrom: lines[start].number,
    lineTo: lines[end].number,
  };
}

function fenceCloseExpression(marker: string) {
  const character = marker[0] === "`" ? "`" : "~";
  return new RegExp(`^ {0,3}${character}{${marker.length},}[ \\t]*$`, "u");
}

function isFormulaClose(line: string) {
  return /^\s*\$\$\s*$/u.test(line) || /\$\$\s*$/u.test(line.trimStart());
}

function isTableStart(lines: MarkdownSourceLine[], index: number) {
  return (
    index + 1 < lines.length &&
    lines[index].text.includes("|") &&
    TABLE_DELIMITER.test(lines[index + 1].text)
  );
}

function listEnd(lines: MarkdownSourceLine[], start: number) {
  const baseIndent = LIST_ITEM.exec(lines[start].text)?.[1].length ?? 0;
  let end = start;
  let index = start + 1;
  while (index < lines.length) {
    const text = lines[index].text;
    if (!text.trim()) {
      let next = index + 1;
      while (next < lines.length && !lines[next].text.trim()) next += 1;
      const nextText = lines[next]?.text ?? "";
      const nextList = LIST_ITEM.exec(nextText);
      const nextIndent = nextText.match(/^[\t ]*/u)?.[0].length ?? 0;
      if (next < lines.length && (nextList || nextIndent > baseIndent)) {
        end = next - 1;
        index = next;
        continue;
      }
      break;
    }

    const marker = LIST_ITEM.exec(text);
    const indentation = text.match(/^[\t ]*/u)?.[0].length ?? 0;
    if (marker || indentation > baseIndent) {
      end = index;
      index += 1;
      continue;
    }
    if (
      FENCE_OPEN.test(text) ||
      FORMULA_EDGE.test(text) ||
      ATX_HEADING.test(text) ||
      QUOTE_LINE.test(text) ||
      IMAGE_LINE.test(text) ||
      isTableStart(lines, index)
    ) {
      break;
    }
    // In the block editor, an unindented plain line is an adjacent Text Block.
    break;
  }
  return end;
}

/** Resolves every source character to exactly one complete Markdown block. */
export function resolveMarkdownBlockRanges(source: string): MarkdownBlockRange[] {
  const lines = markdownSourceLines(source);
  const ranges: MarkdownBlockRange[] = [];
  let index = 0;

  while (index < lines.length) {
    const text = lines[index].text;
    if (!text.trim()) {
      ranges.push(rangeFromLines(lines, index, index, "blank"));
      index += 1;
      continue;
    }

    const fence = FENCE_OPEN.exec(text);
    if (fence) {
      const close = fenceCloseExpression(fence[1]);
      let end = index + 1;
      while (end < lines.length && !close.test(lines[end].text)) end += 1;
      end = Math.min(end, lines.length - 1);
      const language = fence[2].trim().split(/\s+/u)[0]?.toLowerCase() ?? "";
      ranges.push(
        rangeFromLines(lines, index, end, language === "mermaid" ? "mermaid" : "code"),
      );
      index = end + 1;
      continue;
    }

    if (FORMULA_EDGE.test(text)) {
      const rest = text.replace(FORMULA_EDGE, "");
      let end = /\$\$\s*$/u.test(rest) ? index : index + 1;
      while (end < lines.length && !isFormulaClose(lines[end].text)) end += 1;
      end = Math.min(end, lines.length - 1);
      ranges.push(rangeFromLines(lines, index, end, "formula"));
      index = end + 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      let end = index + 1;
      while (
        end + 1 < lines.length &&
        lines[end + 1].text.trim() &&
        lines[end + 1].text.includes("|")
      ) {
        end += 1;
      }
      ranges.push(rangeFromLines(lines, index, end, "table"));
      index = end + 1;
      continue;
    }

    if (LIST_ITEM.test(text)) {
      const end = listEnd(lines, index);
      ranges.push(rangeFromLines(lines, index, end, "list"));
      index = end + 1;
      continue;
    }

    if (QUOTE_LINE.test(text)) {
      let end = index;
      while (end + 1 < lines.length && QUOTE_LINE.test(lines[end + 1].text)) end += 1;
      ranges.push(rangeFromLines(lines, index, end, "quote"));
      index = end + 1;
      continue;
    }

    if (ATX_HEADING.test(text)) {
      ranges.push(rangeFromLines(lines, index, index, "heading"));
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && SETEXT_HEADING.test(lines[index + 1].text)) {
      ranges.push(rangeFromLines(lines, index, index + 1, "heading"));
      index += 2;
      continue;
    }

    if (IMAGE_LINE.test(text)) {
      ranges.push(rangeFromLines(lines, index, index, "image"));
      index += 1;
      continue;
    }

    let end = index;
    while (end + 1 < lines.length) {
      const next = lines[end + 1].text;
      if (
        !next.trim() ||
        FENCE_OPEN.test(next) ||
        FORMULA_EDGE.test(next) ||
        isTableStart(lines, end + 1) ||
        LIST_ITEM.test(next) ||
        QUOTE_LINE.test(next) ||
        ATX_HEADING.test(next) ||
        IMAGE_LINE.test(next) ||
        (end + 2 < lines.length && SETEXT_HEADING.test(lines[end + 2].text))
      ) {
        break;
      }
      end += 1;
    }
    ranges.push(rangeFromLines(lines, index, end, "text"));
    index = end + 1;
  }

  return ranges;
}

export function resolveMarkdownBlockRange(
  source: string,
  position: number,
): MarkdownBlockRange {
  const safePosition = Math.max(0, Math.min(position, source.length));
  const ranges = resolveMarkdownBlockRanges(source);
  return (
    ranges.find((range, index) => {
      const next = ranges[index + 1];
      return safePosition >= range.from && (!next || safePosition < next.from);
    }) ?? ranges[ranges.length - 1]
  );
}

export function resolveAdjacentMarkdownBlockRange(
  source: string,
  position: number,
  direction: -1 | 1,
): MarkdownBlockRange | null {
  const ranges = resolveMarkdownBlockRanges(source);
  const current = resolveMarkdownBlockRange(source, position);
  let index = ranges.findIndex(
    (range) => range.from === current.from && range.to === current.to,
  );
  for (index += direction; index >= 0 && index < ranges.length; index += direction) {
    if (ranges[index].kind !== "blank") return ranges[index];
  }
  return null;
}

function preferredLineBreak(source: string) {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

/** Plans insertion after the complete active block without replacing a neighbor. */
export function planMarkdownBlockInsertion(
  source: string,
  position: number,
  markdown: string,
  sourceRangeOverride?: MarkdownBlockRange,
): MarkdownBlockEditPlan {
  const sourceRange = sourceRangeOverride ??
    resolveMarkdownBlockRange(source, position);
  const separator = `${preferredLineBreak(source)}${preferredLineBreak(source)}`;
  const insert = `${separator}${markdown}`;
  const selectionFrom = sourceRange.to + separator.length;
  return {
    changes: [{ from: sourceRange.to, to: sourceRange.to, insert }],
    selectionFrom,
    selectionTo: selectionFrom + markdown.length,
    sourceRange,
  };
}

/** Plans a whole-block duplicate. The source and its neighbors are never sliced. */
export function planMarkdownBlockDuplicate(
  source: string,
  position: number,
  sourceRangeOverride?: MarkdownBlockRange,
): MarkdownBlockEditPlan {
  const sourceRange = sourceRangeOverride ??
    resolveMarkdownBlockRange(source, position);
  return planMarkdownBlockInsertion(
    source,
    position,
    source.slice(sourceRange.from, sourceRange.to),
    sourceRange,
  );
}

/** Plans an arbitrary whole-block move using CodeMirror-compatible source edits. */
export function planMarkdownBlockMove(
  source: string,
  sourcePosition: number,
  targetPosition: number,
  sourceRangeOverride?: MarkdownBlockRange,
  targetRangeOverride?: MarkdownBlockRange,
): MarkdownBlockEditPlan | null {
  const sourceRange = sourceRangeOverride ??
    resolveMarkdownBlockRange(source, sourcePosition);
  const targetRange = targetRangeOverride ??
    resolveMarkdownBlockRange(source, targetPosition);
  if (
    targetRange.from === sourceRange.from ||
    (targetRange.from >= sourceRange.from && targetRange.from < sourceRange.to)
  ) {
    return null;
  }

  const sourceText = source.slice(sourceRange.from, sourceRange.to);
  if (sourceRange.from < targetRange.from) {
    let deleteTo = sourceRange.to;
    while (deleteTo < source.length && /[\r\n]/u.test(source[deleteTo])) deleteTo += 1;
    const separator = source.slice(sourceRange.to, deleteTo) || preferredLineBreak(source);
    const removedLength = deleteTo - sourceRange.from;
    const selectionFrom = Math.max(
      0,
      targetRange.to - removedLength + separator.length,
    );
    return {
      changes: [
        { from: sourceRange.from, to: deleteTo, insert: "" },
        { from: targetRange.to, to: targetRange.to, insert: `${separator}${sourceText}` },
      ],
      selectionFrom,
      selectionTo: selectionFrom,
      sourceRange,
    };
  }

  let deleteFrom = sourceRange.from;
  while (deleteFrom > 0 && /[\r\n]/u.test(source[deleteFrom - 1])) deleteFrom -= 1;
  const separator = source.slice(deleteFrom, sourceRange.from) || preferredLineBreak(source);
  return {
    changes: [
      { from: targetRange.from, to: targetRange.from, insert: `${sourceText}${separator}` },
      { from: deleteFrom, to: sourceRange.to, insert: "" },
    ],
    selectionFrom: targetRange.from,
    selectionTo: targetRange.from,
    sourceRange,
  };
}

export function parseFence(source: string): FenceDescriptor | null {
  const normalized = source.replace(/\r\n?/gu, "\n");
  const lines = normalized.split("\n");
  const opening = /^( {0,3})(`{3,}|~{3,})([^\n]*)$/u.exec(lines[0] ?? "");
  if (!opening || lines.length < 2) return null;
  const marker = opening[2][0];
  const closing = new RegExp(`^ {0,3}${marker === "`" ? "`" : "~"}{${opening[2].length},}[ \\t]*$`, "u");
  const last = lines.findLastIndex((line, index) => index > 0 && closing.test(line));
  if (last < 1) return null;
  const language = opening[3].trim().split(/\s+/u)[0]?.toLowerCase() ?? "";
  return {
    language,
    code: lines.slice(1, last).join("\n"),
    mermaid: language === "mermaid",
  };
}

export function splitMarkdownTableRow(source: string) {
  const trimmed = source.trim().replace(/^\|/u, "").replace(/\|$/u, "");
  const cells: string[] = [];
  let cell = "";
  let escaped = false;
  let codeFence = 0;
  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    if (escaped) {
      cell += character;
      escaped = false;
    } else if (character === "\\") {
      cell += character;
      escaped = true;
    } else if (character === "`") {
      codeFence = codeFence ? 0 : 1;
      cell += character;
    } else if (character === "|" && !codeFence) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

export function parseGfmTable(source: string): TableDescriptor | null {
  const lines = source.replace(/\r\n?/gu, "\n").split("\n").filter(Boolean);
  if (lines.length < 2) return null;
  const headers = splitMarkdownTableRow(lines[0]);
  const delimiter = splitMarkdownTableRow(lines[1]);
  if (
    !headers.length ||
    delimiter.length !== headers.length ||
    delimiter.some((cell) => !/^:?-{3,}:?$/u.test(cell.replace(/\s/gu, "")))
  ) return null;
  const alignments = delimiter.map((cell) => {
    const compact = cell.replace(/\s/gu, "");
    if (compact.startsWith(":") && compact.endsWith(":")) return "center";
    if (compact.endsWith(":")) return "end";
    return "start";
  });
  const rows = lines.slice(2).map((line) => {
    const row = splitMarkdownTableRow(line).slice(0, headers.length);
    while (row.length < headers.length) row.push("");
    return row;
  });
  return { headers, rows, alignments };
}

function portableTableCell(value: string) {
  return value
    .replace(/\r\n?|\n/gu, " ")
    .replace(/(?<!\\)\|/gu, "\\|")
    .trim();
}

/** Serializes the editable grid back to ordinary portable GFM Markdown. */
export function serializeGfmTable(table: TableDescriptor) {
  const columnCount = Math.max(2, table.headers.length);
  const headers = Array.from(
    { length: columnCount },
    (_, index) => portableTableCell(table.headers[index] ?? `ستون ${index + 1}`),
  );
  const delimiters = Array.from({ length: columnCount }, (_, index) => {
    const alignment = table.alignments[index] ?? "start";
    return alignment === "center" ? ":---:" : alignment === "end" ? "---:" : ":---";
  });
  const rows = table.rows.map((row) =>
    Array.from(
      { length: columnCount },
      (_, index) => portableTableCell(row[index] ?? ""),
    ),
  );
  return [headers, delimiters, ...rows]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
}

export function updateGfmTableCell(
  table: TableDescriptor,
  row: number,
  column: number,
  value: string,
): TableDescriptor {
  const next = {
    headers: [...table.headers],
    rows: table.rows.map((item) => [...item]),
    alignments: [...table.alignments],
  };
  if (row < 0) next.headers[column] = value;
  else if (next.rows[row]) next.rows[row][column] = value;
  return next;
}

export function appendGfmTableRow(table: TableDescriptor): TableDescriptor {
  return insertGfmTableRow(table, table.rows.length);
}

export function insertGfmTableRow(
  table: TableDescriptor,
  index: number,
): TableDescriptor {
  const target = Math.max(0, Math.min(index, table.rows.length));
  const rows = table.rows.map((row) => [...row]);
  rows.splice(
    target,
    0,
    Array.from({ length: table.headers.length }, () => ""),
  );
  return {
    headers: [...table.headers],
    rows,
    alignments: [...table.alignments],
  };
}

export function appendGfmTableColumn(table: TableDescriptor): TableDescriptor {
  return insertGfmTableColumn(table, table.headers.length);
}

export function insertGfmTableColumn(
  table: TableDescriptor,
  index: number,
): TableDescriptor {
  const target = Math.max(0, Math.min(index, table.headers.length));
  const headers = [...table.headers];
  headers.splice(target, 0, `ستون ${target + 1}`);
  const rows = table.rows.map((row) => {
    const next = [...row];
    next.splice(target, 0, "");
    return next;
  });
  const alignments = [...table.alignments];
  alignments.splice(target, 0, "start");
  return {
    headers,
    rows,
    alignments,
  };
}

export function removeGfmTableRow(
  table: TableDescriptor,
  row: number,
): TableDescriptor {
  if (!table.rows.length) return table;
  const target = Math.max(0, Math.min(row, table.rows.length - 1));
  return {
    headers: [...table.headers],
    rows: table.rows
      .filter((_, index) => index !== target)
      .map((item) => [...item]),
    alignments: [...table.alignments],
  };
}

export function removeGfmTableColumn(
  table: TableDescriptor,
  column: number,
): TableDescriptor {
  if (table.headers.length <= 2) return table;
  const target = Math.max(0, Math.min(column, table.headers.length - 1));
  return {
    headers: table.headers.filter((_, index) => index !== target),
    rows: table.rows.map((row) =>
      row.filter((_, index) => index !== target),
    ),
    alignments: table.alignments.filter((_, index) => index !== target),
  };
}

export function removeGfmTableRows(
  table: TableDescriptor,
  rows: Iterable<number>,
): TableDescriptor {
  const selected = new Set(
    [...rows].filter((row) => row >= 0 && row < table.rows.length),
  );
  if (!selected.size) return table;
  return {
    headers: [...table.headers],
    rows: table.rows
      .filter((_, index) => !selected.has(index))
      .map((row) => [...row]),
    alignments: [...table.alignments],
  };
}

export function removeGfmTableColumns(
  table: TableDescriptor,
  columns: Iterable<number>,
): TableDescriptor {
  const selected = new Set(
    [...columns].filter(
      (column) => column >= 0 && column < table.headers.length,
    ),
  );
  if (!selected.size || table.headers.length - selected.size < 2) return table;
  return {
    headers: table.headers.filter((_, index) => !selected.has(index)),
    rows: table.rows.map((row) =>
      row.filter((_, index) => !selected.has(index)),
    ),
    alignments: table.alignments.filter((_, index) => !selected.has(index)),
  };
}

export type TableCellRange = {
  rowFrom: number;
  rowTo: number;
  columnFrom: number;
  columnTo: number;
};

export function clearGfmTableCells(
  table: TableDescriptor,
  range: TableCellRange,
): TableDescriptor {
  const rowFrom = Math.max(-1, Math.min(range.rowFrom, range.rowTo));
  const rowTo = Math.min(
    table.rows.length - 1,
    Math.max(range.rowFrom, range.rowTo),
  );
  const columnFrom = Math.max(
    0,
    Math.min(range.columnFrom, range.columnTo),
  );
  const columnTo = Math.min(
    table.headers.length - 1,
    Math.max(range.columnFrom, range.columnTo),
  );
  if (rowFrom > rowTo || columnFrom > columnTo) return table;
  const next: TableDescriptor = {
    headers: [...table.headers],
    rows: table.rows.map((row) => [...row]),
    alignments: [...table.alignments],
  };
  for (let row = rowFrom; row <= rowTo; row += 1) {
    for (let column = columnFrom; column <= columnTo; column += 1) {
      if (row < 0) next.headers[column] = "";
      else next.rows[row][column] = "";
    }
  }
  return next;
}

export function cycleGfmTableAlignment(
  table: TableDescriptor,
  column: number,
): TableDescriptor {
  const alignments = [...table.alignments];
  const current = alignments[column] ?? "start";
  alignments[column] = current === "start" ? "center" : current === "center" ? "end" : "start";
  return {
    headers: [...table.headers],
    rows: table.rows.map((row) => [...row]),
    alignments,
  };
}

export function parseMarkdownImage(source: string): ImageDescriptor | null {
  const match = /^!\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+("[^"]*"|'[^']*'|\([^)]*\)))?\s*\)$/u.exec(source);
  if (!match) return null;
  return {
    alt: match[1].replace(/\\([\[\]])/gu, "$1").trim(),
    source: (match[2] ?? match[3] ?? "").trim(),
    title: (match[4] ?? "").replace(/^(?:["'(])|(?:["')])$/gu, "").trim(),
  };
}

export function parseCallout(source: string): CalloutDescriptor | null {
  const lines = source.replace(/\r\n?/gu, "\n").split("\n");
  const first = /^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING)\](?:[+-])?\s*(.*)$/iu.exec(lines[0] ?? "");
  if (!first) return null;
  const kind = first[1].toLowerCase() as CalloutDescriptor["kind"];
  const body = lines.slice(1).map((line) => line.replace(/^\s*>\s?/u, "")).join("\n").trim();
  return { kind, title: first[2].trim() || CALLOUT_TITLES[kind], body };
}

export function footnoteReferences(source: string, offset = 0) {
  const matches: Array<{ id: string; from: number; to: number; definition: boolean }> = [];
  const expression = /\[\^([^\]\r\n]{1,80})\]/gu;
  for (const match of source.matchAll(expression)) {
    const index = match.index ?? 0;
    matches.push({
      id: match[1],
      from: offset + index,
      to: offset + index + match[0].length,
      definition: source[index + match[0].length] === ":",
    });
  }
  return matches;
}

export function safeLiveImageSource(source: string) {
  const value = source.trim();
  if (!value || /[\u0000-\u001f]/u.test(value)) return null;
  if (/^data:image\/(?:gif|jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/iu.test(value)) return value;
  if (/^(?:https?:|blob:)/iu.test(value)) return value;
  if (/^(?:javascript:|vbscript:|file:|data:|\/\/)/iu.test(value)) return null;
  if (/^[a-z][a-z\d+.-]*:/iu.test(value)) return null;
  return value;
}
