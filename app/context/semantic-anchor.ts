export type SemanticDocumentAnchor = {
  sourceOffset: number;
  viewportOffset: number;
  fallbackProgress: number;
};

const SOURCE_BLOCK_SELECTOR = "[data-source-offset]";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function rootBounds(root: HTMLElement) {
  if (root === document.scrollingElement) {
    return { top: 0, height: window.innerHeight };
  }
  const bounds = root.getBoundingClientRect();
  return { top: bounds.top, height: bounds.height };
}

function rootScrollTop(root: HTMLElement) {
  return root === document.scrollingElement ? window.scrollY : root.scrollTop;
}

function rootScrollRange(root: HTMLElement) {
  return Math.max(0, root.scrollHeight - root.clientHeight);
}

function setRootScrollTop(root: HTMLElement, value: number) {
  const next = clamp(value, 0, rootScrollRange(root));
  if (root === document.scrollingElement) {
    window.scrollTo({ top: next, behavior: "auto" });
  } else {
    root.scrollTop = next;
  }
}

function previewProbeY(root: HTMLElement) {
  const bounds = rootBounds(root);
  return bounds.top + clamp(bounds.height * 0.42, 96, Math.max(96, bounds.height - 96));
}

export function previewElementSourceOffset(element: HTMLElement) {
  const localOffset = Number(element.dataset.sourceOffset);
  if (!Number.isFinite(localOffset)) return null;
  const chunk = element.closest<HTMLElement>("[data-source-start]");
  const chunkStart = Number(chunk?.dataset.sourceStart ?? 0);
  return Math.max(0, localOffset + (Number.isFinite(chunkStart) ? chunkStart : 0));
}

export function closestSemanticOffset(
  offsets: readonly number[],
  requestedOffset: number,
) {
  if (!offsets.length) return null;
  let closest = offsets[0];
  let distance = Math.abs(closest - requestedOffset);
  for (const offset of offsets.slice(1)) {
    const nextDistance = Math.abs(offset - requestedOffset);
    if (nextDistance < distance || (nextDistance === distance && offset <= requestedOffset)) {
      closest = offset;
      distance = nextDistance;
    }
  }
  return closest;
}

function previewBlocks(article: HTMLElement) {
  return Array.from(article.querySelectorAll<HTMLElement>(SOURCE_BLOCK_SELECTOR))
    .map((element) => ({ element, sourceOffset: previewElementSourceOffset(element) }))
    .filter(
      (entry): entry is { element: HTMLElement; sourceOffset: number } =>
        entry.sourceOffset !== null && entry.element.getClientRects().length > 0,
    );
}

export function capturePreviewSemanticAnchor(
  article: HTMLElement,
  root: HTMLElement,
): SemanticDocumentAnchor | null {
  const blocks = previewBlocks(article);
  if (!blocks.length) return null;
  const probeY = previewProbeY(root);
  let target = blocks[0];
  let distance = Number.POSITIVE_INFINITY;
  for (const block of blocks) {
    const rect = block.element.getBoundingClientRect();
    const nextDistance =
      probeY < rect.top ? rect.top - probeY : probeY > rect.bottom ? probeY - rect.bottom : 0;
    if (nextDistance < distance) {
      target = block;
      distance = nextDistance;
    }
    if (nextDistance === 0) break;
  }
  const range = rootScrollRange(root);
  return {
    sourceOffset: target.sourceOffset,
    viewportOffset: Math.round(target.element.getBoundingClientRect().top - probeY),
    fallbackProgress: range > 0 ? clamp(rootScrollTop(root) / range, 0, 1) : 0,
  };
}

export function restorePreviewSemanticAnchor(
  article: HTMLElement,
  root: HTMLElement,
  anchor: SemanticDocumentAnchor,
) {
  const blocks = previewBlocks(article);
  if (!blocks.length) return false;
  const resolvedOffset = closestSemanticOffset(
    blocks.map((block) => block.sourceOffset),
    anchor.sourceOffset,
  );
  const target = blocks.find((block) => block.sourceOffset === resolvedOffset);
  if (!target) {
    setRootScrollTop(root, rootScrollRange(root) * anchor.fallbackProgress);
    return false;
  }
  const delta =
    target.element.getBoundingClientRect().top -
    (previewProbeY(root) + anchor.viewportOffset);
  setRootScrollTop(root, rootScrollTop(root) + delta);
  return true;
}
