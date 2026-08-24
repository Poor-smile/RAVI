import type { RaaviAnnotation } from "../raavi";

export const MARKDOWN_ANNOTATIONS_VERSION = 1;
export const MARKDOWN_ANNOTATIONS_MARKER = "raavi:annotations:v1";

export type MarkdownAnnotationsPayload = {
  version: typeof MARKDOWN_ANNOTATIONS_VERSION;
  comments: RaaviAnnotation[];
  highlights: RaaviAnnotation[];
};

const annotationBlockPattern =
  /(?:\r?\n){0,2}<!--\s*raavi:annotations:v1\s*\r?\n([\s\S]*?)\r?\n-->\s*$/u;

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function annotationFingerprint(
  quote: string,
  prefix: string,
  suffix: string,
) {
  return stableHash(`${prefix.slice(-80)}\u241f${quote}\u241f${suffix.slice(0, 80)}`);
}

export function stripMarkdownAnnotations(markdown: string) {
  return markdown.replace(annotationBlockPattern, "").replace(/\s+$/u, "");
}

export function readMarkdownAnnotations(markdown: string): {
  content: string;
  annotations: RaaviAnnotation[];
  hadBlock: boolean;
  invalidBlock: boolean;
} {
  const match = markdown.match(annotationBlockPattern);
  if (!match) {
    return {
      content: markdown,
      annotations: [],
      hadBlock: false,
      invalidBlock: false,
    };
  }
  const content = markdown.slice(0, match.index).replace(/\s+$/u, "");
  try {
    const parsed = JSON.parse(match[1]) as Partial<MarkdownAnnotationsPayload>;
    const comments = Array.isArray(parsed.comments) ? parsed.comments : [];
    const highlights = Array.isArray(parsed.highlights) ? parsed.highlights : [];
    return {
      content,
      annotations: [...highlights, ...comments].filter(
        (item): item is RaaviAnnotation =>
          Boolean(item) &&
          typeof item.id === "string" &&
          (item.kind === "comment" || item.kind === "highlight") &&
          typeof item.quote === "string",
      ),
      hadBlock: true,
      invalidBlock: parsed.version !== MARKDOWN_ANNOTATIONS_VERSION,
    };
  } catch {
    return { content, annotations: [], hadBlock: true, invalidBlock: true };
  }
}

export function writeMarkdownAnnotations(
  markdown: string,
  annotations: readonly RaaviAnnotation[],
) {
  const content = stripMarkdownAnnotations(markdown);
  if (!annotations.length) return content;
  const normalized = annotations.map((annotation) => ({
    ...annotation,
    source: annotation.source ?? "user",
    approximateStart: annotation.approximateStart ?? annotation.start,
    approximateEnd: annotation.approximateEnd ?? annotation.end,
    fingerprint:
      annotation.fingerprint ??
      annotationFingerprint(
        annotation.quote,
        annotation.prefix,
        annotation.suffix,
      ),
  }));
  const payload: MarkdownAnnotationsPayload = {
    version: MARKDOWN_ANNOTATIONS_VERSION,
    comments: normalized.filter((item) => item.kind === "comment"),
    highlights: normalized.filter((item) => item.kind === "highlight"),
  };
  return `${content}\n\n<!-- ${MARKDOWN_ANNOTATIONS_MARKER}\n${JSON.stringify(payload)}\n-->\n`;
}

function allLiteralRanges(source: string, quote: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  while (cursor <= source.length - quote.length) {
    const start = source.indexOf(quote, cursor);
    if (start < 0) break;
    ranges.push({ start, end: start + quote.length });
    cursor = start + Math.max(1, quote.length);
  }
  return ranges;
}

export function reconnectMarkdownAnnotation(
  markdown: string,
  annotation: RaaviAnnotation,
): RaaviAnnotation {
  const direct = markdown.slice(annotation.start, annotation.end);
  if (direct === annotation.quote) {
    return { ...annotation, status: annotation.status === "detached" ? "open" : annotation.status };
  }
  const ranges = allLiteralRanges(markdown, annotation.quote);
  const candidates = ranges.filter(({ start, end }) => {
    const prefix = markdown.slice(Math.max(0, start - annotation.prefix.length), start);
    const suffix = markdown.slice(end, end + annotation.suffix.length);
    return (
      (!annotation.prefix || prefix.endsWith(annotation.prefix)) &&
      (!annotation.suffix || suffix.startsWith(annotation.suffix))
    );
  });
  const matches = candidates.length === 1 ? candidates : ranges.length === 1 ? ranges : [];
  if (matches.length !== 1) return { ...annotation, status: "detached" };
  return {
    ...annotation,
    start: matches[0].start,
    end: matches[0].end,
    approximateStart: matches[0].start,
    approximateEnd: matches[0].end,
    status: annotation.status === "detached" ? "open" : annotation.status,
  };
}

export function reconnectMarkdownAnnotations(
  markdown: string,
  annotations: readonly RaaviAnnotation[],
) {
  return annotations.map((annotation) =>
    reconnectMarkdownAnnotation(markdown, annotation),
  );
}
