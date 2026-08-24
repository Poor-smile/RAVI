export type MarkdownListKind = "bullet" | "ordered";

export type MarkdownListItem = {
  id: string;
  parentId: string | null;
  children: string[];
  depth: number;
  lineIndex: number;
  subtreeLineTo: number;
  subtreeTo: number;
  from: number;
  lineTo: number;
  indentColumns: number;
  contentColumn: number;
  kind: MarkdownListKind;
  bullet: "-" | "+" | "*" | null;
  delimiter: "." | ")" | null;
  checked: boolean | null;
};

export type MarkdownListBlock = {
  source: string;
  items: MarkdownListItem[];
  roots: string[];
};

export type MarkdownListEditPlan = {
  markdown: string;
  selectionOffset: number;
  changed: boolean;
  userEvent: string;
  announcement: string;
};

type SourceLine = {
  from: number;
  to: number;
  breakTo: number;
  text: string;
};

type ListMarker = {
  indentText: string;
  indentColumns: number;
  prefixLength: number;
  kind: MarkdownListKind;
  bullet: "-" | "+" | "*" | null;
  delimiter: "." | ")" | null;
  checked: boolean | null;
};

const LIST_MARKER = /^([ \t]*)(?:([-+*])([ \t]+)|(\d{1,9})([.)])([ \t]+))(?:\[([ xX])\]([ \t]+))?/u;

function indentationColumns(value: string) {
  let columns = 0;
  for (const character of value) {
    columns += character === "\t" ? 2 : 1;
  }
  return columns;
}

function sourceLines(source: string): SourceLine[] {
  if (!source.length) return [{ from: 0, to: 0, breakTo: 0, text: "" }];
  const lines: SourceLine[] = [];
  let from = 0;
  while (from < source.length) {
    const match = /\r\n|\n|\r/gu.exec(source.slice(from));
    const to = match ? from + (match.index ?? 0) : source.length;
    const breakTo = match ? to + match[0].length : to;
    lines.push({ from, to, breakTo, text: source.slice(from, to) });
    from = breakTo;
  }
  if (/\r\n$|[\n\r]$/u.test(source)) {
    lines.push({ from: source.length, to: source.length, breakTo: source.length, text: "" });
  }
  return lines;
}

function markerForLine(text: string): ListMarker | null {
  const match = LIST_MARKER.exec(text);
  if (!match) return null;
  const ordered = match[4] !== undefined;
  return {
    indentText: match[1],
    indentColumns: indentationColumns(match[1]),
    prefixLength: match[0].length,
    kind: ordered ? "ordered" : "bullet",
    bullet: ordered ? null : (match[2] as "-" | "+" | "*"),
    delimiter: ordered ? (match[5] as "." | ")") : null,
    checked:
      match[7] === undefined ? null : match[7].toLowerCase() === "x",
  };
}

