import assert from "node:assert/strict";
import test from "node:test";
import {
  findFormulaBlocks,
  insertFormulaBlock,
  replaceFormulaBlock,
} from "../app/formula/blocks";
import {
  filterFormulaTemplates,
  formulaLatexFromTemplate,
  smartFormulaInput,
  templateIsComplete,
} from "../app/formula/model";

test("formula blocks preserve independent Markdown boundaries", () => {
  const source = "پیش از فرمول\n\n$$\n\\frac{x}{y}\n$$\n\nپس از فرمول";
  const blocks = findFormulaBlocks(source);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].latex, "\\frac{x}{y}");
  assert.equal(source.slice(blocks[0].startOffset, blocks[0].endOffset), blocks[0].raw);
  assert.equal(source.slice(blocks[0].latexStartOffset, blocks[0].latexEndOffset), "\\frac{x}{y}");
});

test("insert and replace formula blocks round-trip without consuming neighbors", () => {
  const source = "الف\n\nب";
  const inserted = insertFormulaBlock(source, source.indexOf("ب"), "x^{2}+1");
  assert.equal(inserted.content, "الف\n\n$$\nx^{2}+1\n$$\n\nب");
  const replaced = replaceFormulaBlock(
    inserted.content,
    inserted.content,
    inserted.block,
    "\\sqrt{x}",
  );
  assert.equal(replaced.ok, true);
  if (replaced.ok) assert.equal(replaced.content, "الف\n\n$$\n\\sqrt{x}\n$$\n\nب");
});

test("visual templates validate slots and produce durable LaTeX", () => {
  assert.equal(templateIsComplete("fraction", ["x", ""]), false);
  assert.equal(templateIsComplete("fraction", ["x", "y"]), true);
  assert.equal(formulaLatexFromTemplate("fraction", ["x", "y"]), "\\frac{x}{y}");
  assert.match(formulaLatexFromTemplate("matrix", ["1", "2", "3", "4"]), /bmatrix/u);
  assert.equal(smartFormulaInput("x2 + √(a+b)"), "x^{2} + \\sqrt{a+b}");
  assert.equal(filterFormulaTemplates("انتگرال")[0]?.id, "integral");
  assert.equal(filterFormulaTemplates("matrix")[0]?.id, "matrix");
});
