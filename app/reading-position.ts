export const READING_POSITION_VERSION = 2;
const LEGACY_READING_POSITION_VERSION = 1;
export const MAX_READING_POSITION_RECORDS = 100;

const READING_BLOCK_SELECTOR =
  "h1, h2, h3, h4, h5, h6, p, li, blockquote, figure, table, pre";

export type ReadingViewMode = "reading" | "desk";

export type ReadingAnchor = {
  blockIndex: number;
  blockType: string;
  headingPath: string[];
  textPrefix: string;
  textSuffix: string;
  textHash?: string;
  headingPathHash?: string;
  previousTextHash?: string;
  nextTextHash?: string;
};

export type ReadingPositionRecord = {
  version: typeof READING_POSITION_VERSION;
  documentKey: string;
  contentSignature: string;
  viewMode: ReadingViewMode;
  anchor: ReadingAnchor;
  viewportOffset: number;
  fallbackProgress: number;
  readerSize: number;
  outlineOpen: boolean;
  updatedAt: number;
};

export type ReadingPositionMap = Record<string, ReadingPositionRecord>;

export type ReadingViewportSnapshot = Pick<
  ReadingPositionRecord,
  "anchor" | "viewportOffset" | "fallbackProgress"
>;

export type ReadingScrollContext = {
  article: HTMLElement;
  root: HTMLElement;
};

export type ReadingRestoreResult = {
  restored: boolean;
  match: "exact" | "approximate" | "index" | "progress" | "none";
  offsetError: number;
};

function normalizedText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

export function readingTextFingerprint(value: string) {
  const normalized = normalizedText(value);
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${normalized.length.toString(36)}-${(hash >>> 0).toString(36)}`;
}

export function readingAnchorsMatch(
  expected: ReadingAnchor | null | undefined,
  actual: ReadingAnchor | null | undefined,
) {
  if (!expected || !actual || expected.blockType !== actual.blockType) return false;

  if (expected.textHash && actual.textHash) {
    return expected.textHash === actual.textHash;
  }

  return (
    normalizedText(expected.textPrefix) === normalizedText(actual.textPrefix) &&
    normalizedText(expected.textSuffix) === normalizedText(actual.textSuffix)
  );
}

function blockText(block: HTMLElement) {
  return normalizedText(
    block.textContent || block.getAttribute("aria-label") || "",
  );
}

function blockType(block: HTMLElement) {
  return block.tagName.toLocaleLowerCase("en-US");
}

function readingBlocks(article: HTMLElement) {
  return Array.from(
    article.querySelectorAll<HTMLElement>(READING_BLOCK_SELECTOR),
  ).filter((block) => {
    const rect = block.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && blockText(block).length > 0;
  });
}

function headingPathAt(blocks: HTMLElement[], targetIndex: number) {
  const path: string[] = [];
  for (let index = 0; index <= targetIndex; index += 1) {
    const block = blocks[index];
    const match = /^h([1-6])$/iu.exec(blockType(block));
    if (!match) continue;
    const level = Number(match[1]);
    path.splice(level - 1);
    path[level - 1] = blockText(block).slice(0, 140);
  }
  return path.filter(Boolean);
}

function rootRect(root: HTMLElement) {
  if (root === document.scrollingElement) {
    return { top: 0, bottom: window.innerHeight, height: window.innerHeight };
  }
  const rect = root.getBoundingClientRect();
  return { top: rect.top, bottom: rect.bottom, height: rect.height };
}

function rootScrollTop(root: HTMLElement) {
  return root === document.scrollingElement ? window.scrollY : root.scrollTop;
}

function rootMaxScroll(root: HTMLElement) {
  return Math.max(0, root.scrollHeight - root.clientHeight);
}

function setRootScrollTop(root: HTMLElement, top: number) {
  const nextTop = Math.max(0, Math.min(rootMaxScroll(root), top));
  if (root === document.scrollingElement) {
    window.scrollTo({ top: nextTop, behavior: "auto" });
  } else {
    root.scrollTop = nextTop;
  }
}

function readingProbeY(root: HTMLElement) {
  const rect = rootRect(root);
  return Math.min(
    rect.bottom - 120,
    Math.max(rect.top + 110, rect.top + rect.height * 0.42),
  );
}

function anchorFromBlock(blocks: HTMLElement[], index: number): ReadingAnchor {
  const block = blocks[index];
  const text = blockText(block);
  const headingPath = headingPathAt(blocks, index);
  return {
    blockIndex: index,
    blockType: blockType(block),
    headingPath,
    textPrefix: text.slice(0, 120),
    textSuffix: text.slice(-80),
    textHash: readingTextFingerprint(text),
    headingPathHash: readingTextFingerprint(headingPath.join("\u241f")),
    previousTextHash:
      index > 0 ? readingTextFingerprint(blockText(blocks[index - 1])) : "",
    nextTextHash:
      index + 1 < blocks.length
        ? readingTextFingerprint(blockText(blocks[index + 1]))
        : "",
  };
}

export function readingContentSignature(content: string) {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${content.length.toString(36)}-${(hash >>> 0).toString(36)}`;
}

