export type FormulaBlock = {
  id: string;
  latex: string;
  startOffset: number;
  endOffset: number;
  latexStartOffset: number;
  latexEndOffset: number;
  startLine: number;
  endLine: number;
  raw: string;
};

export type FormulaBlockUpdate =
  | { ok: true; content: string; block: FormulaBlock }
  | { ok: false; reason: "conflict"; message: string };

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Finds display-math blocks whose delimiters own their lines. Keeping this
 * stricter than inline `$…$` prevents an ordinary currency/dollar character
 * from becoming a document-level structural block.
 */
export function findFormulaBlocks(markdown: string): FormulaBlock[] {
  const blocks: FormulaBlock[] = [];
  const lineExpression = /(^|\n)([ \t]*\$\$[ \t]*\r?\n)([\s\S]*?)(\r?\n[ \t]*\$\$[ \t]*)(?=\n|$)/gu;

  for (const match of markdown.matchAll(lineExpression)) {
    const leadingBreak = match[1] ?? "";
    const opening = match[2] ?? "";
    const latex = (match[3] ?? "").replace(/\r\n?/gu, "\n");
    const closing = match[4] ?? "";
    const startOffset = (match.index ?? 0) + leadingBreak.length;
    const latexStartOffset = startOffset + opening.length;
    const endOffset = latexStartOffset + latex.length + closing.length;
    const raw = markdown.slice(startOffset, endOffset);
    const startLine = markdown.slice(0, startOffset).split("\n").length;
    const endLine = startLine + raw.split("\n").length - 1;
    blocks.push({
      id: `formula-${startOffset}-${hashText(raw)}`,
      latex,
      startOffset,
      endOffset,
      latexStartOffset,
      latexEndOffset: latexStartOffset + latex.length,
      startLine,
      endLine,
      raw,
    });
  }

  return blocks;
}

export function formulaBlockAtOffset(
  blocks: FormulaBlock[],
  offset: number | undefined,
) {
  if (offset === undefined) return undefined;
  return blocks.find(
    (block) => offset >= block.startOffset && offset <= block.endOffset,
  );
}

export function makeFormulaBlock(latex: string) {
  return `$$\n${latex.replace(/\r\n?/gu, "\n").trim()}\n$$`;
}

export function insertFormulaBlock(
  markdown: string,
  offset: number,
  latex: string,
) {
  const safeOffset = Math.max(0, Math.min(offset, markdown.length));
  const blockSource = makeFormulaBlock(latex);
  const before = markdown.slice(0, safeOffset);
  const after = markdown.slice(safeOffset);
  const prefix = before.length > 0 && !before.endsWith("\n\n") ? "\n\n" : "";
  const suffix = after.length > 0 && !after.startsWith("\n\n") ? "\n\n" : "";
  const content = `${before}${prefix}${blockSource}${suffix}${after}`;
  const insertedStart = before.length + prefix.length;
  const block = findFormulaBlocks(content).find(
    (candidate) => candidate.startOffset === insertedStart,
  );
  if (!block) throw new Error("بلوک فرمول ساخته شد اما دوباره قابل شناسایی نبود.");
  return { content, block };
}

export function replaceFormulaBlock(
  currentMarkdown: string,
  originalDocument: string,
  originalBlock: FormulaBlock,
  latex: string,
): FormulaBlockUpdate {
  const replacement = makeFormulaBlock(latex);
  const originalRaw = originalDocument.slice(
    originalBlock.startOffset,
    originalBlock.endOffset,
  );
  const exact = currentMarkdown.slice(
    originalBlock.startOffset,
    originalBlock.startOffset + originalRaw.length,
  );
  let replacementOffset = -1;
  if (exact === originalRaw) replacementOffset = originalBlock.startOffset;
  else {
    const first = currentMarkdown.indexOf(originalRaw);
    const second = first < 0 ? -1 : currentMarkdown.indexOf(originalRaw, first + originalRaw.length);
    if (first >= 0 && second < 0) replacementOffset = first;
  }
  if (replacementOffset < 0) {
    return {
      ok: false,
      reason: "conflict",
      message:
        "این فرمول بیرون از استودیو تغییر کرده است. برای جلوگیری از بازنویسی، تغییرات اعمال نشد.",
    };
  }
  const content =
    currentMarkdown.slice(0, replacementOffset) +
    replacement +
    currentMarkdown.slice(replacementOffset + originalRaw.length);
  const block = findFormulaBlocks(content).find(
    (candidate) => candidate.startOffset === replacementOffset,
  );
  if (!block) {
    return {
      ok: false,
      reason: "conflict",
      message: "پس از ویرایش، بلوک فرمول معتبر قابل شناسایی نبود.",
    };
  }
  return { ok: true, content, block };
}
