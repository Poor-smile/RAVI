import assert from "node:assert/strict";
import test from "node:test";
import {
  audioMetadataLooksComplete,
  minimumSpeechDurationMs,
  shouldPreSplitSpeech,
  speechWordCount,
  splitSpeechForRetry,
} from "../desktop/tts-audio-policy.mjs";

test("audio completeness rejects implausibly short Persian speech", () => {
  const text = "این یک جملهٔ فارسی نسبتاً بلند برای تشخیص خروجی ناقص موتور است.";
  const minimum = minimumSpeechDurationMs(text, 1);
  assert.ok(minimum > 1_000);
  assert.equal(audioMetadataLooksComplete(text, 1, {
    frames: 2_000,
    sampleRate: 24_000,
    speechDurationMs: minimum - 1,
  }), false);
  assert.equal(audioMetadataLooksComplete(text, 1, {
    frames: 48_000,
    sampleRate: 24_000,
    speechDurationMs: minimum + 1,
  }), true);
});

test("long Ava text is proactively split at a natural boundary", () => {
  const text = "این بخش اول برای آزمون است، و این بخش دوم توضیح کامل‌تری دارد تا موتور آوا هیچ کلمه‌ای را در میانهٔ جمله جا نیندازد و همهٔ متن به صورت کامل شنیده شود.";
  assert.equal(shouldPreSplitSpeech("ava", text), true);
  assert.equal(shouldPreSplitSpeech("mana", text), false);
  const pieces = splitSpeechForRetry(text);
  assert.equal(pieces.length, 2);
  assert.equal(pieces.join(" ").replace(/\s+/gu, " "), text.replace(/\s+/gu, " "));
  assert.ok(pieces.every((piece) => speechWordCount(piece) > 0));
});

test("Gooya uses a conservative text budget to avoid skipped endings", () => {
  const shortText = "این جملهٔ کوتاه باید در یک مرحله و بدون تقسیم خوانده شود.";
  const longText = "این جمله برای موتور گویای فارسی کمی طولانی‌تر نوشته شده است تا راوی پیش از ساخت صدا آن را در مرز طبیعی به قطعات امن تقسیم کند و هیچ بخش مهمی از پایان جمله جا نیفتد.";
  assert.equal(shouldPreSplitSpeech("gooya", shortText), false);
  assert.equal(shouldPreSplitSpeech("gooya", longText), true);
  const pieces = splitSpeechForRetry(longText);
  assert.equal(pieces.length, 2);
  assert.equal(pieces.join(" ").replace(/\s+/gu, " "), longText.replace(/\s+/gu, " "));
});

test("Persian IPA F5 pre-splits long input before G2P and synthesis", () => {
  const shortText = "این جملهٔ کوتاه باید پیوسته و کامل خوانده شود.";
  const longText = "این جمله برای موتور فارسی آی‌پی‌ای اف پنج کمی طولانی‌تر نوشته شده است تا راوی پیش از آوانویسی و ساخت صدا آن را در مرزهای طبیعی تقسیم کند و پایان جمله از دست نرود.";
  assert.equal(shouldPreSplitSpeech("f5ipa", shortText), false);
  assert.equal(shouldPreSplitSpeech("f5ipa", longText), true);
  const pieces = splitSpeechForRetry(longText);
  assert.ok(pieces.length >= 2);
  assert.equal(pieces.join(" ").replace(/\s+/gu, " "), longText.replace(/\s+/gu, " "));
});
