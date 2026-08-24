export type PersianAiSuggestion = {
  id: string;
  category: string;
  reason: string;
  current: string;
  replacement: string;
  occurrence: number;
  start: number;
  end: number;
};

export type PersianAiReviewResult = {
  summary: string;
  suggestions: PersianAiSuggestion[];
};

export type PersianAiReviewRawResult = {
  summary?: unknown;
  suggestions?: unknown;
};

export type PersianAiReviewCost = "کم" | "متوسط" | "زیاد";

const MAX_SUGGESTIONS = 80;
const MAX_QUOTE_LENGTH = 2_000;
const MAX_REPLACEMENT_LENGTH = 5_000;

const protectedPatterns = [
  /```[\s\S]*?```/gu,
  /`[^`\r\n]+`/gu,
  /https?:\/\/[^\s<>()]+/giu,
  /(?:[A-Za-z]:\\(?:[^\\\r\n:*?"<>|]+\\)*[^\\\r\n:*?"<>|]*)/gu,
  /(?:^|[\s("'\[])(\.{0,2}\/(?:[^\s/]+\/)*[^\s)\]"']+)/gmu,
];

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function countLiteral(source: string, needle: string) {
  if (!needle) return 0;
  let count = 0;
  let cursor = 0;
  while (cursor <= source.length - needle.length) {
    const index = source.indexOf(needle, cursor);
    if (index < 0) break;
    count += 1;
    cursor = index + needle.length;
  }
  return count;
}

export function extractProtectedPersianReviewTokens(value: string) {
  const tokens = new Set<string>();
  for (const pattern of protectedPatterns) {
    pattern.lastIndex = 0;
    for (const match of value.matchAll(pattern)) {
      const token = match[1] ?? match[0];
      if (token.trim()) tokens.add(token.trim());
    }
  }
  return [...tokens];
}

export function preservesPersianReviewTechnicalText(
  current: string,
  replacement: string,
) {
  return extractProtectedPersianReviewTokens(current).every(
    (token) => countLiteral(replacement, token) >= countLiteral(current, token),
  );
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

export function normalizePersianAiReviewResult(
  raw: PersianAiReviewRawResult,
  source: string,
): PersianAiReviewResult {
  const candidates = Array.isArray(raw.suggestions)
    ? raw.suggestions.slice(0, MAX_SUGGESTIONS)
    : [];
  const accepted: PersianAiSuggestion[] = [];

  for (const [index, value] of candidates.entries()) {
    if (!value || typeof value !== "object") continue;
    const candidate = value as Record<string, unknown>;
    const current = safeText(candidate.current, MAX_QUOTE_LENGTH);
    const replacement = safeText(candidate.replacement, MAX_REPLACEMENT_LENGTH);
    const reason = safeText(candidate.reason, 500);
    const category = safeText(candidate.category, 80) || "نگارش";
    const occurrenceValue = Number(candidate.occurrence);
    const occurrence =
      Number.isSafeInteger(occurrenceValue) && occurrenceValue > 0
        ? occurrenceValue
        : 1;
    if (
      !current ||
      !replacement ||
      current === replacement ||
      !reason ||
      !preservesPersianReviewTechnicalText(current, replacement)
    ) {
      continue;
    }
    const range = occurrenceRange(source, current, occurrence);
    if (!range) continue;
    if (
      accepted.some(
        (suggestion) =>
          range.start < suggestion.end && range.end > suggestion.start,
      )
    ) {
      continue;
    }
    accepted.push({
      id: `persian-ai-${range.start}-${range.end}-${index}`,
      category,
      reason,
      current,
      replacement,
      occurrence,
      ...range,
    });
  }

  accepted.sort((a, b) => a.start - b.start);
  return {
    summary:
      safeText(raw.summary, 500) ||
      `${accepted.length.toLocaleString("fa-IR")} پیشنهاد هوشمند پیدا شد.`,
    suggestions: accepted,
  };
}

export function estimatePersianAiReviewCost(
  characterCount: number,
): PersianAiReviewCost {
  if (characterCount <= 8_000) return "کم";
  if (characterCount <= 30_000) return "متوسط";
  return "زیاد";
}

export function applyPersianAiSuggestion(
  document: string,
  suggestion: PersianAiSuggestion,
) {
  if (!preservesPersianReviewTechnicalText(suggestion.current, suggestion.replacement)) {
    return { ok: false as const, reason: "protected-text" as const };
  }
  const direct = document.slice(suggestion.start, suggestion.end);
  const range =
    direct === suggestion.current
      ? { start: suggestion.start, end: suggestion.end }
      : occurrenceRange(document, suggestion.current, suggestion.occurrence);
  if (!range) return { ok: false as const, reason: "conflict" as const };
  return {
    ok: true as const,
    document:
      document.slice(0, range.start) +
      suggestion.replacement +
      document.slice(range.end),
    range,
  };
}

export function applyAllPersianAiSuggestions(
  document: string,
  suggestions: readonly PersianAiSuggestion[],
) {
  const sorted = [...suggestions].sort((a, b) => b.start - a.start);
  let next = document;
  for (const suggestion of sorted) {
    const result = applyPersianAiSuggestion(next, suggestion);
    if (!result.ok) return result;
    next = result.document;
  }
  return { ok: true as const, document: next };
}
