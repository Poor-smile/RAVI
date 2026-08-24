import assert from "node:assert/strict";
import test from "node:test";
import {
  commitFormulaTransaction,
  createFormulaHistory,
  createFormulaFunction,
  createFormulaLargeOperator,
  createFormulaMatrix,
  emptyFormulaTree,
  findFormulaNode,
  formulaAtom,
  formulaRow,
  formulaSlot,
  formulaTreeDepth,
  insertFormulaSymbolAtActive,
  insertFormulaStructureAtSlot,
  redoFormulaTransaction,
  reconfigureFormulaAccent,
  reconfigureFormulaFence,
  reconfigureFormulaFunction,
  reconfigureFormulaLargeOperator,
  resizeFormulaMatrix,
  resizeFormulaCases,
  setFormulaMatrixDelimiter,
  undoFormulaTransaction,
  type FormulaExpressionNode,
} from "../app/formula/expression-tree";
import {
  parseLatexExpression,
  serializeFormulaToLatex,
  validateAdvancedLatex,
  validateFormulaTree,
} from "../app/formula/latex";
import {
  filterFormulaSymbols,
  formulaSymbolsFromRecent,
} from "../app/formula/symbols";

function sequentialIds(prefix = "node") {
  let index = 0;
  return () => `${prefix}-${++index}`;
}

test("P27 inserts a nested structure into the active slot without replacing ancestors", () => {
  const ids = sequentialIds();
  const empty = emptyFormulaTree(ids);
  const slotId = empty.activeNodeId;
  const numerator = formulaSlot("numerator", true, ids());
  const denominator = formulaSlot("denominator", true, ids());
  const fraction: FormulaExpressionNode = {
    id: ids(),
    kind: "fraction",
    numerator,
    denominator,
  };

  const inserted = insertFormulaStructureAtSlot(empty.root, slotId, fraction);
  assert.equal(inserted.root.id, empty.root.id);
  assert.equal(inserted.activeNodeId, numerator.id);
  assert.equal(findFormulaNode(inserted.root, slotId), undefined);
  assert.equal(findFormulaNode(inserted.root, fraction.id)?.node.kind, "fraction");

  const script: FormulaExpressionNode = {
    id: ids(),
    kind: "script",
    base: formulaAtom("x", "identifier", ids()),
    superscript: formulaSlot("superscript", true, ids()),
  };
  const nested = insertFormulaStructureAtSlot(inserted.root, numerator.id, script);
  assert.equal(nested.activeNodeId, script.superscript?.id);
  assert.equal(formulaTreeDepth(nested.root), 4);
  assert.equal(validateFormulaTree(nested.root).status, "incomplete");
});

test("P27 serializes nested academic structures from one expression tree", () => {
  const ids = sequentialIds();
  const tree: FormulaExpressionNode = {
    id: ids(),
    kind: "large-operator",
    operator: "integral",
    lower: formulaAtom("0", "number", ids()),
    upper: formulaAtom("1", "number", ids()),
    differential: formulaAtom("x", "identifier", ids()),
    body: {
      id: ids(),
      kind: "fraction",
      numerator: {
        id: ids(),
        kind: "script",
        base: formulaAtom("x", "identifier", ids()),
        superscript: formulaAtom("2", "number", ids()),
      },
      denominator: {
        id: ids(),
        kind: "radical",
        radicand: formulaAtom("x", "identifier", ids()),
      },
    },
  };

  assert.equal(
    serializeFormulaToLatex(tree),
    "\\int_{0}^{1}{\\frac{x^{2}}{\\sqrt{x}}}\\,\\mathrm{d}{x}",
  );
  assert.equal(validateFormulaTree(tree).status, "valid");
});

