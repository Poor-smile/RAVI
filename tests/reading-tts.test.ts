import assert from "node:assert/strict";
import test from "node:test";
import {
  collectReadableBlocks,
  normalizePersianSpeechText,
  readableTextWithSkippedDescendants,
  splitReadableSentences,
  spokenSentenceText,
} from "../app/tts/reading-text";
import { JSDOM } from "jsdom";

test("Persian narration splits sentences while preserving source offsets", () => {
  const source = "این جملهٔ اول است. این هم جملهٔ دوم است؟ بله!";
  const sentences = splitReadableSentences(source);
  assert.equal(sentences.length, 3);
  assert.equal(sentences[0].text, "این جملهٔ اول است.");
  assert.equal(source.slice(sentences[1].start, sentences[1].end).trim(), "این هم جملهٔ دوم است؟");
  assert.equal(sentences[2].text, "بله!");
});

test("long Persian sentences are split automatically at natural boundaries", () => {
  const source = `${"این بخش برای آزمون خواندن روان است، ".repeat(18)}پایان.`;
  const sentences = splitReadableSentences(source);
  assert.ok(sentences.length >= 3);
  assert.ok(sentences.every((sentence) => sentence.text.length <= 170));
  assert.ok(sentences.every((sentence) => sentence.text.split(/\s+/u).length <= 24));
  assert.equal(sentences[0].start, 0);
  assert.equal(sentences.at(-1)?.end, source.length);
});

test("local Persian preprocessing normalizes letters, digits and abbreviations", () => {
  assert.equal(
    normalizePersianSpeechText("API شماره 12 با 25% كارایی"),
    "اِی‌پی‌آی شماره ۱۲ با ۲۵ درصد کارایی",
  );
});

test("raw URLs are omitted from spoken Persian", () => {
  assert.equal(
    spokenSentenceText("جزئیات در https://example.com/path موجود است."),
    "جزئیات در موجود است.",
  );
});

test("inline and block code descendants are masked without shifting offsets", () => {
  const dom = new JSDOM("<p>این متن <code>const secret = true;</code> ادامه دارد.</p>");
  const paragraph = dom.window.document.querySelector("p") as HTMLElement;
  const source = paragraph.textContent ?? "";
  const readable = readableTextWithSkippedDescendants(paragraph);
  assert.equal(readable.length, source.length);
  assert.equal(readable.includes("secret"), false);
  assert.equal(spokenSentenceText(readable), "این متن ادامه دارد.");
});

test("table rows repeat column headers before each cell value", () => {
  const dom = new JSDOM(`
    <article>
      <table>
        <thead><tr><th>نام و نام خانوادگی</th><th>مدرک</th><th>مسئولیت</th></tr></thead>
        <tbody>
          <tr><td>سید محمدرضا</td><td>کارشناسی</td><td>مدیر پروژه</td></tr>
          <tr><td>سارا احمدی</td><td>کارشناسی ارشد</td><td>پژوهشگر</td></tr>
        </tbody>
      </table>
    </article>
  `);
  Object.defineProperty(dom.window.HTMLElement.prototype, "getClientRects", {
    configurable: true,
    value: () => [{ width: 100, height: 20 }],
  });
  const article = dom.window.document.querySelector("article") as HTMLElement;
  const blocks = collectReadableBlocks(article);
  assert.equal(blocks.length, 2);
  assert.match(blocks[0].sentences.map((sentence) => sentence.text).join(" "), /ردیف اول/u);
  assert.match(blocks[0].sentences.map((sentence) => sentence.text).join(" "), /نام و نام خانوادگی: سید محمدرضا/u);
  assert.match(blocks[0].sentences.map((sentence) => sentence.text).join(" "), /مدرک: کارشناسی/u);
  assert.match(blocks[1].sentences.map((sentence) => sentence.text).join(" "), /ردیف دوم/u);
});
