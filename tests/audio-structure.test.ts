import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLocalStructuredTranscript,
  rawTranscriptMarkdown,
  suggestAudioContentKind,
} from "../app/audio/structure";

const segments = [
  { id: "1", startMs: 0, endMs: 5_000, text: "جلسه را شروع می‌کنیم.", confidence: 0.91, uncertain: false },
  { id: "2", startMs: 5_000, endMs: 11_000, text: "تصمیم شد نسخه فردا منتشر شود.", confidence: 0.88, uncertain: false },
  { id: "3", startMs: 11_000, endMs: 14_000, text: "نام مشتری نامفهوم بود.", confidence: 0.31, uncertain: true },
];

test("content kind is suggested without forcing every recording into meeting", () => {
  assert.equal(suggestAudioContentKind("در این جلسه تصمیم شد اقدام بعدی ثبت شود"), "meeting");
  assert.equal(suggestAudioContentKind("سؤال: چرا؟ پاسخ: برای آزمون"), "interview");
  assert.equal(suggestAudioContentKind("یک یادداشت کوتاه برای خودم"), "voice-note");
});

test("raw transcript is always timed and structured result preserves uncertainty", () => {
  const raw = rawTranscriptMarkdown(segments);
  assert.match(raw, /۰:۰۰/);
  assert.match(raw, /۰:۱۱/);
  const result = buildLocalStructuredTranscript(segments, "meeting");
  assert.equal(result.kind, "meeting");
  assert.match(result.markdown, /تصمیم‌ها/);
  assert.match(result.markdown, /نیاز به شنیدن دوباره/);
});