test("P27 builds every common calculus operator through one visual model", () => {
  const ids = sequentialIds("calculus");
  const body = formulaAtom("f", "identifier", ids());
  const variable = formulaAtom("x", "identifier", ids());
  const lower = formulaAtom("0", "number", ids());
  const upper = formulaAtom("1", "number", ids());
  const order = formulaAtom("2", "number", ids());

  const fixtures = [
    ["integral", "\\int_{0}^{1}{f}\\,\\mathrm{d}{x}"],
    ["double-integral", "\\iint_{0}^{1}{f}\\,\\mathrm{d}{x}"],
    ["triple-integral", "\\iiint_{0}^{1}{f}\\,\\mathrm{d}{x}"],
    ["contour-integral", "\\oint_{0}^{1}{f}\\,\\mathrm{d}{x}"],
    ["derivative", "\\frac{\\mathrm{d}^{2}{f}}{\\mathrm{d}{x}^{2}}"],
    ["partial-derivative", "\\frac{\\partial^{2}{f}}{\\partial{x}^{2}}"],
    ["sum", "\\sum_{0}^{1}{f}"],
    ["product", "\\prod_{0}^{1}{f}"],
    ["limit", "\\lim_{0}{f}"],
  ] as const;

  for (const [operator, expected] of fixtures) {
    const node = createFormulaLargeOperator(operator, ids, {
      body,
      lower,
      upper,
      differential: variable,
      variable,
      order,
    });
    assert.equal(serializeFormulaToLatex(node), expected);
    assert.equal(validateFormulaTree(node).status, "valid");
  }
});

test("P27 calculus reconfiguration preserves body, variable, focus and one undo step", () => {
  const ids = sequentialIds("calculus-history");
  const body = formulaAtom("f", "identifier", ids());
  const differential = formulaAtom("x", "identifier", ids());
  const integral = createFormulaLargeOperator("double-integral", ids, {
    body,
    differential,
    lower: formulaAtom("0", "number", ids()),
    upper: formulaAtom("1", "number", ids()),
  });
  const root = formulaRow([integral], ids());
  let history = createFormulaHistory(root, differential.id);

  history = commitFormulaTransaction(history, "partial derivative", (currentRoot, activeNodeId) =>
    reconfigureFormulaLargeOperator(
      currentRoot,
      integral.id,
      "partial-derivative",
      ids,
      activeNodeId,
    ),
  );
  const partial = findFormulaNode(history.root, integral.id)?.node;
  assert.equal(partial?.kind, "large-operator");
  if (!partial || partial.kind !== "large-operator") return;
  assert.equal(partial.operator, "partial-derivative");
  assert.equal(partial.body, body);
  assert.equal(partial.variable, differential);
  assert.equal(history.activeNodeId, differential.id);
  assert.equal(history.past.length, 1);

  history = undoFormulaTransaction(history);
  const restored = findFormulaNode(history.root, integral.id)?.node;
  assert.equal(restored?.kind, "large-operator");
  if (restored?.kind === "large-operator") assert.equal(restored.operator, "double-integral");
});

test("P27 canonical calculus LaTeX reopens as editable large operators", () => {
  const sources = [
    ["\\iint_{0}^{1}{f}\\,\\mathrm{d}{x}", "double-integral", "x"],
    ["\\frac{\\mathrm{d}^{2}{f}}{\\mathrm{d}{x}^{2}}", "derivative", "x"],
    ["\\frac{\\partial^{2}{f}}{\\partial{x}^{2}}", "partial-derivative", "x"],
    ["\\sum_{i=1}^{n}{i}", "sum", undefined],
    ["\\prod_{i=1}^{n}{i}", "product", undefined],
    ["\\lim_{x\\to0}{f}", "limit", undefined],
  ] as const;

  for (const [source, operator, differential] of sources) {
    const tree = parseLatexExpression(source);
    assert.equal(tree.kind, "large-operator");
    if (tree.kind !== "large-operator") continue;
    assert.equal(tree.operator, operator);
    if (differential) assert.equal(serializeFormulaToLatex(tree.differential ?? tree.variable!), differential);
    assert.equal(serializeFormulaToLatex(tree), source);
  }
});