function preferredLineBreak(source: string) {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

function lineIndexAt(lines: SourceLine[], position: number) {
  const safe = Math.max(0, Math.min(position, lines.at(-1)?.breakTo ?? 0));
  return Math.max(
    0,
    lines.findIndex((line, index) =>
      index === lines.length - 1 ? safe <= line.breakTo : safe < line.breakTo,
    ),
  );
}

export function parseMarkdownListBlock(source: string): MarkdownListBlock {
  const lines = sourceLines(source);
  const items: MarkdownListItem[] = [];
  const roots: string[] = [];
  const stack: MarkdownListItem[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const marker = markerForLine(line.text);
    if (!marker) continue;
    while (
      stack.length > 0 &&
      stack[stack.length - 1].indentColumns >= marker.indentColumns
    ) {
      stack.pop();
    }
    const parent = stack.at(-1) ?? null;
    const item: MarkdownListItem = {
      id: `list-item:${lineIndex}`,
      parentId: parent?.id ?? null,
      children: [],
      depth: parent ? parent.depth + 1 : 0,
      lineIndex,
      subtreeLineTo: lines.length - 1,
      subtreeTo: line.to,
      from: line.from,
      lineTo: line.to,
      indentColumns: marker.indentColumns,
      contentColumn: marker.prefixLength,
      kind: marker.kind,
      bullet: marker.bullet,
      delimiter: marker.delimiter,
      checked: marker.checked,
    };
    items.push(item);
    if (parent) parent.children.push(item.id);
    else roots.push(item.id);
    stack.push(item);
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const nextBoundary = items
      .slice(index + 1)
      .find((candidate) => candidate.indentColumns <= item.indentColumns);
    item.subtreeLineTo = nextBoundary
      ? nextBoundary.lineIndex - 1
      : lines.length - 1;
    item.subtreeTo = lines[item.subtreeLineTo]?.to ?? item.lineTo;
  }

  return { source, items, roots };
}

export function markdownListItemAt(
  block: MarkdownListBlock,
  position: number,
): MarkdownListItem | null {
  const lines = sourceLines(block.source);
  const lineIndex = lineIndexAt(lines, position);
  return (
    block.items
      .filter(
        (item) =>
          item.lineIndex <= lineIndex && item.subtreeLineTo >= lineIndex,
      )
      .sort(
        (left, right) =>
          right.depth - left.depth || right.lineIndex - left.lineIndex,
      )[0] ?? null
  );
}

function rebuildLines(source: string, texts: string[]) {
  const lines = sourceLines(source);
  return lines
    .map((line, index) => `${texts[index] ?? line.text}${source.slice(line.to, line.breakTo)}`)
    .join("");
}

function renderLineTexts(source: string, texts: string[]) {
  return texts.join(preferredLineBreak(source));
}

function positionAtLineColumn(source: string, lineIndex: number, column: number) {
  const lines = sourceLines(source);
  const line = lines[Math.max(0, Math.min(lineIndex, lines.length - 1))];
  return line.from + Math.min(Math.max(0, column), line.text.length);
}

function mapPositionAcrossSameLines(
  before: string,
  after: string,
  position: number,
) {
  const beforeLines = sourceLines(before);
  const afterLines = sourceLines(after);
  const index = lineIndexAt(beforeLines, position);
  const beforeLine = beforeLines[index];
  const afterLine = afterLines[Math.min(index, afterLines.length - 1)];
  const column = Math.max(0, position - beforeLine.from);
  const beforeMarker = markerForLine(beforeLine.text);
  const afterMarker = markerForLine(afterLine.text);
  let nextColumn: number;
  if (
    beforeMarker &&
    afterMarker &&
    column >= beforeMarker.prefixLength
  ) {
    nextColumn = afterMarker.prefixLength + column - beforeMarker.prefixLength;
  } else {
    const beforeIndent = beforeLine.text.match(/^[ \t]*/u)?.[0].length ?? 0;
    const afterIndent = afterLine.text.match(/^[ \t]*/u)?.[0].length ?? 0;
    nextColumn =
      column >= beforeIndent
        ? afterIndent + column - beforeIndent
        : Math.min(column, afterIndent);
  }
  return afterLine.from + Math.min(nextColumn, afterLine.text.length);
}

function renumberOrderedItems(source: string, position: number) {
  const block = parseMarkdownListBlock(source);
  const lines = sourceLines(source);
  const texts = lines.map((line) => line.text);
  const previousKind = new Map<string, MarkdownListKind>();
  const counters = new Map<string, number>();

  for (const item of block.items) {
    const group = item.parentId ?? "root";
    if (item.kind !== "ordered") {
      previousKind.set(group, item.kind);
      counters.set(group, 0);
      continue;
    }
    const nextNumber =
      previousKind.get(group) === "ordered"
        ? (counters.get(group) ?? 0) + 1
        : 1;
    previousKind.set(group, "ordered");
    counters.set(group, nextNumber);
    const line = lines[item.lineIndex];
    texts[item.lineIndex] = line.text.replace(
      /^([ \t]*)\d{1,9}([.)])/u,
      `$1${nextNumber}$2`,
    );
  }

  const markdown = rebuildLines(source, texts);
  return {
    markdown,
    position: mapPositionAcrossSameLines(source, markdown, position),
  };
}

function leadingWhitespaceWithColumns(text: string, targetColumns: number) {
  const leading = text.match(/^[ \t]*/u)?.[0] ?? "";
  return `${" ".repeat(Math.max(0, targetColumns))}${text.slice(leading.length)}`;
}

function transformSubtreeIndentation(
  source: string,
  item: MarkdownListItem,
  delta: number,
  position: number,
) {
  const lines = sourceLines(source);
  const texts = lines.map((line, index) => {
    if (
      index < item.lineIndex ||
      index > item.subtreeLineTo ||
      !line.text.trim()
    ) {
      return line.text;
    }
    const currentIndent = indentationColumns(
      line.text.match(/^[ \t]*/u)?.[0] ?? "",
    );
    return leadingWhitespaceWithColumns(line.text, currentIndent + delta);
  });
  const markdown = rebuildLines(source, texts);
  return {
    markdown,
    position: mapPositionAcrossSameLines(source, markdown, position),
  };
}

