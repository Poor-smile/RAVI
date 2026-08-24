import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLatexExpression,
  serializeFormulaToLatex,
  validateAdvancedLatex,
  validateFormulaTree,
} from "../app/formula/latex";
import { FORMULA_ACADEMIC_CORPUS } from "./fixtures/formula-academic-corpus";

test("P27 release corpus contains at least 100 unique academic formulas", () => {
  assert.ok(FORMULA_ACADEMIC_CORPUS.length >= 100);
  assert.equal(new Set(FORMULA_ACADEMIC_CORPUS.map((fixture) => fixture.id)).size, FORMULA_ACADEMIC_CORPUS.length);
  assert.equal(new Set(FORMULA_ACADEMIC_CORPUS.map((fixture) => fixture.latex)).size, FORMULA_ACADEMIC_CORPUS.length);
  for (const category of ["algebra", "functions", "calculus", "matrix", "cases", "notation"] as const) {
    assert.ok(FORMULA_ACADEMIC_CORPUS.filter((fixture) => fixture.category === category).length >= 8);
  }
});

test("P27 release corpus validates, round-trips and survives local persistence", () => {
  const failures: string[] = [];
  for (const fixture of FORMULA_ACADEMIC_CORPUS) {
    try {
      const validation = validateAdvancedLatex(fixture.latex);
      assert.equal(validation.status, "valid", validation.message);
      assert.ok(validation.tree);
      assert.equal(validateFormulaTree(validation.tree!).status, "valid");

      const canonical = serializeFormulaToLatex(validation.tree!);
      const reopened = parseLatexExpression(canonical);
      assert.equal(serializeFormulaToLatex(reopened), canonical);

      const persisted = JSON.parse(JSON.stringify(validation.tree!));
      assert.equal(serializeFormulaToLatex(persisted), canonical);
      assert.doesNotMatch(canonical, /\\square/u);
    } catch (error) {
      failures.push(`${fixture.id}: ${(error as Error).message} — ${fixture.latex}`);
    }
  }
  assert.deepEqual(failures, []);
});
