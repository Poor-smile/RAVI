export type ReadableSentence = {
  text: string;
  sourceText?: string;
  start: number;
  end: number;
  pauseAfterMs?: number;
};

export type ReadableBlock = {
  id: string;
  element: HTMLElement;
  text: string;
  sentences: ReadableSentence[];
};

const BLOCK_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,caption,tr,td,th";
const MAX_UTTERANCE_CHARACTERS = 170;
const MAX_UTTERANCE_WORDS = 24;
const MIN_NATURAL_CHUNK_CHARACTERS = 54;
const SKIP_SELECTOR = [
  "pre",
  "code",
  ".mermaid-diagram",
  ".audio-player-block",
  ".reading-document-kicker",
  "[aria-hidden='true']",
  "[data-tts-skip]",
].join(",");

const LATIN_LETTER_NAMES: Record<string, string> = {
  A: "اِی", B: "بی", C: "سی", D: "دی", E: "ای", F: "اِف", G: "جی",
  H: "اِچ", I: "آی", J: "جِی", K: "کِی", L: "اِل", M: "اِم", N: "اِن",
  O: "اُو", P: "پی", Q: "کیو", R: "آر", S: "اِس", T: "تی", U: "یو",
  V: "وی", W: "دابلیو", X: "اِکس", Y: "وای", Z: "زِد",
};

export function normalizePersianSpeechText(value: string) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[يى]/gu, "ی")
    .replace(/ك/gu, "ک")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, "")
    .replace(/[\u200b\u2060\ufeff]/gu, "")
    .replace(/[0-9]/gu, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)] ?? digit)
    .replace(/\b[A-Z]{2,6}\b/gu, (token) => (
      [...token].map((letter) => LATIN_LETTER_NAMES[letter] ?? letter).join("‌")
    ))
    .replace(/%/gu, " درصد ")
    .replace(/\s*([،؛؟!])\s*/gu, "$1 ")
    .replace(/\s*([,:;])\s*/gu, "$1 ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function spokenSentenceText(value: string) {
  return normalizePersianSpeechText(
    String(value ?? "")
      .replace(/(?:https?:\/\/|www\.)\S+/giu, " ")
      .replace(/&/gu, " و "),
  );
}

function naturalChunkEnd(value: string, start: number) {
  const remaining = value.slice(start);
  const words = Array.from(remaining.matchAll(/\S+/gu));
  const wordLimit = words[MAX_UTTERANCE_WORDS]?.index;
  const limit = Math.min(
    value.length,
    start + MAX_UTTERANCE_CHARACTERS,
    wordLimit === undefined ? value.length : start + wordLimit,
  );
  if (limit >= value.length) return value.length;
  const minimum = Math.min(limit, start + MIN_NATURAL_CHUNK_CHARACTERS);
  for (let index = limit; index >= minimum; index -= 1) {
    if (/[،,؛;:.!?؟]/u.test(value[index - 1] ?? "")) return index;
  }
  for (let index = limit; index >= minimum; index -= 1) {
    if (/\s/u.test(value[index - 1] ?? "")) return index;
  }
  return limit;
}

function splitUtterance(value: string, absoluteStart: number): ReadableSentence[] {
  const rows: ReadableSentence[] = [];
  let start = 0;
  while (start < value.length) {
    const end = naturalChunkEnd(value, start);
    const spoken = spokenSentenceText(value.slice(start, end));
    if (spoken) rows.push({ text: spoken, start: absoluteStart + start, end: absoluteStart + end });
    start = Math.max(end, start + 1);
  }
  return rows;
}

export function splitReadableSentences(value: string): ReadableSentence[] {
  const text = String(value ?? "");
  if (!text.trim()) return [];
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("fa", { granularity: "sentence" });
    return Array.from(segmenter.segment(text)).flatMap((segment) => (
      splitUtterance(segment.segment, segment.index)
    ));
  }
  const rows: ReadableSentence[] = [];
  const matcher = /[^.!?؟؛\n]+(?:[.!?؟؛]+|\n+|$)/gu;
  for (const match of text.matchAll(matcher)) {
    const start = match.index ?? 0;
    rows.push(...splitUtterance(match[0], start));
  }
  return rows;
}

