import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSmartAnnotationResult } from "../app/ai/smart-annotations";

test("smart annotation findings become anchored Raavi comments", () => {
  const source = "مقدمه روشن است. این تصمیم در مرحله بعد اجرا می‌شود.";
  const result = normalizeSmartAnnotationResult(
    {
      summary: "یک ابهام پیدا شد.",
      findings: [
        {
          category: "ابهام",
          reason: "مرحلهٔ بعد مشخص نیست.",
          current: "این تصمیم در مرحله بعد اجرا می‌شود.",
          replacement: "این تصمیم پس از تأیید مدیر محصول اجرا می‌شود.",
          occurrence: 1,
          confidence: 0.91,
        },
      ],
    },
    source,
  );
  assert.equal(result.annotations.length, 1);
  assert.equal(result.annotations[0].source, "raavi-ai");
  assert.equal(result.annotations[0].category, "ابهام");
  assert.equal(result.annotations[0].status, "open");
  assert.ok(result.annotations[0].fingerprint);
});

test("findings that do not quote the frozen document are discarded", () => {
  const result = normalizeSmartAnnotationResult(
    {
      findings: [
        {
          category: "تناقض",
          reason: "نمونه",
          current: "متنی که وجود ندارد",
          replacement: "جایگزین",
          occurrence: 1,
          confidence: 1,
        },
      ],
    },
    "سند واقعی",
  );
  assert.equal(result.annotations.length, 0);
});
