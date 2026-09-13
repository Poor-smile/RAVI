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

export function findMermaidBlocks(markdown: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  if (!/mermaid/iu.test(markdown)) return blocks;
  let offset = 0;
  let lineNumber = 1;
  let activeFence:
    | {
        marker: "`" | "~";
        length: number;
        isMermaid: boolean;
        startOffset: number;
        openingEnd: number;
        startLine: number;
      }
    | undefined;

  while (offset < markdown.length) {
    const newline = markdown.indexOf("\n", offset);
    const lineEnd = newline < 0 ? markdown.length : newline + 1;
    const line = markdown.slice(offset, newline < 0 ? lineEnd : newline).replace(/\r$/u, "");

    if (activeFence) {
      const closing = line.match(/^( {0,3})(`{3,}|~{3,})[ \t]*$/u);
      if (
        closing &&
        closing[2][0] === activeFence.marker &&
        closing[2].length >= activeFence.length
      ) {
        if (activeFence.isMermaid) {
          const rawCode = markdown.slice(activeFence.openingEnd, offset);
          const code = rawCode.replace(/\r?\n$/u, "");
          const raw = markdown.slice(activeFence.startOffset, lineEnd);
          blocks.push({
            id: `mermaid-${activeFence.startOffset}-${hashText(raw)}`,
            code,
            startOffset: activeFence.startOffset,
            endOffset: lineEnd,
            codeStartOffset: activeFence.openingEnd,
            codeEndOffset: activeFence.openingEnd + code.length,
            startLine: activeFence.startLine,
            endLine: lineNumber,
            raw,
          });
        }
        activeFence = undefined;
      }
    } else {
      const opening = line.match(/^( {0,3})(`{3,}|~{3,})([^\r\n]*)$/u);
      if (opening) {
        const marker = opening[2];
        const info = opening[3].trim();
        const validBacktickInfo = marker[0] !== "`" || !info.includes("`");
        if (validBacktickInfo) {
          activeFence = {
            marker: marker[0] as "`" | "~",
            length: marker.length,
            isMermaid: /^mermaid(?:[ \t]|$)/iu.test(info),
            startOffset: offset,
            openingEnd: lineEnd,
            startLine: lineNumber,
          };
        }
      }
    }

    offset = lineEnd;
    lineNumber += 1;
  }

  return blocks;
}

export function mermaidBlockAtOffset(
  blocks: MermaidBlock[],
  offset: number | undefined,
) {
  if (offset === undefined) return undefined;
  return blocks.find(
    (block) => offset >= block.startOffset && offset < block.endOffset,
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