function rowOrdinal(value: number) {
  const ordinals = ["اول", "دوم", "سوم", "چهارم", "پنجم", "ششم", "هفتم", "هشتم", "نهم", "دهم"];
  return ordinals[value - 1] ?? value.toLocaleString("fa-IR");
}

function tableRowSpeech(row: HTMLTableRowElement) {
  const table = row.closest("table") as HTMLTableElement | null;
  if (!table) return "";
  const cells = Array.from(row.cells);
  if (!cells.length || cells.every((cell) => cell.tagName === "TH")) return "";
  const headerRow = table.tHead?.rows.item(table.tHead.rows.length - 1) ??
    Array.from(table.rows).find((candidate) => (
      Array.from(candidate.cells).length > 0 && Array.from(candidate.cells).every((cell) => cell.tagName === "TH")
    )) ?? null;
  const headers = headerRow ? Array.from(headerRow.cells) : [];
  const dataRows = Array.from(table.rows).filter((candidate) => (
    Array.from(candidate.cells).some((cell) => cell.tagName !== "TH")
  ));
  const rowNumber = Math.max(1, dataRows.indexOf(row) + 1);
  const values = cells.flatMap((cell, index) => {
    const value = spokenSentenceText(readableTextWithSkippedDescendants(cell));
    if (!value) return [];
    const header = spokenSentenceText(readableTextWithSkippedDescendants(headers[index] ?? cell));
    const label = headers[index] && header && headers[index] !== cell
      ? header
      : cell.tagName === "TH"
        ? "عنوان ردیف"
        : `ستون ${(index + 1).toLocaleString("fa-IR")}`;
    return [`${label}: ${value}`];
  });
  return values.length ? `ردیف ${rowOrdinal(rowNumber)}، ${values.join("، ")}.` : "";
}

export function readableTextWithSkippedDescendants(root: HTMLElement) {
  const documentValue = root.ownerDocument;
  const showText = documentValue.defaultView?.NodeFilter.SHOW_TEXT ?? 4;
  const walker = documentValue.createTreeWalker(root, showText);
  let value = "";
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    value += parent?.closest(SKIP_SELECTOR)
      ? " ".repeat(node.data.length)
      : node.data;
  }
  return value;
}

export function collectReadableBlocks(article: HTMLElement): ReadableBlock[] {
  const candidates = Array.from(
    article.querySelectorAll<HTMLElement>(BLOCK_SELECTOR),
  );
  return candidates
    .filter((element) => {
      if (element.matches(SKIP_SELECTOR) || element.closest(SKIP_SELECTOR)) return false;
      if ((element.matches("td") || element.matches("th")) && element.closest("tr")) return false;
      if (element.matches("tr")) return Boolean(tableRowSpeech(element as HTMLTableRowElement));
      if (element.querySelector(BLOCK_SELECTOR)) return false;
      if (element.getClientRects().length === 0) return false;
      return true;
    })
    .map((element, index) => {
      const text = element.textContent ?? "";
      if (element.matches("tr")) {
        const speech = tableRowSpeech(element as HTMLTableRowElement);
        return {
          id: `reading-block-${index}`,
          element,
          text,
          sentences: splitReadableSentences(speech).map((sentence) => ({
            ...sentence,
            start: 0,
            end: text.length,
          })),
        };
      }
      const readableText = readableTextWithSkippedDescendants(element);
      return {
        id: `reading-block-${index}`,
        element,
        text,
        sentences: splitReadableSentences(readableText),
      };
    })
    .filter((block) => block.sentences.length > 0);
}

export function rangeFromElementOffsets(
  root: HTMLElement,
  start: number,
  end: number,
) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let startNode: Text | null = null;
  let endNode: Text | null = null;
  let startOffset = 0;
  let endOffset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const next = consumed + node.data.length;
    if (!startNode && start <= next) {
      startNode = node;
      startOffset = Math.max(0, start - consumed);
    }
    if (end <= next) {
      endNode = node;
      endOffset = Math.max(0, end - consumed);
      break;
    }
    consumed = next;
  }
  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, Math.min(startOffset, startNode.data.length));
  range.setEnd(endNode, Math.min(endOffset, endNode.data.length));
  return range;
}