export function planMarkdownListIndentation(
  source: string,
  position: number,
  direction: "in" | "out",
): MarkdownListEditPlan | null {
  const block = parseMarkdownListBlock(source);
  const item = markdownListItemAt(block, position);
  if (!item) return null;
  const siblings = block.items.filter((candidate) => candidate.parentId === item.parentId);
  const siblingIndex = siblings.findIndex((candidate) => candidate.id === item.id);
  const parent = item.parentId
    ? block.items.find((candidate) => candidate.id === item.parentId) ?? null
    : null;
  if ((direction === "in" && siblingIndex < 1) || (direction === "out" && !parent)) {
    return {
      markdown: source,
      selectionOffset: position,
      changed: false,
      userEvent: `input.list.${direction}.boundary`,
      announcement:
        direction === "in"
          ? "برای تو‌رفتن، آیتم هم‌سطح قبلی لازم است."
          : "آیتم در سطح ریشه است و بیرون‌تر نمی‌رود.",
    };
  }

  const delta = direction === "in"
    ? 2
    : -(item.indentColumns - (parent?.indentColumns ?? 0));
  const indented = transformSubtreeIndentation(source, item, delta, position);
  const numbered = renumberOrderedItems(indented.markdown, indented.position);
  return {
    markdown: numbered.markdown,
    selectionOffset: numbered.position,
    changed: true,
    userEvent: direction === "in" ? "input.list.nest" : "input.list.outdent",
    announcement:
      direction === "in"
        ? "آیتم و زیرمجموعه‌هایش یک سطح به داخل منتقل شدند."
        : "آیتم و زیرمجموعه‌هایش یک سطح به بیرون منتقل شدند.",
  };
}

function planMarkdownListItemMoveToIndex(
  source: string,
  position: number,
  requestedTargetIndex: number,
  userEvent: string,
  announcement: string,
): MarkdownListEditPlan | null {
  const block = parseMarkdownListBlock(source);
  const item = markdownListItemAt(block, position);
  if (!item) return null;
  const siblings = block.items.filter(
    (candidate) => candidate.parentId === item.parentId,
  );
  const siblingIndex = siblings.findIndex(
    (candidate) => candidate.id === item.id,
  );
  const targetIndex = Math.max(
    0,
    Math.min(requestedTargetIndex, siblings.length - 1),
  );
  if (targetIndex === siblingIndex) {
    return {
      markdown: source,
      selectionOffset: position,
      changed: false,
      userEvent,
      announcement,
    };
  }

  const lines = sourceLines(source);
  const activeLineIndex = lineIndexAt(lines, position);
  const activeColumn = position - lines[activeLineIndex].from;
  const siblingSegments = new Map(
    siblings.map((sibling) => [
      sibling.id,
      lines
        .slice(sibling.lineIndex, sibling.subtreeLineTo + 1)
        .map((line) => line.text),
    ]),
  );
  const reorderedSiblings = [...siblings];
  reorderedSiblings.splice(siblingIndex, 1);
  reorderedSiblings.splice(targetIndex, 0, item);
  const beforeIndex = siblings[0].lineIndex;
  const afterIndex = siblings.at(-1)!.subtreeLineTo + 1;
  const movedTexts = reorderedSiblings.flatMap(
    (sibling) => siblingSegments.get(sibling.id) ?? [],
  );
  const texts = [
    ...lines.slice(0, beforeIndex).map((line) => line.text),
    ...movedTexts,
    ...lines.slice(afterIndex).map((line) => line.text),
  ];
  const markdown = renderLineTexts(source, texts);
  const relativeLineIndex = activeLineIndex - item.lineIndex;
  const movedLineIndex =
    beforeIndex +
    reorderedSiblings
      .slice(0, targetIndex)
      .reduce(
        (total, sibling) =>
          total + (siblingSegments.get(sibling.id)?.length ?? 0),
        0,
      ) +
    relativeLineIndex;
  const rawCaret = positionAtLineColumn(
    markdown,
    movedLineIndex,
    activeColumn,
  );
  const numbered = renumberOrderedItems(markdown, rawCaret);
  return {
    markdown: numbered.markdown,
    selectionOffset: numbered.position,
    changed: true,
    userEvent,
    announcement,
  };
}

