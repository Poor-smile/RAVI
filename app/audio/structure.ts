import type {
  AudioContentKind,
  AudioStructuredResult,
  AudioTranscriptSegment,
} from "./types";

const KIND_LABELS: Record<AudioContentKind, string> = {
  meeting: "جلسه",
  interview: "مصاحبه",
  lecture: "درس یا سخنرانی",
  "phone-call": "تماس تلفنی",
  "voice-note": "یادداشت صوتی",
  conversation: "گفت‌وگو",
  general: "محتوای عمومی",
};

export function suggestAudioContentKind(text: string): AudioContentKind {
  const value = text.toLocaleLowerCase("fa-IR");
  if (/جلسه|دستور جلسه|مصوبه|تصمیم|اقدام بعدی|صورت[‌ ]جلسه/u.test(value)) {
    return "meeting";
  }
  if (/مصاحبه|پرسش|سؤال|جواب|پاسخ‌دهنده/u.test(value)) return "interview";
  if (/درس|کلاس|استاد|دانشجو|سرفصل|امتحان|سخنرانی/u.test(value)) {
    return "lecture";
  }
  if (/تماس|تلفن|الو|شماره تماس/u.test(value)) return "phone-call";
  if (/یادداشت صوتی|برای خودم|یادم باشد/u.test(value)) return "voice-note";
  if (/گفت[‌ ]و[‌ ]گو|صحبت|دوستانه/u.test(value)) return "conversation";
  return "general";
}

function formatTimestamp(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toLocaleString("fa-IR")}:${seconds
    .toString()
    .padStart(2, "0")
    .replace(/\d/gu, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])}`;
}

function paragraphs(segments: readonly AudioTranscriptSegment[]) {
  const values: string[] = [];
  let current = "";
  for (const segment of segments) {
    const text = segment.text.trim();
    if (!text) continue;
    current = current ? `${current} ${text}` : text;
    if (current.length >= 360 || /[.!؟…]$/u.test(text)) {
      values.push(current);
      current = "";
    }
  }
  if (current) values.push(current);
  return values;
}

export function buildLocalStructuredTranscript(
  segments: readonly AudioTranscriptSegment[],
  kind = suggestAudioContentKind(segments.map((item) => item.text).join(" ")),
): AudioStructuredResult {
  const body = paragraphs(segments);
  const kindLabel = KIND_LABELS[kind];
  const title = kind === "meeting" ? "خلاصهٔ جلسه" : `رونوشت ${kindLabel}`;
  const uncertain = segments.filter((item) => item.uncertain);
  const sections: string[] = [`## ${title}`];

  if (kind === "meeting") {
    const decisions = body.filter((item) => /تصمیم|توافق|مصوب/u.test(item));
    const actions = body.filter((item) => /باید|پیگیری|تحویل|اقدام/u.test(item));
    sections.push(
      body[0] ? `### خلاصه\n\n${body[0]}` : "### خلاصه\n\nمتن جلسه آماده شد.",
      `### تصمیم‌ها\n\n${
        decisions.length ? decisions.map((item) => `- ${item}`).join("\n") : "- مورد صریحی تشخیص داده نشد."
      }`,
      `### کارهای بعدی\n\n${
        actions.length ? actions.map((item) => `- [ ] ${item}`).join("\n") : "- [ ] نیازمند تکمیل توسط کاربر"
      }`,
    );
  } else if (kind === "interview") {
    sections.push(`### متن بخش‌بندی‌شده\n\n${body.join("\n\n")}`);
  } else if (kind === "lecture") {
    sections.push(`### نکته‌ها\n\n${body.map((item) => `- ${item}`).join("\n")}`);
  } else {
    sections.push(`### متن پاک‌سازی‌نشده\n\n${body.join("\n\n")}`);
  }

  if (uncertain.length) {
    sections.push(
      `### نیاز به شنیدن دوباره\n\n${uncertain
        .map(
          (item) =>
            `- **${formatTimestamp(item.startMs)}** — ${item.text.trim() || "بخش نامطمئن"}`,
        )
        .join("\n")}`,
    );
  }

  return { kind, kindLabel, title, markdown: sections.join("\n\n") };
}

export function rawTranscriptMarkdown(
  segments: readonly AudioTranscriptSegment[],
) {
  return segments
    .map(
      (item) =>
        `- **${formatTimestamp(item.startMs)}–${formatTimestamp(item.endMs)}** ${item.text.trim()}`,
    )
    .join("\n");
}
