export type PersianReviewIssueId =
  | "arabic-characters"
  | "half-space"
  | "punctuation-spacing"
  | "heading-spacing"
  | "trailing-space"
  | "blank-lines";
export type PersianReviewIssue = {
  id: PersianReviewIssueId;
  title: string;
  detail: string;
  count: number;
};

export function countDocumentWords(markdown: string) {
  const visibleText = markdown
    .replace(/^ {0,3}(?:`{3,}|~{3,})[^\n]*$/gmu, " ")
    .replace(/^ {0,3}(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\]\s*)?/gmu, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1");
  return (
    visibleText.match(/[\p{L}\p{N}]+(?:[\u200c\u200d'’_-][\p{L}\p{N}]+)*/gu)
      ?.length ?? 0
  );
}


const PERSIAN_REVIEW_DEFINITIONS: Array<Omit<PersianReviewIssue, "count">> = [
  {
    id: "arabic-characters",
    title: "نویسه‌های عربی",
    detail: "ی و ک عربی → فارسی",
  },
  {
    id: "half-space",
    title: "نیم‌فاصله",
    detail: "می/نمی و واژهٔ بعد",
  },
  {
    id: "punctuation-spacing",
    title: "فاصلهٔ نشانه‌ها",
    detail: "پیش و پس از نشانه",
  },
  {
    id: "heading-spacing",
    title: "تیتر Markdown",
    detail: "فاصلهٔ پس از #",
  },
  {
    id: "trailing-space",
    title: "فاصلهٔ انتهای خط",
    detail: "فاصله‌های پنهان انتهای خط",
  },
  {
    id: "blank-lines",
    title: "خط‌های خالی اضافه",
    detail: "فاصلهٔ عمودی سند",
  },
];

export function analyzePersianMarkdown(markdown: string): PersianReviewIssue[] {
  const counts: Record<PersianReviewIssueId, number> = {
    "arabic-characters": 0,
    "half-space": 0,
    "punctuation-spacing": 0,
    "heading-spacing": 0,
    "trailing-space": 0,
    "blank-lines": 0,
  };
  const lines = markdown.split(/\r?\n/u);
  let fenceMarker = "";
  let blankRun = 0;

  for (const line of lines) {
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/u);
    if (fence) {
      const marker = fence[1][0];
      fenceMarker = fenceMarker === marker ? "" : fenceMarker || marker;
      blankRun = 0;
      continue;
    }
    if (fenceMarker) continue;

    counts["arabic-characters"] += line.match(/[\u064A\u0643]/gu)?.length ?? 0;
    counts["half-space"] +=
      line.match(/(^|[^\p{L}\p{N}_])(?:ن?می) /gu)?.length ?? 0;
    counts["punctuation-spacing"] +=
      (line.match(/\s+[،؛؟!]/gu)?.length ?? 0) +
      (line.match(/[،؛؟!](?=\S)/gu)?.length ?? 0);
    counts["heading-spacing"] += /^ {0,3}#{1,6}[^\s#]/u.test(line) ? 1 : 0;
    counts["trailing-space"] += /[ \t]+$/u.test(line) ? 1 : 0;

    if (!line.trim()) {
      blankRun += 1;
      if (blankRun > 1) counts["blank-lines"] += 1;
    } else {
      blankRun = 0;
    }
  }

  return PERSIAN_REVIEW_DEFINITIONS.map((issue) => ({
    ...issue,
    count: counts[issue.id],
  }));
}


export function analyzeDocument(content: string) { return { words: countDocumentWords(content), lines: content.split(/\r?\n/u).length, review: analyzePersianMarkdown(content) }; }
