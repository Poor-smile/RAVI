import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAllPersianAiSuggestions,
  applyPersianAiSuggestion,
  estimatePersianAiReviewCost,
  normalizePersianAiReviewResult,
  preservesPersianReviewTechnicalText,
} from "../app/ai/persian-review";

test("normalizes AI suggestions against exact frozen Persian quotes", () => {
  const source = "تیم فروش گفت این موارد باید بررسی شود. سپس گزارش ارسال شد.";
  const result = normalizePersianAiReviewResult(
    {
      summary: "یک ابهام پیدا شد.",
      suggestions: [
        {
          category: "ابهام",
          reason: "فاعل جمله روشن نیست.",
          current: "این موارد باید بررسی شود.",
          replacement: "تیم کنترل کیفیت باید این موارد را بررسی کند.",
          occurrence: 1,
        },
      ],
    },
    source,
  );
  assert.equal(result.suggestions.length, 1);
  assert.equal(
    source.slice(result.suggestions[0].start, result.suggestions[0].end),
    result.suggestions[0].current,
  );
});

test("rejects suggestions that rewrite code, URLs, or file paths", () => {
  assert.equal(
    preservesPersianReviewTechnicalText(
      "فایل `app/page.tsx` را در https://raavi.example ببینید.",
      "فایل `app/main.tsx` را در https://example.com ببینید.",
    ),
    false,
  );
  const source = "فایل `app/page.tsx` را بررسی کنید.";
  const result = normalizePersianAiReviewResult(
    {
      suggestions: [
        {
          category: "فنی",
          reason: "بازنویسی",
          current: source,
          replacement: "فایل `app/main.tsx` را بررسی کنید.",
          occurrence: 1,
        },
      ],
    },
    source,
  );
  assert.equal(result.suggestions.length, 0);
});

test("applies one suggestion and detects a concurrent edit", () => {
  const source = "این موارد باید بررسی شود.";
  const [suggestion] = normalizePersianAiReviewResult(
    {
      suggestions: [
        {
          category: "ابهام",
          reason: "فاعل روشن نیست.",
          current: source,
          replacement: "تیم کنترل کیفیت این موارد را بررسی کند.",
          occurrence: 1,
        },
      ],
    },
    source,
  ).suggestions;
  assert.equal(applyPersianAiSuggestion(source, suggestion).ok, true);
  assert.equal(
    applyPersianAiSuggestion("متن هم‌زمان تغییر کرد.", suggestion).ok,
    false,
  );
});

test("applies a confirmed group from the end without shifting offsets", () => {
  const source = "این جمله مبهم است. آن جمله طولانی است.";
  const suggestions = normalizePersianAiReviewResult(
    {
      suggestions: [
        {
          category: "ابهام",
          reason: "فاعل روشن نیست.",
          current: "این جمله مبهم است.",
          replacement: "جملهٔ نخست مبهم است.",
          occurrence: 1,
        },
        {
          category: "ایجاز",
          reason: "عبارت کوتاه‌تر می‌شود.",
          current: "آن جمله طولانی است.",
          replacement: "جملهٔ دوم طولانی است.",
          occurrence: 1,
        },
      ],
    },
    source,
  ).suggestions;
  const result = applyAllPersianAiSuggestions(source, suggestions);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(
      result.document,
      "جملهٔ نخست مبهم است. جملهٔ دوم طولانی است.",
    );
  }
});

test("applies the remaining group after an earlier suggestion changed offsets", () => {
  const source = "این جمله مبهم است. آن جمله طولانی است.";
  const suggestions = normalizePersianAiReviewResult(
    {
      suggestions: [
        {
          category: "ابهام",
          reason: "فاعل روشن نیست.",
          current: "این جمله مبهم است.",
          replacement: "این جملهٔ نخست، برای خواننده کاملاً مبهم است.",
          occurrence: 1,
        },
        {
          category: "ایجاز",
          reason: "عبارت کوتاه‌تر می‌شود.",
          current: "آن جمله طولانی است.",
          replacement: "جملهٔ دوم طولانی است.",
          occurrence: 1,
        },
      ],
    },
    source,
  ).suggestions;
  const first = applyPersianAiSuggestion(source, suggestions[0]);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const result = applyAllPersianAiSuggestions(first.document, suggestions.slice(1));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(
      result.document,
      "این جملهٔ نخست، برای خواننده کاملاً مبهم است. جملهٔ دوم طولانی است.",
    );
  }
});

test("estimates document review usage in three clear bands", () => {
  assert.equal(estimatePersianAiReviewCost(2_000), "کم");
  assert.equal(estimatePersianAiReviewCost(15_000), "متوسط");
  assert.equal(estimatePersianAiReviewCost(60_000), "زیاد");
});
