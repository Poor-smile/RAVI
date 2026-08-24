import { annotationFingerprint } from "../markdown/annotations";
import type { RaaviAnnotation } from "../raavi";

export type SmartAnnotationRawResult = { summary?: unknown; findings?: unknown };
export type SmartAnnotationResult = { summary: string; annotations: RaaviAnnotation[] };

const allowedCategories = new Set([
  "ابهام", "تناقض", "تکرار", "پرش روایی", "ناهماهنگی اصطلاحات",
  "ساختار عنوان‌ها", "مقدمه و نتیجه‌گیری", "ادعای نیازمند توضیح",
  "جدول یا فهرست", "سایر",
]);

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function occurrenceRange(source: string, quote: string, occurrence: number) {
  let cursor = 0;
  let found = -1;
  for (let index = 0; index < occurrence; index += 1) {
    found = source.indexOf(quote, cursor);
    if (found < 0) return null;
    cursor = found + quote.length;
  }
  return { start: found, end: found + quote.length };
}

function blockIdAt(source: string, start: number) {
  const before = source.slice(0, start);
  const blockStart = Math.max(before.lastIndexOf("\n\n") + 2, 0);
  const blockEndValue = source.indexOf("\n\n", start);
  const blockEnd = blockEndValue < 0 ? source.length : blockEndValue;
  const block = source.slice(blockStart, blockEnd).trim();
  let hash = 2166136261;
  for (let index = 0; index < block.length; index += 1) {
    hash ^= block.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `block-${(hash >>> 0).toString(36)}`;
}

export function normalizeSmartAnnotationResult(raw: SmartAnnotationRawResult, source: string): SmartAnnotationResult {
  const values = Array.isArray(raw.findings) ? raw.findings.slice(0, 80) : [];
  const annotations: RaaviAnnotation[] = [];
  for (const [index, value] of values.entries()) {
    if (!value || typeof value !== "object") continue;
    const candidate = value as Record<string, unknown>;
    const quote = safeText(candidate.current, 5_000);
    const body = safeText(candidate.reason, 2_000);
    const suggestion = safeText(candidate.replacement, 8_000);
    const occurrenceValue = Number(candidate.occurrence);
    const occurrence = Number.isSafeInteger(occurrenceValue) && occurrenceValue > 0 ? occurrenceValue : 1;
    const range = occurrenceRange(source, quote, occurrence);
    if (!range || !quote || !body) continue;
    if (annotations.some((annotation) => range.start < annotation.end && range.end > annotation.start)) continue;
    const prefix = source.slice(Math.max(0, range.start - 80), range.start);
    const suffix = source.slice(range.end, range.end + 80);
    const categoryValue = safeText(candidate.category, 80);
    const confidenceValue = Number(candidate.confidence);
    annotations.push({
      id: `smart-annotation-${range.start}-${range.end}-${index}`,
      kind: "comment",
      start: range.start,
      end: range.end,
      quote,
      prefix,
      suffix,
      body,
      createdAt: new Date().toISOString(),
      source: "raavi-ai",
      category: allowedCategories.has(categoryValue) ? categoryValue : "سایر",
      suggestion,
      confidence: Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue)) : 0.7,
      status: "open",
      blockId: blockIdAt(source, range.start),
      approximateStart: range.start,
      approximateEnd: range.end,
      fingerprint: annotationFingerprint(quote, prefix, suffix),
    });
  }
  return {
    summary: safeText(raw.summary, 500) || `${annotations.length.toLocaleString("fa-IR")} نشانه پیدا شد.`,
    annotations,
  };
}

export function smartAnnotationCategorySummary(annotations: readonly RaaviAnnotation[]) {
  const counts = new Map<string, number>();
  for (const annotation of annotations) {
    if (annotation.source !== "raavi-ai" || annotation.status === "detached") continue;
    const category = annotation.category || "سایر";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts.entries()].map(([category, count]) => ({ category, count }));
}
