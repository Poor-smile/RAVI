import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { createWordExport } from "../app/export/word";
import { createSimpleDiagramDraft, validateSimpleDiagramDraft } from "../app/mermaid/simple-builder";

test("R02 exports a Studio fraction as editable OMML, retaining surrounding prose", async () => {
  const result = await createWordExport({ markdown: "# آزمایش\n\nقبل\n\n$$\n\\frac{x+1}{n-1}\n$$\n\nبعد", fileName: "formula.docx", imageAssets: [] });
  const zip = await JSZip.loadAsync(result.bytes);
  const xml = await zip.file("word/document.xml")!.async("string");
  assert.match(xml, /<m:oMath>/); assert.match(xml, /<m:f>/); assert.match(xml, /قبل/); assert.match(xml, /بعد/);
  assert.equal(result.warnings.length, 0); assert.doesNotMatch(xml, /\$\$/);
});

test("R02 warns before unsupported formula source is exported", async () => {
  const result = await createWordExport({ markdown: "$$\n\\widehat{x+y}\n$$", fileName: "advanced.docx", imageAssets: [] });
  assert.ok(result.warnings.some(w => w.message.includes("فرمول") && w.message.includes("PDF")));
});

test("R11 reports both series counts and rejects mismatched X labels", () => {
  const draft = createSimpleDiagramDraft("xychart");
  draft.rows.push({ ...draft.rows[0], id: "fourth", first: "روز ۴", meta: { ...draft.rows[0].meta, series: "سری تازه" } });
  const issues = validateSimpleDiagramDraft(draft);
  assert.ok(issues.some(issue => issue.message.includes("رشد") && issue.message.includes("سری تازه")));
  assert.ok(issues.some(issue => issue.rowId === "fourth"));
});