test("P27 matrix resize preserves surviving cells and creates only new slots", () => {
  const ids = sequentialIds("matrix");
  const matrix = createFormulaMatrix(2, 2, "brackets", ids);
  const firstCell = matrix.cells[0];
  const fourthCell = matrix.cells[3];
  const root = formulaRow([matrix], ids());

  const expanded = resizeFormulaMatrix(root, matrix.id, 3, 3, ids, fourthCell.id);
  const expandedMatrix = findFormulaNode(expanded.root, matrix.id)?.node;
  assert.equal(expandedMatrix?.kind, "matrix");
  if (!expandedMatrix || expandedMatrix.kind !== "matrix") return;
  assert.equal(expandedMatrix.cells.length, 9);
  assert.equal(expandedMatrix.cells[0], firstCell);
  assert.equal(expandedMatrix.cells[4], fourthCell);
  assert.equal(expanded.activeNodeId, fourthCell.id);

  const shrunk = resizeFormulaMatrix(expanded.root, matrix.id, 1, 1, ids, fourthCell.id);
  const shrunkMatrix = findFormulaNode(shrunk.root, matrix.id)?.node;
  assert.equal(shrunkMatrix?.kind, "matrix");
  if (!shrunkMatrix || shrunkMatrix.kind !== "matrix") return;
  assert.equal(shrunkMatrix.cells.length, 1);
  assert.equal(shrunkMatrix.cells[0], firstCell);
  assert.equal(shrunk.activeNodeId, firstCell.id);
  assert.throws(() => resizeFormulaMatrix(root, matrix.id, 9, 1, ids), RangeError);
});

test("P27 matrix delimiter change preserves the active cell and round-trips", () => {
  const ids = sequentialIds("delimiter");
  const matrix = createFormulaMatrix(2, 2, "brackets", ids);
  const activeCell = matrix.cells[2];
  const root = formulaRow([matrix], ids());

  const changed = setFormulaMatrixDelimiter(root, matrix.id, "double-bars", activeCell.id);
  const changedMatrix = findFormulaNode(changed.root, matrix.id)?.node;
  assert.equal(changedMatrix?.kind, "matrix");
  assert.equal(changed.activeNodeId, activeCell.id);
  if (!changedMatrix || changedMatrix.kind !== "matrix") return;
  assert.equal(changedMatrix.delimiter, "double-bars");
  assert.match(
    serializeFormulaToLatex(changedMatrix, { allowPlaceholders: true }),
    /^\\begin\{Vmatrix\}/u,
  );
});

test("P27 treats each structural mutation as one undo transaction", () => {
  const ids = sequentialIds("history");
  const empty = emptyFormulaTree(ids);
  let history = createFormulaHistory(empty.root, empty.activeNodeId);
  const matrix = createFormulaMatrix(2, 2, "parentheses", ids);

  history = commitFormulaTransaction(history, "insert matrix", (root, activeNodeId) =>
    insertFormulaStructureAtSlot(root, activeNodeId, matrix),
  );
  assert.equal(history.past.length, 1);
  assert.equal(findFormulaNode(history.root, matrix.id)?.node.kind, "matrix");

  history = commitFormulaTransaction(history, "resize matrix", (root) =>
    resizeFormulaMatrix(root, matrix.id, 4, 3, ids),
  );
  assert.equal(history.past.length, 2);
  assert.equal((findFormulaNode(history.root, matrix.id)?.node as { rows: number }).rows, 4);

  history = undoFormulaTransaction(history);
  const restored = findFormulaNode(history.root, matrix.id)?.node;
  assert.equal(restored?.kind, "matrix");
  if (restored?.kind === "matrix") assert.deepEqual([restored.rows, restored.columns], [2, 2]);
  assert.equal(history.future.length, 1);

  history = redoFormulaTransaction(history);
  const redone = findFormulaNode(history.root, matrix.id)?.node;
  if (redone?.kind === "matrix") assert.deepEqual([redone.rows, redone.columns], [4, 3]);
});

test("P27 searches symbols in Persian, English and LaTeX within a category", () => {
  assert.deepEqual(filterFormulaSymbols("آلفا").map((symbol) => symbol.id), ["alpha"]);
  assert.deepEqual(filterFormulaSymbols("not equal").map((symbol) => symbol.id), ["not-equal"]);
  assert.deepEqual(filterFormulaSymbols("\\subseteq").map((symbol) => symbol.id), ["subset-equal"]);
  assert.ok(filterFormulaSymbols("", "arrows").every((symbol) => symbol.group === "arrows"));
  assert.deepEqual(
    formulaSymbolsFromRecent(["not-equal", "alpha", "union"]).map((symbol) => symbol.id),
    ["not-equal", "alpha", "union"],
  );
});