export function planMarkdownListItemMoveTo(
  source: string,
  position: number,
  targetIndex: number,
): MarkdownListEditPlan | null {
  return planMarkdownListItemMoveToIndex(
    source,
    position,
    targetIndex,
    "input.list.item.moveTo",
    "آیتم و زیرمجموعه‌هایش به موقعیت جدید منتقل شدند.",
  );
}

export function planMarkdownListItemMove(
  source: string,
  position: number,
  direction: "up" | "down",
): MarkdownListEditPlan | null {
  const block = parseMarkdownListBlock(source);
  const item = markdownListItemAt(block, position);
  if (!item) return null;
  const siblings = block.items.filter(
    (candidate) => candidate.parentId === item.parentId,
  );
  const siblingIndex = siblings.findIndex(
    (candidate) => candidate.id === item.id,
  );
  const targetIndex = siblingIndex + (direction === "up" ? -1 : 1);
  const atBoundary = targetIndex < 0 || targetIndex >= siblings.length;
  return planMarkdownListItemMoveToIndex(
    source,
    position,
    targetIndex,
    atBoundary
      ? `input.list.item.move.${direction}.boundary`
      : `input.list.item.move.${direction}`,
    atBoundary
      ? direction === "up"
        ? "آیتم در ابتدای این سطح است و بالاتر نمی‌رود."
        : "آیتم در انتهای این سطح است و پایین‌تر نمی‌رود."
      : direction === "up"
        ? "آیتم و زیرمجموعه‌هایش یک موقعیت بالاتر رفتند."
        : "آیتم و زیرمجموعه‌هایش یک موقعیت پایین‌تر رفتند.",
  );
}

export function planMarkdownEmptyListItemDeletion(
  source: string,
  position: number,
): MarkdownListEditPlan | null {
  const block = parseMarkdownListBlock(source);
  const item = markdownListItemAt(block, position);
  if (!item) return null;
  const lines = sourceLines(source);
  const itemLine = lines[item.lineIndex];
  const marker = markerForLine(itemLine.text);
  if (!marker || itemLine.text.slice(marker.prefixLength).trim()) return null;

  const childLineIndexes = new Set<number>();
  for (const childId of item.children) {
    const child = block.items.find((candidate) => candidate.id === childId);
    if (!child) continue;
    for (
      let lineIndex = child.lineIndex;
      lineIndex <= child.subtreeLineTo;
      lineIndex += 1
    ) {
      childLineIndexes.add(lineIndex);
    }
  }
  const ownContinuationLineIndexes = Array.from(
    { length: Math.max(0, item.subtreeLineTo - item.lineIndex) },
    (_, index) => item.lineIndex + index + 1,
  ).filter((lineIndex) => !childLineIndexes.has(lineIndex));
  if (
    ownContinuationLineIndexes.some((lineIndex) => lines[lineIndex].text.trim())
  ) {
    return null;
  }

  const siblings = block.items.filter(
    (candidate) => candidate.parentId === item.parentId,
  );
  const siblingIndex = siblings.findIndex(
    (candidate) => candidate.id === item.id,
  );
  const previousSibling = siblings[siblingIndex - 1] ?? null;
  const nextSibling = siblings[siblingIndex + 1] ?? null;
  const parent = item.parentId
    ? block.items.find((candidate) => candidate.id === item.parentId) ?? null
    : null;
  const texts = lines.map((line) => line.text);

  for (const childId of item.children) {
    const child = block.items.find((candidate) => candidate.id === childId);
    if (!child) continue;
    const delta = child.indentColumns - item.indentColumns;
    for (
      let lineIndex = child.lineIndex;
      lineIndex <= child.subtreeLineTo;
      lineIndex += 1
    ) {
      if (!texts[lineIndex].trim()) continue;
      const indentation = indentationColumns(
        texts[lineIndex].match(/^[ \t]*/u)?.[0] ?? "",
      );
      texts[lineIndex] = leadingWhitespaceWithColumns(
        texts[lineIndex],
        indentation - delta,
      );
    }
  }

  const removedLineIndexes = new Set([
    item.lineIndex,
    ...ownContinuationLineIndexes,
  ]);
  const remainingTexts = texts.filter(
    (_text, lineIndex) => !removedLineIndexes.has(lineIndex),
  );
  const markdown = renderLineTexts(source, remainingTexts);
  if (!markdown.length) {
    return {
      markdown,
      selectionOffset: 0,
      changed: true,
      userEvent: "input.list.item.delete",
      announcement: "آیتم خالی حذف شد و بلاک به متن خالی تبدیل شد.",
    };
  }

  const mapRemainingLineIndex = (lineIndex: number) =>
    lineIndex -
    Array.from(removedLineIndexes).filter(
      (removedLineIndex) => removedLineIndex < lineIndex,
    ).length;
  let targetLineIndex: number;
  let targetAtEnd = false;
  if (item.children.length > 0) {
    const firstChild = block.items.find(
      (candidate) => candidate.id === item.children[0],
    );
    targetLineIndex = Math.max(
      0,
      mapRemainingLineIndex(firstChild?.lineIndex ?? item.lineIndex),
    );
  } else if (previousSibling) {
    targetLineIndex = mapRemainingLineIndex(previousSibling.lineIndex);
    targetAtEnd = true;
  } else if (parent) {
    targetLineIndex = mapRemainingLineIndex(parent.lineIndex);
    targetAtEnd = true;
  } else {
    targetLineIndex = Math.max(
      0,
      mapRemainingLineIndex(nextSibling?.lineIndex ?? item.lineIndex),
    );
  }
  const targetLine = sourceLines(markdown)[targetLineIndex];
  const targetMarker = markerForLine(targetLine.text);
  const rawCaret = targetAtEnd
    ? targetLine.to
    : targetLine.from + (targetMarker?.prefixLength ?? 0);
  const numbered = renumberOrderedItems(markdown, rawCaret);
  return {
    markdown: numbered.markdown,
    selectionOffset: numbered.position,
    changed: true,
    userEvent: "input.list.item.delete",
    announcement:
      item.children.length > 0
        ? "آیتم خالی حذف شد و زیرمجموعه‌هایش یک سطح بالا آمدند."
        : "آیتم خالی حذف شد.",
  };
}

