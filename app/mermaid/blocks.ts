export type MermaidBlock = {
  id: string;
  code: string;
  startOffset: number;
  endOffset: number;
  codeStartOffset: number;
  codeEndOffset: number;
  startLine: number;
  endLine: number;
  raw: string;
};

export type MermaidBlockUpdate =
  | { ok: true; content: string; block: MermaidBlock }
  | { ok: false; reason: "conflict"; message: string };

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function lineNumberAt(source: string, offset: number) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

export function findMermaidBlocks(markdown: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  const openingPattern =
    /^( {0,3})(`{3,}|~{3,})[ \t]*mermaid(?:[ \t]+[^\r\n]*)?[ \t]*(?:\r?\n|$)/gimu;

  for (const opening of markdown.matchAll(openingPattern)) {
    const startOffset = opening.index;
    const marker = opening[2];
    const markerCharacter = marker[0];
    const openingEnd = startOffset + opening[0].length;
    const closingPattern = new RegExp(
      `^ {0,3}${markerCharacter === "`" ? "`" : "~"}{${
        marker.length
      },}[ \\t]*(?:\\r?\\n|$)`,
      "gmu",
    );
    closingPattern.lastIndex = openingEnd;
    const closing = closingPattern.exec(markdown);
    if (!closing) continue;

    const closingStart = closing.index;
    const endOffset = closingStart + closing[0].length;
    const rawCode = markdown.slice(openingEnd, closingStart);
    const code = rawCode.replace(/\r?\n$/u, "");
    const codeEndOffset = openingEnd + code.length;
    const raw = markdown.slice(startOffset, endOffset);
    const startLine = lineNumberAt(markdown, startOffset);
    const endLine = lineNumberAt(markdown, Math.max(startOffset, endOffset - 1));

    blocks.push({
      id: `mermaid-${startOffset}-${hashText(raw)}`,
      code,
      startOffset,
      endOffset,
      codeStartOffset: openingEnd,
      codeEndOffset,
      startLine,
      endLine,
      raw,
    });
    openingPattern.lastIndex = endOffset;
  }

  return blocks;
}

export function mermaidBlockAtOffset(
  blocks: MermaidBlock[],
  offset: number | undefined,
) {
  if (offset === undefined) return undefined;
  return blocks.find(
    (block) =>
      offset >= block.startOffset - 1 && offset <= block.endOffset + 1,
  );
}

export function makeMermaidFence(code: string) {
  const normalizedCode = code.replace(/\r\n?/gu, "\n").trimEnd();
  return `\`\`\`mermaid\n${normalizedCode}\n\`\`\``;
}

export function insertMermaidBlock(
  markdown: string,
  offset: number,
  code: string,
) {
  const safeOffset = Math.max(0, Math.min(offset, markdown.length));
  const fence = makeMermaidFence(code);
  const before = markdown.slice(0, safeOffset);
  const after = markdown.slice(safeOffset);
  const prefix = before.length > 0 && !before.endsWith("\n\n") ? "\n\n" : "";
  const suffix = after.length > 0 && !after.startsWith("\n\n") ? "\n\n" : "";
  const content = `${before}${prefix}${fence}${suffix}${after}`;
  const insertedStart = before.length + prefix.length;
  const block = findMermaidBlocks(content).find(
    (candidate) => candidate.startOffset === insertedStart,
  );

  if (!block) {
    throw new Error("بلوک Mermaid ساخته شد اما دوباره قابل شناسایی نبود.");
  }
  return { content, block };
}

export function replaceMermaidBlock(
  currentMarkdown: string,
  originalDocument: string,
  originalBlock: MermaidBlock,
  code: string,
): MermaidBlockUpdate {
  const replacement = makeMermaidFence(code);
  const originalRaw = originalDocument.slice(
    originalBlock.startOffset,
    originalBlock.endOffset,
  );
  const atOriginalOffset = currentMarkdown.slice(
    originalBlock.startOffset,
    originalBlock.startOffset + originalRaw.length,
  );

  let replacementOffset = -1;
  if (atOriginalOffset === originalRaw) {
    replacementOffset = originalBlock.startOffset;
  } else {
    const firstMatch = currentMarkdown.indexOf(originalRaw);
    const secondMatch =
      firstMatch < 0
        ? -1
        : currentMarkdown.indexOf(originalRaw, firstMatch + originalRaw.length);
    if (firstMatch >= 0 && secondMatch < 0) replacementOffset = firstMatch;
  }

  if (replacementOffset < 0) {
    return {
      ok: false,
      reason: "conflict",
      message:
        "این نمودار بیرون از استودیو تغییر کرده است. برای جلوگیری از بازنویسی، تغییرات اعمال نشد.",
    };
  }

  const content =
    currentMarkdown.slice(0, replacementOffset) +
    replacement +
    currentMarkdown.slice(replacementOffset + originalRaw.length);
  const block = findMermaidBlocks(content).find(
    (candidate) => candidate.startOffset === replacementOffset,
  );

  if (!block) {
    return {
      ok: false,
      reason: "conflict",
      message: "پس از ویرایش، بلوک Mermaid معتبر قابل شناسایی نبود.",
    };
  }
  return { ok: true, content, block };
}