test("P27 inserts several symbols into one tree with one undo per symbol and round-trips", () => {
  const ids = sequentialIds("symbols");
  const empty = emptyFormulaTree(ids);
  let history = createFormulaHistory(empty.root, empty.activeNodeId);

  history = commitFormulaTransaction(history, "insert alpha", (root, activeNodeId) =>
    insertFormulaSymbolAtActive(root, activeNodeId, "\\alpha", ids),
  );
  assert.equal(serializeFormulaToLatex(history.root), "\\alpha");
  assert.equal(history.past.length, 1);

  history = commitFormulaTransaction(history, "insert relation", (root, activeNodeId) =>
    insertFormulaSymbolAtActive(root, activeNodeId, "\\neq", ids),
  );
  const source = serializeFormulaToLatex(history.root);
  assert.equal(source, "\\alpha\\neq");
  assert.equal(history.past.length, 2);
  assert.equal(serializeFormulaToLatex(parseLatexExpression(source, ids)), source);

  history = undoFormulaTransaction(history);
  assert.equal(serializeFormulaToLatex(history.root), "\\alpha");
  history = redoFormulaTransaction(history);
  assert.equal(serializeFormulaToLatex(history.root), "\\alpha\\neq");
});

test("P27 round-trips functions with arguments and a semantic subscript", () => {
  const ids = sequentialIds("function");
  const source = "\\log_{2}\\left(x,y\\right)";
  const tree = parseLatexExpression(source, ids);
  assert.equal(tree.kind, "function");
  if (tree.kind !== "function") return;
  assert.equal(tree.name, "log");
  assert.equal(tree.arguments.length, 2);
  assert.equal(serializeFormulaToLatex(tree.subscript!), "2");
  assert.equal(serializeFormulaToLatex(tree), source);
});

test("P27 reconfigures a function without losing existing arguments and uses one undo", () => {
  const ids = sequentialIds("function-config");
  const firstArgument = formulaAtom("x", "identifier", ids());
  const fn = createFormulaFunction("sin", 1, false, ids);
  fn.arguments[0] = firstArgument;
  let history = createFormulaHistory(formulaRow([fn], ids()), firstArgument.id);

  history = commitFormulaTransaction(history, "configure log", (root, activeNodeId) =>
    reconfigureFormulaFunction(root, fn.id, {
      name: "log",
      argumentCount: 2,
      withSubscript: true,
    }, ids, activeNodeId),
  );
  const configured = findFormulaNode(history.root, fn.id)?.node;
  assert.equal(configured?.kind, "function");
  if (!configured || configured.kind !== "function") return;
  assert.equal(configured.name, "log");
  assert.equal(configured.arguments[0], firstArgument);
  assert.equal(configured.arguments.length, 2);
  assert.equal(configured.subscript?.kind, "slot");
  assert.equal(history.activeNodeId, firstArgument.id);
  assert.equal(history.past.length, 1);

  history = undoFormulaTransaction(history);
  const restored = findFormulaNode(history.root, fn.id)?.node;
  assert.equal(restored?.kind, "function");
  if (restored?.kind === "function") assert.deepEqual([restored.name, restored.arguments.length, restored.subscript], ["sin", 1, undefined]);
});

test("P27 preserves Fence, Cases and Accent bodies while reconfiguring", () => {
  const ids = sequentialIds("algebra-config");
  const body = formulaAtom("x", "identifier", ids());
  const fence: FormulaExpressionNode = { id: ids(), kind: "fence", open: "(", body, close: ")" };
  let root = formulaRow([fence], ids());
  const fenced = reconfigureFormulaFence(root, fence.id, "|", "|", body.id);
  assert.equal(serializeFormulaToLatex(fenced.root), "\\left|x\\right|");
  assert.equal(fenced.activeNodeId, body.id);

  const accent: FormulaExpressionNode = { id: ids(), kind: "accent", accent: "hat", body };
  root = formulaRow([accent], ids());
  const accented = reconfigureFormulaAccent(root, accent.id, "vector", body.id);
  assert.equal(serializeFormulaToLatex(accented.root), "\\vec{x}");
  assert.equal(accented.activeNodeId, body.id);

  const cases: FormulaExpressionNode = {
    id: ids(),
    kind: "cases",
    rows: [{ id: ids(), value: body, condition: formulaAtom("x>0", "symbol", ids()) }],
  };
  root = formulaRow([cases], ids());
  const resized = resizeFormulaCases(root, cases.id, 3, ids, body.id);
  const resizedCases = findFormulaNode(resized.root, cases.id)?.node;
  assert.equal(resizedCases?.kind, "cases");
  if (resizedCases?.kind === "cases") {
    assert.equal(resizedCases.rows.length, 3);
    assert.equal(resizedCases.rows[0], cases.rows[0]);
  }
  assert.equal(resized.activeNodeId, body.id);
});