function newSiblingPrefix(item: MarkdownListItem) {
  const marker =
    item.kind === "ordered"
      ? `1${item.delimiter ?? "."}`
      : (item.bullet ?? "-");
  const task = item.checked === null ? "" : " [ ]";
  return `${" ".repeat(item.indentColumns)}${marker}${task} `;
}

export function planMarkdownListItemInsertion(
  source: string,
  position: number,
): MarkdownListEditPlan | null {
  const block = parseMarkdownListBlock(source);
  const item = markdownListItemAt(block, position);
  if (!item) return null;
  const lines = sourceLines(source);
  const activeLine = lines[lineIndexAt(lines, position)];
  const hasChildren = item.children.length > 0;
  const insertAfterSubtree = hasChildren && position === activeLine.to;
  const insertionOffset = insertAfterSubtree
    ? lines[item.subtreeLineTo].to
    : position;
  const insertion = `${preferredLineBreak(source)}${newSiblingPrefix(item)}`;
  const raw = `${source.slice(0, insertionOffset)}${insertion}${source.slice(insertionOffset)}`;
  const rawCaret = insertionOffset + insertion.length;
  const numbered = renumberOrderedItems(raw, rawCaret);
  return {
    markdown: numbered.markdown,
    selectionOffset: numbered.position,
    changed: true,
    userEvent: "input.list.item.insert",
    announcement: "آیتم هم‌سطح جدید اضافه شد.",
  };
}

export function planMarkdownListItemSoftBreak(
  source: string,
  position: number,
): MarkdownListEditPlan | null {
  const block = parseMarkdownListBlock(source);
  const item = markdownListItemAt(block, position);
  if (!item) return null;
  const lines = sourceLines(source);
  const line = lines[lineIndexAt(lines, position)];
  const marker = markerForLine(lines[item.lineIndex].text);
  if (!marker) return null;
  const currentIndent = indentationColumns(line.text.match(/^[ \t]*/u)?.[0] ?? "");
  const continuationIndent = Math.max(
    item.indentColumns + marker.prefixLength - marker.indentText.length,
    currentIndent,
  );
  const insert = `${preferredLineBreak(source)}${" ".repeat(continuationIndent)}`;
  return {
    markdown: `${source.slice(0, position)}${insert}${source.slice(position)}`,
    selectionOffset: position + insert.length,
    changed: true,
    userEvent: "input.list.item.softBreak",
    announcement: "خط جدید داخل همان آیتم اضافه شد.",
  };
}