export function readingDocumentKey({
  activeDocumentPath,
  draftId,
}: {
  activeDocumentPath: string;
  draftId: string;
}) {
  const path = activeDocumentPath.trim();
  return path
    ? `file:${path.replace(/\\/gu, "/").toLocaleLowerCase("en-US")}`
    : `draft:${draftId}`;
}

export function createReadingDraftId() {
  return `draft-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function captureReadingViewport(
  context: ReadingScrollContext,
): ReadingViewportSnapshot | null {
  const { article, root } = context;
  const blocks = readingBlocks(article);
  if (!blocks.length) return null;

  const probeY = readingProbeY(root);
  const viewport = rootRect(root);
  let targetIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  blocks.forEach((block, index) => {
    const rect = block.getBoundingClientRect();
    if (rect.bottom < viewport.top || rect.top > viewport.bottom) return;
    const containsProbe = rect.top <= probeY && rect.bottom >= probeY;
    const distance = containsProbe ? 0 : Math.abs(rect.top - probeY);
    if (distance < bestDistance) {
      bestDistance = distance;
      targetIndex = index;
    }
  });

  const target = blocks[targetIndex];
  const maxScroll = rootMaxScroll(root);
  return {
    anchor: anchorFromBlock(blocks, targetIndex),
    viewportOffset: Math.round(target.getBoundingClientRect().top - probeY),
    fallbackProgress:
      maxScroll > 0
        ? Math.max(0, Math.min(1, rootScrollTop(root) / maxScroll))
        : 0,
  };
}

function sameHeadingPath(first: string[], second: string[]) {
  return first.join("\u241f") === second.join("\u241f");
}

function findAnchorBlock(
  blocks: HTMLElement[],
  record: ReadingPositionRecord,
  currentContentSignature: string,
) {
  const { anchor } = record;
  const candidates = blocks.map((block, index) => ({
    block,
    index,
    text: blockText(block),
    type: blockType(block),
    headingPath: headingPathAt(blocks, index),
    textHash: readingTextFingerprint(blockText(block)),
    previousTextHash:
      index > 0 ? readingTextFingerprint(blockText(blocks[index - 1])) : "",
    nextTextHash:
      index + 1 < blocks.length
        ? readingTextFingerprint(blockText(blocks[index + 1]))
        : "",
  }));
  const indexedCandidate = candidates[anchor.blockIndex];
  if (
    currentContentSignature === record.contentSignature &&
    indexedCandidate &&
    indexedCandidate.type === anchor.blockType &&
    indexedCandidate.text.startsWith(anchor.textPrefix) &&
    indexedCandidate.text.endsWith(anchor.textSuffix)
  ) {
    return {
      ...indexedCandidate,
      match: "index" as const,
    };
  }
  const exactCandidates = candidates.filter((candidate) => {
    if (candidate.type !== anchor.blockType) return false;
    if (anchor.textHash) return candidate.textHash === anchor.textHash;
    return (
      candidate.text.startsWith(anchor.textPrefix) &&
      candidate.text.endsWith(anchor.textSuffix)
    );
  });
  if (exactCandidates.length) {
    const ranked = exactCandidates
      .map((candidate) => {
        let score = 0;
        if (
          anchor.headingPathHash &&
          readingTextFingerprint(candidate.headingPath.join("\u241f")) ===
            anchor.headingPathHash
        ) {
          score += 16;
        } else if (sameHeadingPath(candidate.headingPath, anchor.headingPath)) {
          score += 14;
        }
        if (
          anchor.previousTextHash &&
          candidate.previousTextHash === anchor.previousTextHash
        ) {
          score += 6;
        }
        if (
          anchor.nextTextHash &&
          candidate.nextTextHash === anchor.nextTextHash
        ) {
          score += 6;
        }
        score -= Math.min(4, Math.abs(candidate.index - anchor.blockIndex) / 40);
        return { ...candidate, score };
      })
      .sort((first, second) => second.score - first.score);
    const best = ranked[0];
    const runnerUp = ranked[1];
    const hasSemanticContext =
      best.score >= 5.5 || exactCandidates.length === 1 || !anchor.textHash;
    const hasClearLead = !runnerUp || best.score - runnerUp.score >= 2;
    if (hasSemanticContext && hasClearLead) {
      return { ...best, match: "exact" as const };
    }
  }

  let best:
    | (typeof candidates)[number] & { score: number; match: "approximate" }
    | null = null;
  for (const candidate of candidates) {
    let score = 0;
    if (candidate.type === anchor.blockType) score += 1;
    if (
      anchor.textPrefix.length >= 24 &&
      candidate.text.includes(anchor.textPrefix.slice(0, 48))
    ) {
      score += 5;
    }
    if (
      anchor.textSuffix.length >= 20 &&
      candidate.text.includes(anchor.textSuffix.slice(-40))
    ) {
      score += 3;
    }
    if (
      sameHeadingPath(
        candidate.headingPath,
        anchor.headingPath,
      )
    ) {
      score += 5;
    }
    if (
      anchor.previousTextHash &&
      candidate.previousTextHash === anchor.previousTextHash
    ) {
      score += 3;
    }
    if (anchor.nextTextHash && candidate.nextTextHash === anchor.nextTextHash) {
      score += 3;
    }
    score -= Math.min(2, Math.abs(candidate.index - anchor.blockIndex) / 80);
    if (score >= 4 && (!best || score > best.score)) {
      best = { ...candidate, score, match: "approximate" };
    }
  }
  if (best) return best;

  return null;
}

export function restoreReadingViewport(
  context: ReadingScrollContext,
  record: ReadingPositionRecord,
  currentContentSignature: string,
): ReadingRestoreResult {
  const { article, root } = context;
  const blocks = readingBlocks(article);
  if (!blocks.length) {
    return { restored: false, match: "none", offsetError: 0 };
  }

  const resolved = findAnchorBlock(blocks, record, currentContentSignature);
  if (!resolved) {
    const maxScroll = rootMaxScroll(root);
    setRootScrollTop(root, maxScroll * record.fallbackProgress);
    return {
      restored: maxScroll > 0,
      match: maxScroll > 0 ? "progress" : "none",
      offsetError: 0,
    };
  }

  const probeY = readingProbeY(root);
  const currentOffset = resolved.block.getBoundingClientRect().top - probeY;
  const delta = currentOffset - record.viewportOffset;
  setRootScrollTop(root, rootScrollTop(root) + delta);

  return {
    restored: true,
    match: resolved.match,
    offsetError: Math.round(delta),
  };
}

export function sanitizeReadingPositionMap(value: unknown): ReadingPositionMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const records = Object.entries(value as Record<string, unknown>)
    .map(([key, candidate]) => {
      if (!candidate || typeof candidate !== "object") return null;
      const record = candidate as Partial<ReadingPositionRecord>;
      const anchor = record.anchor as Partial<ReadingAnchor> | undefined;
      if (
        (record.version !== READING_POSITION_VERSION &&
          record.version !== LEGACY_READING_POSITION_VERSION) ||
        record.documentKey !== key ||
        typeof record.contentSignature !== "string" ||
        (record.viewMode !== "reading" && record.viewMode !== "desk") ||
        !anchor ||
        !Number.isSafeInteger(anchor.blockIndex) ||
        typeof anchor.blockType !== "string" ||
        !Array.isArray(anchor.headingPath) ||
        !anchor.headingPath.every((item) => typeof item === "string") ||
        typeof anchor.textPrefix !== "string" ||
        typeof anchor.textSuffix !== "string" ||
        typeof record.viewportOffset !== "number" ||
        typeof record.fallbackProgress !== "number" ||
        typeof record.readerSize !== "number" ||
        typeof record.outlineOpen !== "boolean" ||
        typeof record.updatedAt !== "number"
      ) {
        return null;
      }
      const sanitizedRecord: ReadingPositionRecord = {
          version: READING_POSITION_VERSION,
          documentKey: key,
          contentSignature: record.contentSignature,
          viewMode: record.viewMode,
          anchor: {
            blockIndex: Math.max(0, Number(anchor.blockIndex)),
            blockType: anchor.blockType.slice(0, 24),
            headingPath: anchor.headingPath.slice(0, 6).map((item) => item.slice(0, 140)),
            textPrefix: anchor.textPrefix.slice(0, 120),
            textSuffix: anchor.textSuffix.slice(-80),
            textHash:
              typeof anchor.textHash === "string"
                ? anchor.textHash.slice(0, 80)
                : undefined,
            headingPathHash:
              typeof anchor.headingPathHash === "string"
                ? anchor.headingPathHash.slice(0, 80)
                : undefined,
            previousTextHash:
              typeof anchor.previousTextHash === "string"
                ? anchor.previousTextHash.slice(0, 80)
                : undefined,
            nextTextHash:
              typeof anchor.nextTextHash === "string"
                ? anchor.nextTextHash.slice(0, 80)
                : undefined,
          },
          fallbackProgress: Math.max(0, Math.min(1, record.fallbackProgress)),
          readerSize: Math.max(16, Math.min(22, record.readerSize)),
          viewportOffset: record.viewportOffset,
          outlineOpen: record.outlineOpen,
          updatedAt: record.updatedAt,
        };
      return [key, sanitizedRecord] as const;
    })
    .filter(
      (entry): entry is readonly [string, ReadingPositionRecord] =>
        entry !== null,
    )
    .sort((first, second) => second[1].updatedAt - first[1].updatedAt)
    .slice(0, MAX_READING_POSITION_RECORDS);

  return Object.fromEntries(records);
}

export function upsertReadingPosition(
  positions: ReadingPositionMap,
  record: ReadingPositionRecord,
) {
  return sanitizeReadingPositionMap({ ...positions, [record.documentKey]: record });
}