test("P27 parses and serializes every visual accent and Binomial", () => {
  for (const source of [
    "\\hat{x}", "\\bar{x}", "\\vec{x}", "\\dot{x}", "\\ddot{x}",
    "\\tilde{x}", "\\overline{x}", "\\underline{x}", "\\binom{n}{k}",
  ]) {
    const tree = parseLatexExpression(source, sequentialIds("algebra-roundtrip"));
    assert.equal(serializeFormulaToLatex(tree), source);
    assert.equal(validateFormulaTree(tree).status, "valid");
  }
});

test("P27 parses supported LaTeX back into a visual tree", () => {
  const ids = sequentialIds("parse");
  const tree = parseLatexExpression("\\frac{x^{2}+1}{\\sqrt[3]{y}}", ids);
  assert.equal(tree.kind, "fraction");
  assert.equal(validateFormulaTree(tree).status, "valid");
  assert.equal(
    serializeFormulaToLatex(tree),
    "\\frac{x^{2}+1}{\\sqrt[3]{y}}",
  );
});

test("P27 round-trips dynamic matrices and cases", () => {
  const matrixSource = "\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}";
  const matrix = parseLatexExpression(matrixSource, sequentialIds("matrix-parse"));
  assert.equal(matrix.kind, "matrix");
  if (matrix.kind === "matrix") {
    assert.deepEqual([matrix.rows, matrix.columns, matrix.cells.length], [2, 2, 4]);
  }
  assert.equal(serializeFormulaToLatex(matrix), matrixSource);

  const casesSource = "\\begin{cases}x & x > 0 \\\\ -x & x \\le 0\\end{cases}";
  const cases = parseLatexExpression(casesSource, sequentialIds("cases"));
  assert.equal(cases.kind, "cases");
  if (cases.kind === "cases") assert.equal(cases.rows.length, 2);
  assert.equal(
    serializeFormulaToLatex(cases),
    "\\begin{cases}x & x>0 \\\\ -x & x\\le0\\end{cases}",
  );
});

test("P27 preserves LaTeX command boundaries before identifiers", () => {
  for (const source of ["x\\in A", "k\\leq n", "\\forall x\\in A"]) {
    const canonical = serializeFormulaToLatex(
      parseLatexExpression(source, sequentialIds("command-boundary")),
    );
    assert.equal(
      serializeFormulaToLatex(
        parseLatexExpression(canonical, sequentialIds("command-boundary-reopen")),
      ),
      canonical,
    );
  }
});

test("P27 advanced LaTeX reports valid, unsupported and unsafe states", () => {
  const valid = validateAdvancedLatex("\\frac{x}{y}");
  assert.equal(valid.status, "valid");
  assert.equal(valid.preserveRaw, false);
  assert.equal(valid.normalizedLatex, "\\frac{x}{y}");

  const unbracedScript = validateAdvancedLatex("y^2 + 1");
  assert.equal(unbracedScript.status, "valid");
  assert.equal(unbracedScript.preserveRaw, false);

  const unsupported = validateAdvancedLatex("\\overbrace{x}^{n}");
  assert.equal(unsupported.status, "unsupported");
  assert.equal(unsupported.preserveRaw, true);
  assert.match(unsupported.message ?? "", /node دیداری/u);

  const unsafe = validateAdvancedLatex("x + \\href{https://example.com}{y}");
  assert.equal(unsafe.status, "invalid");
  assert.equal(unsafe.location?.line, 1);
  assert.equal(unsafe.location?.column, 5);
  assert.equal(unsafe.preserveRaw, false);
});

test("P27 advanced LaTeX returns exact line and column for syntax errors", () => {
  const result = validateAdvancedLatex("x + 1\n\\frac{a}{");
  assert.equal(result.status, "invalid");
  assert.equal(result.location?.line, 2);
  assert.ok((result.location?.column ?? 0) >= 1);
});
