"use client";

import "./formula-studio.css";

import {
  Copy,
  GitMerge,
  Move,
  Redo2,
  RefreshCw,
  Search,
  Trash2,
  Undo2,
  Workflow,
  X,
} from "@/app/icons/material-symbols";
import katex from "katex";
import {
  ClipboardEvent as ReactClipboardEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormulaBlock } from "../formula/blocks";
import {
  clearFormulaNode,
  commitFormulaTransaction,
  createFormulaHistory,
  createFormulaNodeId,
  duplicateFormulaNode,
  emptyFormulaTree,
  findFormulaNode,
  formulaAtom,
  formulaBreadcrumb,
  formulaLeafNodes,
  formulaSlot,
  formulaTreeDepth,
  insertFormulaSymbolAtActive,
  insertFormulaStructureAtSlot,
  promoteFormulaNode,
  reconfigureFormulaAccent,
  reconfigureFormulaFence,
  reconfigureFormulaFunction,
  reconfigureFormulaLargeOperator,
  redoFormulaTransaction,
  replaceFormulaNode,
  resizeFormulaMatrix,
  resizeFormulaCases,
  setFormulaMatrixDelimiter,
  undoFormulaTransaction,
  wrapFormulaNode,
  type FormulaAtomKind,
  type FormulaAccent,
  type FormulaCasesNode,
  type FormulaExpressionNode,
  type FormulaFenceNode,
  type FormulaFunctionNode,
  type FormulaHistoryState,
  type FormulaLargeOperator,
  type FormulaLargeOperatorNode,
  type FormulaMatrixDelimiter,
  type FormulaMatrixNode,
  type FormulaNodeId,
} from "../formula/expression-tree";
import {
  formulaTreeIsComplete,
  serializeFormulaToLatex,
  validateAdvancedLatex,
  validateFormulaTree,
} from "../formula/latex";
import { formulaAccessibleText, smartFormulaInput } from "../formula/model";
import {
  createFormulaStructure,
  filterFormulaStructures,
  FORMULA_STRUCTURES,
  FORMULA_STUDIO_CATEGORIES,
  type FormulaStructureDefinition,
  type FormulaStructureId,
  type FormulaStudioCategory,
} from "../formula/structures";
import {
  filterFormulaSymbols,
  FORMULA_SYMBOL_GROUPS,
  formulaSymbolsFromRecent,
  type FormulaSymbolDefinition,
  type FormulaSymbolGroup,
} from "../formula/symbols";
import { AccessibleModal, useModalFocus } from "./accessible-modal";
import { useBackLayer } from "./back-layer-provider";

export type FormulaStudioSession = {
  id: string;
  mode: "create" | "edit";
  initialLatex: string;
  insertionOffset: number;
  originalDocument: string;
  block?: FormulaBlock;
  editorScrollTop: number;
  previewScrollTop: number;
};

export type FormulaApplyResult =
  | { ok: true }
  | { ok: false; message: string };

type StudioMode = "visual" | "advanced";

type PersistedFormulaDraft = {
  version: 2;
  root: FormulaExpressionNode;
  activeNodeId: FormulaNodeId;
  mode: StudioMode;
  rawLatex: string;
};

type InitialStudioState = {
  formula: FormulaHistoryState;
  mode: StudioMode;
  rawLatex: string;
};

const DRAFT_PREFIX = "raavi:formula-draft:v2";
const RECENT_SYMBOLS_KEY = "raavi:formula-symbols:recent:v1";
const FEATURED_STRUCTURES: FormulaStructureId[] = [
  "fraction",
  "power",
  "root",
  "derivative",
  "matrix",
  "symbols",
];

function draftKey(fileName: string, session: FormulaStudioSession) {
  return `${DRAFT_PREFIX}:${fileName}:${session.mode}:${session.block?.id ?? session.insertionOffset}`;
}

function createEmptyState(): InitialStudioState {
  const empty = emptyFormulaTree();
  return {
    formula: createFormulaHistory(empty.root, empty.activeNodeId),
    mode: "visual",
    rawLatex: "",
  };
}

function stateFromLatex(latex: string): InitialStudioState {
  if (!latex.trim()) return createEmptyState();
  const validation = validateAdvancedLatex(latex);
  if (validation.status === "valid" && validation.tree) {
    const activeNodeId = formulaLeafNodes(validation.tree)[0]?.id ?? validation.tree.id;
    return {
      formula: createFormulaHistory(validation.tree, activeNodeId),
      mode: "visual",
      rawLatex: latex,
    };
  }
  const empty = createEmptyState();
  return { ...empty, mode: "advanced", rawLatex: latex };
}

function initialStudioState(fileName: string, session: FormulaStudioSession) {
  const fallback = stateFromLatex(session.initialLatex);
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(draftKey(fileName, session));
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<PersistedFormulaDraft>;
    if (
      parsed.version !== 2 ||
      !parsed.root ||
      typeof parsed.root !== "object" ||
      typeof parsed.activeNodeId !== "string" ||
      (parsed.mode !== "visual" && parsed.mode !== "advanced")
    ) return fallback;
    validateFormulaTree(parsed.root);
    return {
      formula: createFormulaHistory(parsed.root, parsed.activeNodeId),
      mode: parsed.mode,
      rawLatex: typeof parsed.rawLatex === "string" ? parsed.rawLatex : "",
    };
  } catch {
    return fallback;
  }
}

function FormulaMark({ size = 24 }: { size?: number }) {
  return (
    <span
      className="formula-mark"
      style={{ width: size, height: size, fontSize: size * 0.78 }}
      aria-hidden="true"
    >
      fx
    </span>
  );
}

function renderMath(latex: string, displayMode: boolean) {
  try {
    return katex.renderToString(latex || "\\square", {
      displayMode,
      output: "mathml",
      throwOnError: false,
      strict: "ignore",
      trust: false,
    });
  } catch {
    return "";
  }
}

function FormulaMath({ latex, className = "" }: { latex: string; className?: string }) {
  const html = useMemo(() => renderMath(latex, true), [latex]);
  return (
    <span
      className={`formula-math ${className}`.trim()}
      role="img"
      aria-label={formulaAccessibleText(latex) || "فرمول خالی"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function FormulaInlineMath({ latex }: { latex: string }) {
  const html = useMemo(() => renderMath(latex, false), [latex]);
  return (
    <span
      className="formula-inline-math"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function FormulaTemplatePreview({ type }: { type: FormulaStructureId }) {
  const glyphs: Record<FormulaStructureId, string> = {
    fraction: "a⁄b",
    power: "xⁿ",
    root: "ⁿ√x",
    function: "sin(x)",
    fence: "|x|",
    cases: "{ f(x)",
    accent: "x̂",
    binomial: "(ⁿₖ)",
    integral: "∫₀¹f dx",
    "double-integral": "∬ f dA",
    "triple-integral": "∭ f dV",
    "contour-integral": "∮ f dz",
    derivative: "dⁿf⁄dxⁿ",
    "partial-derivative": "∂ⁿf⁄∂xⁿ",
    sum: "Σᵢⁿ aᵢ",
    product: "Πᵢⁿ aᵢ",
    limit: "limₓ→₀ f",
    matrix: "[aᵢⱼ]",
    symbols: "α β ∞",
  };
  return <span className="formula-template-glyph">{glyphs[type]}</span>;
}

function nodeLabel(node: FormulaExpressionNode) {
  switch (node.kind) {
    case "slot": return node.name;
    case "atom": return node.atomKind === "text" ? "Text" : "Atom";
    case "row": return "Equation";
    case "fraction": return "Fraction";
    case "script": return "Script";
    case "radical": return "Radical";
    case "fence": return "Fence";
    case "function": return "Function";
    case "large-operator": {
      const names: Record<string, string> = {
        integral: "Integral",
        "double-integral": "Double Integral",
        "triple-integral": "Triple Integral",
        "contour-integral": "Contour Integral",
        derivative: "Derivative",
        "partial-derivative": "Partial Derivative",
        sum: "Sum",
        product: "Product",
        limit: "Limit",
      };
      return names[node.operator] ?? "Calculus";
    }
    case "matrix": return "Matrix";
    case "cases": return "Cases";
    case "accent": return "Accent";
    case "binomial": return "Binomial";
  }
}

const MATRIX_DELIMITERS: Array<{
  id: FormulaMatrixDelimiter;
  label: string;
  glyph: string;
}> = [
  { id: "none", label: "بدون جداکننده", glyph: "a" },
  { id: "parentheses", label: "پرانتز", glyph: "(a)" },
  { id: "brackets", label: "براکت", glyph: "[a]" },
  { id: "braces", label: "آکولاد", glyph: "{a}" },
  { id: "bars", label: "خط عمودی", glyph: "|a|" },
  { id: "double-bars", label: "خط عمودی دوتایی", glyph: "‖a‖" },
];

const CALCULUS_OPERATORS: Array<{
  id: FormulaLargeOperator;
  label: string;
  glyph: string;
}> = [
  { id: "integral", label: "انتگرال", glyph: "∫" },
  { id: "double-integral", label: "دوگانه", glyph: "∬" },
  { id: "triple-integral", label: "سه‌گانه", glyph: "∭" },
  { id: "contour-integral", label: "مسیر بسته", glyph: "∮" },
  { id: "derivative", label: "مشتق", glyph: "d/dx" },
  { id: "partial-derivative", label: "مشتق جزئی", glyph: "∂/∂x" },
  { id: "sum", label: "مجموع", glyph: "Σ" },
  { id: "product", label: "حاصل‌ضرب", glyph: "Π" },
  { id: "limit", label: "حد", glyph: "lim" },
];

const ALGEBRA_FUNCTIONS = [
  "sin", "cos", "tan", "cot", "sec", "csc",
  "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh",
  "log", "ln", "exp", "min", "max", "det",
] as const;

const ALGEBRA_FENCES: Array<{ open: string; close: string; label: string; glyph: string }> = [
  { open: "(", close: ")", label: "پرانتز", glyph: "(x)" },
  { open: "[", close: "]", label: "براکت", glyph: "[x]" },
  { open: "\\{", close: "\\}", label: "آکولاد", glyph: "{x}" },
  { open: "|", close: "|", label: "قدرمطلق", glyph: "|x|" },
  { open: "\\lVert", close: "\\rVert", label: "نُرم", glyph: "‖x‖" },
  { open: "\\langle", close: "\\rangle", label: "زاویه‌ای", glyph: "⟨x⟩" },
  { open: "\\lfloor", close: "\\rfloor", label: "کف", glyph: "⌊x⌋" },
  { open: "\\lceil", close: "\\rceil", label: "سقف", glyph: "⌈x⌉" },
];

const ALGEBRA_ACCENTS: Array<{ id: FormulaAccent; label: string; glyph: string }> = [
  { id: "hat", label: "کلاه", glyph: "x̂" },
  { id: "bar", label: "میانگین", glyph: "x̄" },
  { id: "vector", label: "بردار", glyph: "x⃗" },
  { id: "dot", label: "نقطه", glyph: "ẋ" },
  { id: "double-dot", label: "دو نقطه", glyph: "ẍ" },
  { id: "tilde", label: "تیلدا", glyph: "x̃" },
  { id: "overline", label: "خط بالا", glyph: "x̅" },
  { id: "underline", label: "خط پایین", glyph: "x̲" },
];

function matrixDelimiterGlyphs(delimiter: FormulaMatrixDelimiter): [string, string] {
  switch (delimiter) {
    case "none": return ["", ""];
    case "parentheses": return ["(", ")"];
    case "brackets": return ["[", "]"];
    case "braces": return ["{", "}"];
    case "bars": return ["|", "|"];
    case "double-bars": return ["‖", "‖"];
  }
}

function atomKindForValue(value: string): FormulaAtomKind {
  if (/^\d+(?:[.,]\d+)?$/u.test(value.trim())) return "number";
  if (/^\\[A-Za-z]+$/u.test(value.trim())) return "symbol";
  if (/^[\p{L}]+$/u.test(value.trim())) return "identifier";
  return "symbol";
}

type ExpressionRendererProps = {
  node: FormulaExpressionNode;
  activeNodeId: FormulaNodeId;
  selectedNodeId: FormulaNodeId | null;
  leafRefs: React.MutableRefObject<Map<FormulaNodeId, HTMLInputElement>>;
  onActivate: (nodeId: FormulaNodeId) => void;
  onSelect: (nodeId: FormulaNodeId) => void;
  onLeafChange: (
    node: Extract<FormulaExpressionNode, { kind: "slot" | "atom" }>,
    value: string,
  ) => void;
  onLeafKeyDown: (
    event: ReactKeyboardEvent<HTMLInputElement>,
    nodeId: FormulaNodeId,
  ) => void;
};

function FormulaLeafEditor({
  node,
  activeNodeId,
  leafRefs,
  onActivate,
  onLeafChange,
  onLeafKeyDown,
}: Pick<
  ExpressionRendererProps,
  "activeNodeId" | "leafRefs" | "onActivate" | "onLeafChange" | "onLeafKeyDown"
> & {
  node: Extract<FormulaExpressionNode, { kind: "slot" | "atom" }>;
}) {
  const value = node.kind === "atom" ? node.value : "";
  return (
    <input
      ref={(element) => {
        if (element) leafRefs.current.set(node.id, element);
        else leafRefs.current.delete(node.id);
      }}
      className={`formula-slot ${activeNodeId === node.id ? "is-active" : ""}`}
      aria-label={node.kind === "slot" ? `خانهٔ ${node.name}` : "مقدار فرمول"}
      data-formula-node-id={node.id}
      dir="ltr"
      value={value}
      onFocus={() => onActivate(node.id)}
      onChange={(event) => onLeafChange(node, event.target.value)}
      onKeyDown={(event) => onLeafKeyDown(event, node.id)}
      autoComplete="off"
      spellCheck={false}
    />
  );
}

function FormulaNodeEditor(props: ExpressionRendererProps) {
  const { node, selectedNodeId, onSelect } = props;
  if (node.kind === "slot") return <FormulaLeafEditor {...props} node={node} />;
  if (node.kind === "atom") {
    if (node.editable !== false) return <FormulaLeafEditor {...props} node={node} />;
    return <FormulaInlineMath latex={serializeFormulaToLatex(node)} />;
  }

  const child = (value: FormulaExpressionNode) => (
    <FormulaNodeEditor key={value.id} {...props} node={value} />
  );
  const selectNode = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("input")) return;
    event.stopPropagation();
    onSelect(node.id);
  };
  const selected = selectedNodeId === node.id ? " is-selected" : "";

  if (node.kind === "row") {
    return <span className={`formula-expression-row${selected}`} onPointerDown={selectNode}>{node.children.map(child)}</span>;
  }
  if (node.kind === "fraction") {
    return (
      <span className={`formula-expression-fraction${selected}`} onPointerDown={selectNode}>
        <span>{child(node.numerator)}</span><i aria-hidden="true" /><span>{child(node.denominator)}</span>
      </span>
    );
  }
  if (node.kind === "script") {
    return (
      <span className={`formula-expression-script${selected}`} onPointerDown={selectNode}>
        <span>{child(node.base)}</span>
        {node.subscript && <sub>{child(node.subscript)}</sub>}
        {node.superscript && <sup>{child(node.superscript)}</sup>}
      </span>
    );
  }
  if (node.kind === "radical") {
    return (
      <span className={`formula-expression-radical${selected}`} onPointerDown={selectNode}>
        {node.index && <sup>{child(node.index)}</sup>}<b aria-hidden="true">√</b><span>{child(node.radicand)}</span>
      </span>
    );
  }
  if (node.kind === "fence") {
    return <span className={`formula-expression-fence${selected}`} onPointerDown={selectNode}><b>{node.open}</b>{child(node.body)}<b>{node.close}</b></span>;
  }
  if (node.kind === "function") {
    return (
      <span className={`formula-expression-function${selected}`} onPointerDown={selectNode}>
        <span className="formula-expression-function-name">
          <b>{node.name}</b>
          {node.subscript && <sub>{child(node.subscript)}</sub>}
        </span>
        <b>(</b>
        {node.arguments.map((argument, index) => (
          <span className="formula-expression-function-argument" key={argument.id}>
            {index > 0 && <i aria-hidden="true">,</i>}
            {child(argument)}
          </span>
        ))}
        <b>)</b>
      </span>
    );
  }
  if (node.kind === "large-operator") {
    if (node.operator === "derivative" || node.operator === "partial-derivative") {
      const differential = node.operator === "partial-derivative" ? "∂" : "d";
      let mirroredOrder = "";
      if (node.order) {
        try { mirroredOrder = serializeFormulaToLatex(node.order); }
        catch { mirroredOrder = ""; }
      }
      return (
        <span className={`formula-expression-derivative${selected}`} onPointerDown={selectNode}>
          <span><b>{differential}</b>{node.order && <sup>{child(node.order)}</sup>}{child(node.body)}</span>
          <i aria-hidden="true" />
          <span><b>{differential}</b>{node.variable && child(node.variable)}{mirroredOrder && <sup><FormulaInlineMath latex={mirroredOrder} /></sup>}</span>
        </span>
      );
    }
    const glyph: Record<string, string> = {
      integral: "∫",
      "double-integral": "∬",
      "triple-integral": "∭",
      "contour-integral": "∮",
      sum: "∑",
      product: "∏",
      limit: "lim",
    };
    return (
      <span className={`formula-expression-large${selected}`} onPointerDown={selectNode}>
        <span className="formula-expression-large-sign"><b>{glyph[node.operator] ?? "∫"}</b>{node.upper && <sup>{child(node.upper)}</sup>}{node.lower && <sub>{child(node.lower)}</sub>}</span>
        <span>{child(node.body)}</span>
        {node.differential && <span className="formula-expression-differential">d{child(node.differential)}</span>}
      </span>
    );
  }
  if (node.kind === "matrix") {
    const [openDelimiter, closeDelimiter] = matrixDelimiterGlyphs(node.delimiter);
    return (
      <span className={`formula-expression-matrix${selected}`} onPointerDown={selectNode}>
        {openDelimiter && <b aria-hidden="true">{openDelimiter}</b>}
        <span style={{ gridTemplateColumns: `repeat(${node.columns}, auto)` }}>{node.cells.map(child)}</span>
        {closeDelimiter && <b aria-hidden="true">{closeDelimiter}</b>}
      </span>
    );
  }
  if (node.kind === "cases") {
    return (
      <span className={`formula-expression-cases${selected}`} onPointerDown={selectNode}>
        <b aria-hidden="true">{"{"}</b>
        <span>{node.rows.map((row) => <span key={row.id}>{child(row.value)}<em dir="ltr">if</em>{child(row.condition)}</span>)}</span>
      </span>
    );
  }
  if (node.kind === "accent") {
    const glyph = ALGEBRA_ACCENTS.find((item) => item.id === node.accent)?.glyph ?? "x̂";
    return (
      <span className={`formula-expression-accent${selected}`} onPointerDown={selectNode}>
        <span aria-hidden="true">{glyph.replace("x", "")}</span>
        {child(node.body)}
      </span>
    );
  }
  return (
    <span className={`formula-expression-binomial${selected}`} onPointerDown={selectNode}>
      <b aria-hidden="true">(</b>
      <span>{child(node.upper)}{child(node.lower)}</span>
      <b aria-hidden="true">)</b>
    </span>
  );
}

function FormulaBreadcrumb({
  nodes,
  onSelect,
}: {
  nodes: FormulaExpressionNode[];
  onSelect: (nodeId: FormulaNodeId) => void;
}) {
  const visible = nodes.length > 6 ? [nodes[0], ...nodes.slice(-5)] : nodes;
  return (
    <nav className="formula-expression-breadcrumb" aria-label="مسیر ساختار فرمول" dir="ltr">
      <Workflow size={17} aria-hidden="true" />
      <div>
        {nodes.length > 6 && <span aria-hidden="true">…</span>}
        {visible.map((node, index) => (
          <span key={node.id}>
            {index > 0 && <i aria-hidden="true">›</i>}
            <button type="button" onClick={() => onSelect(node.id)}>{nodeLabel(node)}</button>
          </span>
        ))}
      </div>
    </nav>
  );
}

function FormulaMatrixConfigurator({
  node,
  onResize,
  onDelimiterChange,
}: {
  node: FormulaMatrixNode;
  onResize: (rows: number, columns: number) => void;
  onDelimiterChange: (delimiter: FormulaMatrixDelimiter) => void;
}) {
  const sizeRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [probe, setProbe] = useState({ rows: node.rows, columns: node.columns });

  const focusSize = (rowIndex: number, columnIndex: number) => {
    const rows = Math.min(8, Math.max(1, rowIndex + 1));
    const columns = Math.min(8, Math.max(1, columnIndex + 1));
    setProbe({ rows, columns });
    sizeRefs.current[(rows - 1) * 8 + columns - 1]?.focus();
  };

  const handleSizeKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    rowIndex: number,
    columnIndex: number,
  ) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Home") {
      event.preventDefault();
      focusSize(0, 0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusSize(7, 7);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusSize(rowIndex - 1, columnIndex);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusSize(rowIndex + 1, columnIndex);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusSize(rowIndex, columnIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusSize(rowIndex, columnIndex - 1);
    }
  };

  return (
    <div className="formula-matrix-configurator" aria-label="تنظیمات ماتریس">
      <div className="formula-matrix-configurator-heading">
        <strong>اندازهٔ ماتریس</strong>
        <output dir="ltr" aria-live="polite">
          {probe.rows.toLocaleString("fa-IR")} × {probe.columns.toLocaleString("fa-IR")}
        </output>
      </div>
      <div
        className="formula-matrix-size-grid"
        role="group"
        aria-label="انتخاب تعداد ردیف و ستون"
        onPointerLeave={() => setProbe({ rows: node.rows, columns: node.columns })}
      >
        {Array.from({ length: 64 }, (_, index) => {
          const rowIndex = Math.floor(index / 8);
          const columnIndex = index % 8;
          const rows = rowIndex + 1;
          const columns = columnIndex + 1;
          const isCurrent = rows === node.rows && columns === node.columns;
          const isPreviewed = rows <= probe.rows && columns <= probe.columns;
          return (
            <button
              key={`${rows}-${columns}`}
              ref={(element) => { sizeRefs.current[index] = element; }}
              type="button"
              tabIndex={isCurrent ? 0 : -1}
              className={isPreviewed ? "is-previewed" : ""}
              aria-label={`انتخاب ماتریس ${rows} در ${columns}`}
              aria-pressed={isCurrent}
              onPointerEnter={() => setProbe({ rows, columns })}
              onFocus={() => setProbe({ rows, columns })}
              onKeyDown={(event) => handleSizeKeyDown(event, rowIndex, columnIndex)}
              onClick={() => onResize(rows, columns)}
            />
          );
        })}
      </div>
      <div className="formula-matrix-delimiter-heading"><strong>جداکننده</strong><span>نمایش دو طرف ماتریس</span></div>
      <div className="formula-matrix-delimiters" role="group" aria-label="جداکنندهٔ ماتریس">
        {MATRIX_DELIMITERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={`جداکنندهٔ ${item.label}`}
            aria-pressed={node.delimiter === item.id}
            title={item.label}
            onClick={() => onDelimiterChange(item.id)}
          >
            {item.glyph}
          </button>
        ))}
      </div>
    </div>
  );
}

function calculusFieldSummary(operator: FormulaLargeOperator) {
  if (["integral", "double-integral", "triple-integral", "contour-integral"].includes(operator)) {
    return "کران پایین و بالا اختیاری · عبارت و متغیر انتگرال‌گیری الزامی";
  }
  if (operator === "derivative" || operator === "partial-derivative") {
    return "عبارت و متغیر الزامی · مرتبه اختیاری";
  }
  if (operator === "sum" || operator === "product") {
    return "کران پایین، کران بالا و عبارت الزامی";
  }
  return "شرط نزدیک‌شدن و عبارت حد الزامی";
}

function FormulaCalculusConfigurator({
  node,
  onOperatorChange,
}: {
  node: FormulaLargeOperatorNode;
  onOperatorChange: (operator: FormulaLargeOperator) => void;
}) {
  return (
    <div className="formula-calculus-configurator" aria-label="تنظیمات حسابان">
      <div className="formula-calculus-configurator-heading">
        <strong>نوع عملگر</strong>
        <span>تغییر نوع با حفظ عبارت</span>
      </div>
      <div className="formula-calculus-operators" role="group" aria-label="انتخاب عملگر حسابان">
        {CALCULUS_OPERATORS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-pressed={node.operator === item.id}
            onClick={() => onOperatorChange(item.id)}
          >
            <span aria-hidden="true">{item.glyph}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </div>
      <p>{calculusFieldSummary(node.operator)}</p>
    </div>
  );
}

function FormulaAlgebraConfigurator({
  node,
  onFunctionChange,
  onFenceChange,
  onCasesResize,
  onAccentChange,
}: {
  node: FormulaFunctionNode | FormulaFenceNode | FormulaCasesNode | Extract<FormulaExpressionNode, { kind: "accent" | "binomial" }>;
  onFunctionChange: (options: { name?: string; argumentCount?: number; withSubscript?: boolean }) => void;
  onFenceChange: (open: string, close: string) => void;
  onCasesResize: (rows: number) => void;
  onAccentChange: (accent: FormulaAccent) => void;
}) {
  if (node.kind === "function") {
    return (
      <div className="formula-algebra-configurator" aria-label="تنظیمات تابع">
        <div className="formula-algebra-configurator-heading"><strong>تابع</strong><span>ساختار و آرگومان‌ها حفظ می‌شوند</span></div>
        <label className="formula-function-select">
          <span>نوع تابع</span>
          <select aria-label="نوع تابع" value={node.name} onChange={(event) => onFunctionChange({ name: event.target.value })}>
            {ALGEBRA_FUNCTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <div className="formula-algebra-row">
          <span>تعداد آرگومان</span>
          <div role="group" aria-label="تعداد آرگومان‌های تابع">
            {[1, 2, 3].map((count) => (
              <button key={count} type="button" aria-pressed={node.arguments.length === count} onClick={() => onFunctionChange({ argumentCount: count })}>{count}</button>
            ))}
          </div>
        </div>
        <button className="formula-function-subscript" type="button" aria-pressed={Boolean(node.subscript)} onClick={() => onFunctionChange({ withSubscript: !node.subscript })}>
          پایه یا زیرنویس تابع
        </button>
      </div>
    );
  }
  if (node.kind === "fence") {
    return (
      <div className="formula-algebra-configurator" aria-label="تنظیمات حصار">
        <div className="formula-algebra-configurator-heading"><strong>نوع حصار</strong><span>عبارت داخلی حفظ می‌شود</span></div>
        <div className="formula-algebra-choice-grid" role="group" aria-label="انتخاب نوع حصار">
          {ALGEBRA_FENCES.map((item) => (
            <button key={`${item.open}-${item.close}`} type="button" aria-label={item.label} aria-pressed={node.open === item.open && node.close === item.close} onClick={() => onFenceChange(item.open, item.close)}>{item.glyph}</button>
          ))}
        </div>
      </div>
    );
  }
  if (node.kind === "cases") {
    return (
      <div className="formula-algebra-configurator" aria-label="تنظیمات تابع چندضابطه‌ای">
        <div className="formula-algebra-configurator-heading"><strong>تعداد ضابطه‌ها</strong><output>{node.rows.length}</output></div>
        <div className="formula-cases-count" role="group" aria-label="تعداد ردیف‌های تابع چندضابطه‌ای">
          {Array.from({ length: 8 }, (_, index) => index + 1).map((count) => (
            <button key={count} type="button" aria-pressed={node.rows.length === count} onClick={() => onCasesResize(count)}>{count}</button>
          ))}
        </div>
      </div>
    );
  }
  if (node.kind === "accent") {
    return (
      <div className="formula-algebra-configurator" aria-label="تنظیمات نشانهٔ فرمول">
        <div className="formula-algebra-configurator-heading"><strong>نوع نشانه</strong><span>عبارت زیر نشانه حفظ می‌شود</span></div>
        <div className="formula-algebra-choice-grid" role="group" aria-label="انتخاب نشانهٔ فرمول">
          {ALGEBRA_ACCENTS.map((item) => (
            <button key={item.id} type="button" aria-label={item.label} aria-pressed={node.accent === item.id} onClick={() => onAccentChange(item.id)}>{item.glyph}</button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="formula-algebra-configurator is-note" aria-label="راهنمای دوجمله‌ای">
      <strong>ضریب دوجمله‌ای</strong>
      <span>مقدار بالا و پایین را مستقیم در بوم وارد کنید.</span>
    </div>
  );
}

function FormulaSymbolPicker({
  symbols,
  recent,
  group,
  onGroupChange,
  onInsert,
}: {
  symbols: FormulaSymbolDefinition[];
  recent: FormulaSymbolDefinition[];
  group: FormulaSymbolGroup | "all";
  onGroupChange: (group: FormulaSymbolGroup | "all") => void;
  onInsert: (symbol: FormulaSymbolDefinition) => void;
}) {
  const symbolRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const groupRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const groups: Array<[FormulaSymbolGroup | "all", string]> = [["all", "همه"], ...FORMULA_SYMBOL_GROUPS];
  const onGroupKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.nativeEvent.isComposing) return;
    let next = index;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = groups.length - 1;
    else if (event.key === "ArrowRight") next = (index - 1 + groups.length) % groups.length;
    else if (event.key === "ArrowLeft") next = (index + 1) % groups.length;
    else return;
    event.preventDefault();
    onGroupChange(groups[next][0]);
    groupRefs.current[next]?.focus();
  };
  const moveFocus = (index: number) => {
    if (!symbols.length) return;
    const next = Math.min(symbols.length - 1, Math.max(0, index));
    symbolRefs.current[next]?.focus();
  };
  const onSymbolKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.nativeEvent.isComposing) return;
    let next = index;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = symbols.length - 1;
    else if (event.key === "ArrowRight") next = index + 1;
    else if (event.key === "ArrowLeft") next = index - 1;
    else if (event.key === "ArrowDown") next = index + 6;
    else if (event.key === "ArrowUp") next = index - 6;
    else return;
    event.preventDefault();
    moveFocus(next);
  };
  const symbolButton = (
    symbol: FormulaSymbolDefinition,
    index: number,
    recentItem = false,
  ) => (
    <button
      key={`${recentItem ? "recent" : "symbol"}-${symbol.id}`}
      ref={recentItem ? undefined : (element) => { symbolRefs.current[index] = element; }}
      type="button"
      tabIndex={recentItem || index === 0 ? 0 : -1}
      aria-label={`${symbol.label} — ${symbol.english}`}
      title={`${symbol.label} · ${symbol.english}`}
      onKeyDown={recentItem ? undefined : (event) => onSymbolKeyDown(event, index)}
      onClick={() => onInsert(symbol)}
    >
      <span aria-hidden="true">{symbol.glyph}</span>
    </button>
  );

  return (
    <section className="formula-symbol-picker" aria-label="انتخاب‌گر نماد">
      <div className="formula-symbol-groups" role="tablist" aria-label="گروه‌های نماد">
        {groups.map(([id, label], index) => (
          <button
            key={id}
            ref={(element) => { groupRefs.current[index] = element; }}
            type="button"
            role="tab"
            tabIndex={group === id ? 0 : -1}
            aria-selected={group === id}
            onKeyDown={(event) => onGroupKeyDown(event, index)}
            onClick={() => onGroupChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {recent.length > 0 && group === "all" && (
        <div className="formula-symbol-recent">
          <strong>اخیراً استفاده‌شده</strong>
          <div>{recent.map((symbol, index) => symbolButton(symbol, index, true))}</div>
        </div>
      )}
      <div className="formula-symbol-grid" role="group" aria-label="نمادهای قابل درج">
        {symbols.map((symbol, index) => symbolButton(symbol, index))}
      </div>
      {!symbols.length && <p className="formula-template-empty">نمادی با این جست‌وجو پیدا نشد.</p>}
      <p className="formula-symbol-hint">←↑↓→ پیمایش · Enter درج · هر نماد یک Undo</p>
    </section>
  );
}

function FormulaContextInspector({
  node,
  depth,
  onCalculusOperatorChange,
  onResizeMatrix,
  onMatrixDelimiterChange,
  onFunctionChange,
  onFenceChange,
  onCasesResize,
  onAccentChange,
  onChangeStructure,
  onWrap,
  onPromote,
  onDuplicate,
  onDelete,
}: {
  node: FormulaExpressionNode;
  depth: number;
  onCalculusOperatorChange: (operator: FormulaLargeOperator) => void;
  onResizeMatrix: (rows: number, columns: number) => void;
  onMatrixDelimiterChange: (delimiter: FormulaMatrixDelimiter) => void;
  onFunctionChange: (options: { name?: string; argumentCount?: number; withSubscript?: boolean }) => void;
  onFenceChange: (open: string, close: string) => void;
  onCasesResize: (rows: number) => void;
  onAccentChange: (accent: FormulaAccent) => void;
  onChangeStructure: () => void;
  onWrap: () => void;
  onPromote: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const preview = useMemo(() => {
    try { return serializeFormulaToLatex(node, { allowPlaceholders: true }); }
    catch { return "\\square"; }
  }, [node]);
  return (
    <section className="formula-context-inspector" aria-label="بازرس ساختار فعال">
      <div className="formula-context-header">
        <FormulaMath latex={preview} className="formula-context-preview" />
        <div><strong>{nodeLabel(node)} Node</strong><span>عمق {depth} · {node.kind}</span></div>
      </div>
      {node.kind === "matrix" && (
        <FormulaMatrixConfigurator
          key={`${node.id}:${node.rows}x${node.columns}`}
          node={node}
          onResize={onResizeMatrix}
          onDelimiterChange={onMatrixDelimiterChange}
        />
      )}
      {node.kind === "large-operator" && (
        <FormulaCalculusConfigurator
          node={node}
          onOperatorChange={onCalculusOperatorChange}
        />
      )}
      {["function", "fence", "cases", "accent", "binomial"].includes(node.kind) && (
        <FormulaAlgebraConfigurator
          node={node as FormulaFunctionNode | FormulaFenceNode | FormulaCasesNode | Extract<FormulaExpressionNode, { kind: "accent" | "binomial" }>}
          onFunctionChange={onFunctionChange}
          onFenceChange={onFenceChange}
          onCasesResize={onCasesResize}
          onAccentChange={onAccentChange}
        />
      )}
      <button type="button" onClick={onChangeStructure}><RefreshCw size={18} aria-hidden="true" /><strong>تغییر ساختار</strong></button>
      <button type="button" onClick={onWrap}><GitMerge size={18} aria-hidden="true" /><span>قرار دادن داخل کسر</span></button>
      <button type="button" onClick={onPromote}><Move size={18} aria-hidden="true" /><span>یک سطح بیرون</span></button>
      <button type="button" onClick={onDuplicate}><Copy size={18} aria-hidden="true" /><span>تکثیر node</span></button>
      <button className="is-destructive" type="button" onClick={onDelete}><Trash2 size={18} aria-hidden="true" /><span>حذف node</span></button>
      <div className="formula-context-keyboard"><span>Escape: بازگشت به متن</span><span dir="ltr">Tab · ↑↓←→</span></div>
    </section>
  );
}

export function FormulaStudio({
  open,
  isTopLayer,
  session,
  fileName,
  onApply,
  onClose,
  returnFocusRef,
  backNavigationEnabled = false,
}: {
  open: boolean;
  isTopLayer: boolean;
  session: FormulaStudioSession;
  fileName: string;
  onApply: (latex: string, session: FormulaStudioSession) => FormulaApplyResult;
  onClose: (session: FormulaStudioSession) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  backNavigationEnabled?: boolean;
}) {
  const recovered = useMemo(() => initialStudioState(fileName, session), [fileName, session]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const categoryRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const leafRefs = useRef<Map<FormulaNodeId, HTMLInputElement>>(new Map());
  const pendingHistoryFocusRef = useRef<FormulaNodeId | null>(null);
  const [formula, setFormula] = useState(recovered.formula);
  const [mode, setMode] = useState<StudioMode>(recovered.mode);
  const [rawLatex, setRawLatex] = useState(recovered.rawLatex);
  const [rawPast, setRawPast] = useState<string[]>([]);
  const [rawFuture, setRawFuture] = useState<string[]>([]);
  const [smartEntry, setSmartEntry] = useState("");
  const [smartEditing, setSmartEditing] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<FormulaNodeId | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<FormulaStructureId | null>(null);
  const [category, setCategory] = useState<FormulaStudioCategory>("base");
  const [categoryFiltered, setCategoryFiltered] = useState(false);
  const [symbolGroup, setSymbolGroup] = useState<FormulaSymbolGroup | "all">("all");
  const [recentSymbolIds, setRecentSymbolIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = JSON.parse(window.localStorage.getItem(RECENT_SYMBOLS_KEY) ?? "[]");
      return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string").slice(0, 8) : [];
    } catch {
      return [];
    }
  });
  const [query, setQuery] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [saved, setSaved] = useState(true);
  const [announcement, setAnnouncement] = useState("");

  const initialLatex = session.initialLatex.trim();
  const treeValidation = useMemo(() => validateFormulaTree(formula.root), [formula.root]);
  const visualPreviewLatex = useMemo(() => {
    try { return serializeFormulaToLatex(formula.root, { allowPlaceholders: true }); }
    catch { return "\\square"; }
  }, [formula.root]);
  const visualLatex = useMemo(() => {
    if (!formulaTreeIsComplete(formula.root)) return "";
    try { return serializeFormulaToLatex(formula.root); }
    catch { return ""; }
  }, [formula.root]);
  const advancedValidation = useMemo(() => validateAdvancedLatex(rawLatex), [rawLatex]);
  const complete = mode === "visual"
    ? treeValidation.status === "valid"
    : advancedValidation.status === "valid" || advancedValidation.status === "unsupported";
  const latex = mode === "visual" ? visualLatex : rawLatex.trim();
  const dirty = latex !== initialLatex || (!complete && visualPreviewLatex !== "\\square");
  const leaves = useMemo(() => formulaLeafNodes(formula.root), [formula.root]);
  const activeLeafIndex = leaves.findIndex((leaf) => leaf.id === formula.activeNodeId);
  const breadcrumbNodes = useMemo(
    () => formulaBreadcrumb(formula.root, formula.activeNodeId),
    [formula.activeNodeId, formula.root],
  );
  const contextNode = useMemo(() => {
    if (selectedNodeId) {
      const selected = findFormulaNode(formula.root, selectedNodeId)?.node;
      if (selected) return selected;
    }
    return [...breadcrumbNodes].reverse().find((node) => !["slot", "atom", "row"].includes(node.kind))
      ?? breadcrumbNodes.at(-1)
      ?? formula.root;
  }, [breadcrumbNodes, formula.root, selectedNodeId]);
  const isPristine = formula.root.kind === "row"
    && formula.root.children.length === 1
    && formula.root.children[0].kind === "slot";
  const visibleStructures = useMemo(() => {
    if (!query && !categoryFiltered) {
      return FEATURED_STRUCTURES.map((id) => FORMULA_STRUCTURES.find((item) => item.id === id)!).filter(Boolean);
    }
    return filterFormulaStructures(query, query ? undefined : category);
  }, [category, categoryFiltered, query]);
  const symbolPickerOpen = mode === "visual" && category === "symbols" && categoryFiltered;
  const visibleSymbols = useMemo(
    () => filterFormulaSymbols(query, symbolGroup),
    [query, symbolGroup],
  );
  const recentSymbols = useMemo(
    () => formulaSymbolsFromRecent(recentSymbolIds),
    [recentSymbolIds],
  );

  const persistableDraft = useMemo<PersistedFormulaDraft>(() => ({
    version: 2,
    root: formula.root,
    activeNodeId: formula.activeNodeId,
    mode,
    rawLatex,
  }), [formula.activeNodeId, formula.root, mode, rawLatex]);

  useEffect(() => {
    if (!open || !dirty) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey(fileName, session), JSON.stringify(persistableDraft));
      } catch {
        // The in-memory draft remains available if local storage is blocked.
      }
      setSaved(true);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [dirty, fileName, open, persistableDraft, session]);

  useEffect(() => {
    const nodeId = pendingHistoryFocusRef.current;
    if (!nodeId) return;
    pendingHistoryFocusRef.current = null;
    const frame = requestAnimationFrame(() => {
      (leafRefs.current.get(nodeId) ?? closeButtonRef.current)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [formula.revision]);

  const setActiveNode = (nodeId: FormulaNodeId) => {
    setFormula((current) => ({ ...current, activeNodeId: nodeId }));
    setSelectedNodeId(null);
  };

  const commitMutation = (
    label: string,
    mutate: Parameters<typeof commitFormulaTransaction>[2],
    message?: string,
  ) => {
    let nextActiveNodeId = formula.activeNodeId;
    setFormula((current) => {
      const next = commitFormulaTransaction(current, label, (root, activeNodeId) => {
        const mutation = mutate(root, activeNodeId);
        nextActiveNodeId = mutation.activeNodeId;
        return mutation;
      });
      return next;
    });
    setSaved(false);
    setApplyError("");
    setSelectedNodeId(null);
    if (message) setAnnouncement(message);
    requestAnimationFrame(() => leafRefs.current.get(nextActiveNodeId)?.focus());
  };

  const commitRaw = (value: string, message?: string) => {
    if (value === rawLatex) return;
    setRawPast((current) => [...current, rawLatex].slice(-100));
    setRawFuture([]);
    setRawLatex(value);
    setSaved(false);
    setApplyError("");
    if (message) setAnnouncement(message);
  };

  const selectStructure = (definition: FormulaStructureDefinition) => {
    if (definition.id === "symbols") {
      setMode("visual");
      setCategory("symbols");
      setCategoryFiltered(true);
      setSymbolGroup("all");
      setQuery("");
      setSelectedStructure("symbols");
      setAnnouncement("انتخاب‌گر نماد باز شد");
      requestAnimationFrame(() => searchRef.current?.focus());
      return;
    }
    const structure = createFormulaStructure(definition.id);
    commitMutation(
      `insert ${definition.id}`,
      (root, activeNodeId) => {
        const active = findFormulaNode(root, activeNodeId)?.node;
        if (active?.kind === "slot" || (active?.kind === "atom" && active.editable !== false)) {
          return {
            root: replaceFormulaNode(root, activeNodeId, structure),
            activeNodeId: formulaLeafNodes(structure)[0]?.id ?? structure.id,
          };
        }
        return insertFormulaStructureAtSlot(root, activeNodeId, structure);
      },
      `${definition.title} در خانهٔ فعال قرار گرفت`,
    );
    setSelectedStructure(definition.id);
    setCategory(definition.category);
  };

  const insertSymbol = (symbol: FormulaSymbolDefinition) => {
    commitMutation(
      `insert symbol ${symbol.id}`,
      (root, activeNodeId) => insertFormulaSymbolAtActive(root, activeNodeId, symbol.latex),
      `${symbol.label} درج شد`,
    );
    setRecentSymbolIds((current) => {
      const next = [symbol.id, ...current.filter((id) => id !== symbol.id)].slice(0, 8);
      try { window.localStorage.setItem(RECENT_SYMBOLS_KEY, JSON.stringify(next)); }
      catch { /* Recent symbols remain available in memory if storage is blocked. */ }
      return next;
    });
  };

  const updateLeaf = (
    node: Extract<FormulaExpressionNode, { kind: "slot" | "atom" }>,
    value: string,
  ) => {
    commitMutation(`edit ${node.id}`, (root) => {
      const replacement = value.length > 0
        ? formulaAtom(value, atomKindForValue(value), node.id)
        : formulaSlot(node.kind === "slot" ? node.name : "expression", true, node.id);
      return { root: replaceFormulaNode(root, node.id, replacement), activeNodeId: node.id };
    });
  };

  const moveLeafFocus = (delta: number) => {
    if (!leaves.length) return;
    const start = activeLeafIndex >= 0 ? activeLeafIndex : 0;
    const next = (start + delta + leaves.length) % leaves.length;
    setActiveNode(leaves[next].id);
    leafRefs.current.get(leaves[next].id)?.focus();
    setAnnouncement(`خانهٔ ${next + 1} از ${leaves.length}`);
  };

  const onLeafKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
    nodeId: FormulaNodeId,
  ) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Tab") {
      event.preventDefault();
      moveLeafFocus(event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setSelectedNodeId(null);
      leafRefs.current.get(nodeId)?.focus();
      return;
    }
    if (!event.currentTarget.value && ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      moveLeafFocus(["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1);
    }
  };

  const updateSmartEntry = (value: string) => {
    setSmartEntry(value);
    setSmartEditing(true);
    const normalized = smartFormulaInput(value);
    if (!normalized) {
      const empty = emptyFormulaTree();
      setFormula(createFormulaHistory(empty.root, empty.activeNodeId));
      setSaved(false);
      return;
    }
    const validation = validateAdvancedLatex(normalized);
    if (validation.status === "valid" && validation.tree) {
      const first = formulaLeafNodes(validation.tree)[0]?.id ?? validation.tree.id;
      setFormula((current) => commitFormulaTransaction(current, "smart input", () => ({ root: validation.tree!, activeNodeId: first })));
      setApplyError("");
    } else if (validation.status === "invalid") {
      setApplyError(validation.message ?? "عبارت هنوز کامل نیست.");
    }
    setSaved(false);
  };

  const requestClose = () => {
    if (dirty) {
      setConfirmClose(true);
      return;
    }
    onClose(session);
  };

  useModalFocus({
    open: open && confirmClose,
    isTopLayer,
    containerRef: confirmDialogRef,
    initialFocusRef: confirmCancelRef,
    returnFocusRef: closeButtonRef,
  });

  useBackLayer("formula:studio", open, requestClose, backNavigationEnabled);

  const applyFormula = () => {
    if (!complete || !latex) {
      setApplyError(mode === "visual"
        ? treeValidation.message ?? "همهٔ خانه‌های لازم را پر کنید."
        : advancedValidation.message ?? "LaTeX را کامل و معتبر کنید.");
      const incompleteNodeId = treeValidation.nodeId;
      if (incompleteNodeId) leafRefs.current.get(incompleteNodeId)?.focus();
      return;
    }
    const result = onApply(latex, session);
    if (!result.ok) {
      setApplyError(result.message);
      return;
    }
    try { window.localStorage.removeItem(draftKey(fileName, session)); }
    catch { /* The document update succeeded; cleanup is best effort. */ }
  };

  const undo = () => {
    if (mode === "advanced") {
      const previous = rawPast.at(-1);
      if (previous === undefined) return;
      setRawPast((current) => current.slice(0, -1));
      setRawFuture((current) => [...current, rawLatex]);
      setRawLatex(previous);
    } else setFormula((current) => {
      const next = undoFormulaTransaction(current);
      pendingHistoryFocusRef.current = next.activeNodeId;
      return next;
    });
    setSaved(false);
    setAnnouncement("آخرین تغییر فرمول برگردانده شد");
  };

  const redo = () => {
    if (mode === "advanced") {
      const next = rawFuture.at(-1);
      if (next === undefined) return;
      setRawFuture((current) => current.slice(0, -1));
      setRawPast((current) => [...current, rawLatex]);
      setRawLatex(next);
    } else setFormula((current) => {
      const next = redoFormulaTransaction(current);
      pendingHistoryFocusRef.current = next.activeNodeId;
      return next;
    });
    setSaved(false);
    setAnnouncement("تغییر فرمول دوباره اعمال شد");
  };

  const clearCanvas = () => {
    if (mode === "advanced") commitRaw("", "ورودی Advanced پاک شد");
    else {
      commitMutation("clear canvas", () => emptyFormulaTree(), "بوم فرمول پاک شد");
      setSmartEntry("");
      setSmartEditing(false);
    }
  };

  const switchMode = () => {
    if (mode === "visual") {
      const source = visualLatex || visualPreviewLatex.replace(/\\square/gu, "");
      if (source && rawLatex !== source) commitRaw(source);
      setMode("advanced");
      setAnnouncement("حالت Advanced LaTeX فعال شد");
      return;
    }
    const validation = validateAdvancedLatex(rawLatex);
    if (validation.status !== "valid" || !validation.tree) {
      setApplyError(validation.status === "unsupported"
        ? "این LaTeX معتبر است اما معادل دیداری کامل ندارد؛ در حالت Advanced باقی می‌ماند."
        : validation.message ?? "LaTeX هنوز قابل تبدیل به ساختار دیداری نیست.");
      return;
    }
    const active = formulaLeafNodes(validation.tree)[0]?.id ?? validation.tree.id;
    setFormula(createFormulaHistory(validation.tree, active));
    setMode("visual");
    setApplyError("");
    setAnnouncement("فرمول به Expression Tree دیداری تبدیل شد");
  };

  const moveCategoryFocus = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.nativeEvent.isComposing) return;
    let next = index;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = FORMULA_STUDIO_CATEGORIES.length - 1;
    else if (event.key === "ArrowRight") next = (index - 1 + FORMULA_STUDIO_CATEGORIES.length) % FORMULA_STUDIO_CATEGORIES.length;
    else if (event.key === "ArrowLeft") next = (index + 1) % FORMULA_STUDIO_CATEGORIES.length;
    else return;
    event.preventDefault();
    setCategory(FORMULA_STUDIO_CATEGORIES[next][0]);
    setCategoryFiltered(true);
    categoryRefs.current[next]?.focus();
  };

  const contextDepth = findFormulaNode(formula.root, contextNode.id)?.ancestors.length ?? formulaTreeDepth(contextNode);
  const undoDisabled = mode === "visual" ? formula.past.length === 0 : rawPast.length === 0;
  const redoDisabled = mode === "visual" ? formula.future.length === 0 : rawFuture.length === 0;

  const onStudioKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing || confirmClose) return;
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (modifier && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if (modifier && event.key === "Enter") {
      event.preventDefault();
      applyFormula();
      return;
    }
    if (event.altKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      switchMode();
      return;
    }
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const target = event.target as HTMLElement;
      if (!target.matches("input, textarea, select, [contenteditable='true']")) {
        event.preventDefault();
        searchRef.current?.focus();
        setAnnouncement("جست‌وجوی ساختار فعال شد");
      }
    }
  };

  const onStudioCopy = (event: ReactClipboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (
      (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
      && target.selectionStart !== null
      && target.selectionEnd !== null
      && target.selectionStart !== target.selectionEnd
    ) return;
    const sourceNode = selectedNodeId ? findFormulaNode(formula.root, selectedNodeId)?.node : formula.root;
    if (!sourceNode || mode !== "visual") return;
    try {
      const source = serializeFormulaToLatex(sourceNode);
      event.preventDefault();
      event.clipboardData.setData("text/plain", source);
      setAnnouncement("LaTeX فرمول در حافظهٔ موقت کپی شد");
    } catch {
      setAnnouncement("برای کپی، همهٔ خانه‌های لازم را کامل کنید");
    }
  };

  const onStudioPaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (mode !== "visual") return;
    const target = event.target as HTMLElement;
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    const source = event.clipboardData.getData("text/plain").trim();
    if (!source) return;
    const isFormulaSlot = target instanceof HTMLInputElement && target.classList.contains("formula-slot");
    const looksStructural = /[\\{}_^]|\\begin|\\left/u.test(source);
    if (target instanceof HTMLInputElement && !isFormulaSlot) return;
    if (isFormulaSlot && !looksStructural) return;

    const validation = validateAdvancedLatex(source);
    if (validation.status !== "valid" || !validation.tree) {
      if (looksStructural) {
        event.preventDefault();
        setApplyError(validation.message ?? "LaTeX چسبانده‌شده قابل تبدیل به ساختار دیداری نیست.");
        setAnnouncement("چسباندن فرمول انجام نشد");
      }
      return;
    }
    event.preventDefault();
    const pastedTree = validation.tree;
    commitMutation("paste formula", (root, activeNodeId) => {
      const active = findFormulaNode(root, activeNodeId)?.node;
      if (active?.kind === "slot" || active?.kind === "atom") {
        return {
          root: replaceFormulaNode(root, activeNodeId, pastedTree),
          activeNodeId: formulaLeafNodes(pastedTree)[0]?.id ?? pastedTree.id,
        };
      }
      return { root: pastedTree, activeNodeId: formulaLeafNodes(pastedTree)[0]?.id ?? pastedTree.id };
    }, "فرمول چسبانده‌شده به ساختار دیداری تبدیل شد");
  };

  return (
    <AccessibleModal
      open={open}
      isTopLayer={isTopLayer}
      onClose={requestClose}
      dialogRef={dialogRef}
      initialFocusRef={closeButtonRef}
      returnFocusRef={returnFocusRef}
      backdropClassName="formula-studio-backdrop"
      dialogClassName="formula-studio"
      labelledBy="formula-studio-title"
      describedBy="formula-studio-description"
      trapFocus={!confirmClose}
    >
      <div
        className="formula-studio-surface"
        inert={confirmClose ? true : undefined}
        aria-hidden={confirmClose || undefined}
        onKeyDown={onStudioKeyDown}
        onCopy={onStudioCopy}
        onPaste={onStudioPaste}
      >
        <header className="formula-studio-header">
          <div className="formula-studio-identity">
            <span className="formula-studio-mark"><FormulaMark /></span>
            <div>
              <strong id="formula-studio-title">استودیو فرمول</strong>
              <span id="formula-studio-description">Expression Tree · {session.mode === "edit" ? "ویرایش بلوک" : "بلوک مستقل"}</span>
            </div>
          </div>
          <div className="formula-studio-document-actions">
            <button className="formula-primary-action" type="button" disabled={!complete} onClick={applyFormula}>
              <span className="formula-desktop-label">{session.mode === "edit" ? "ذخیرهٔ تغییرات" : "افزودن به سند"}</span>
              <span className="formula-compact-label">{session.mode === "edit" ? "ذخیره" : "افزودن"}</span>
            </button>
            <button ref={closeButtonRef} className="formula-back-action" type="button" onClick={requestClose} aria-label="بازگشت به سند">
              <span className="formula-desktop-label">بازگشت به سند</span>
              <X className="formula-compact-label" size={18} aria-hidden="true" />
            </button>
            <span className="formula-save-status" aria-live="polite"><i />{saved ? "همه‌چیز ذخیره است" : "در حال ذخیرهٔ تغییرها"}</span>
          </div>
        </header>

        <nav className="formula-ribbon" aria-label="ابزارها و دسته‌های فرمول">
          <div className="formula-ribbon-utilities">
            <button type="button" onClick={undo} disabled={undoDisabled} aria-label="برگرداندن تغییر فرمول"><Undo2 size={18} aria-hidden="true" /></button>
            <button type="button" onClick={redo} disabled={redoDisabled} aria-label="دوباره انجام دادن تغییر فرمول"><Redo2 size={18} aria-hidden="true" /></button>
            <button className="formula-clear-action" type="button" disabled={isPristine && !rawLatex} onClick={clearCanvas}>پاک‌کردن</button>
          </div>
          <div className="formula-categories" role="tablist" aria-label="دسته‌های فرمول">
            {FORMULA_STUDIO_CATEGORIES.map(([id, label], index) => (
              <button
                key={id}
                ref={(node) => { categoryRefs.current[index] = node; }}
                type="button"
                role="tab"
                tabIndex={mode === "visual" && category === id ? 0 : -1}
                aria-selected={mode === "visual" && category === id}
                onClick={() => {
                  setMode("visual");
                  setCategory(id);
                  setCategoryFiltered(true);
                  if (id === "symbols") {
                    setSymbolGroup("all");
                    setQuery("");
                  }
                }}
                onKeyDown={(event) => moveCategoryFocus(event, index)}
              >
                {label}
              </button>
            ))}
            <button className="formula-advanced-mode" type="button" aria-pressed={mode === "advanced"} onClick={switchMode}>Advanced LaTeX</button>
          </div>
        </nav>

        <main className="formula-studio-content">
          <section className="formula-canvas-area" aria-label="بوم دیداری فرمول">
            {mode === "visual" ? (
              <>
                {isPristine && !smartEditing ? (
                  <div className="formula-canvas-meta"><span className="formula-zoom-status" aria-label="بزرگ‌نمایی بوم، صد درصد">۱۰۰٪</span><span><i />ورودی دیداری · Expression Tree</span></div>
                ) : (
                  <FormulaBreadcrumb nodes={breadcrumbNodes} onSelect={setSelectedNodeId} />
                )}
                {isPristine || smartEditing ? (
                  <div className="formula-stage is-empty">
                    <span className="formula-empty-mark"><FormulaMark size={36} /></span>
                    <div className="formula-empty-copy"><strong>فرمول را بدون کد بسازید</strong><span>از سمت راست ساختار انتخاب کنید؛ هر ساختار داخل خانهٔ فعال قرار می‌گیرد.</span></div>
                    <label className="formula-direct-field">
                      <span className="sr-only">فرمول هوشمند</span>
                      <input
                        dir="ltr"
                        value={smartEntry}
                        placeholder="مثلاً x2+1 یا sin(x) را تایپ کنید"
                        onFocus={() => setSmartEditing(true)}
                        onChange={(event) => updateSmartEntry(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.nativeEvent.isComposing) return;
                          if (event.key === "Enter" && treeValidation.status === "valid") {
                            event.preventDefault();
                            setSmartEditing(false);
                            requestAnimationFrame(() => leafRefs.current.get(formula.activeNodeId)?.focus());
                          }
                        }}
                      />
                    </label>
                    <p className="formula-keyboard-help">Tab میان خانه‌ها · / جست‌وجوی ساختار · Alt+L حالت Advanced · Ctrl/Cmd+Enter تأیید</p>
                  </div>
                ) : (
                  <div className={`formula-stage is-building ${complete ? "is-complete" : "is-incomplete"}`}>
                    <span className="formula-nested-status">ساختار تو‌در‌تو · خانهٔ {Math.max(activeLeafIndex + 1, 1)} از {Math.max(leaves.length, 1)}</span>
                    <div className="formula-visual-editor" dir="ltr">
                      <FormulaNodeEditor
                        node={formula.root}
                        activeNodeId={formula.activeNodeId}
                        selectedNodeId={selectedNodeId}
                        leafRefs={leafRefs}
                        onActivate={setActiveNode}
                        onSelect={setSelectedNodeId}
                        onLeafChange={updateLeaf}
                        onLeafKeyDown={onLeafKeyDown}
                      />
                    </div>
                    <p className="formula-nested-help">ساختار در Slot روشن درج می‌شود؛ Tab جابه‌جایی · Ctrl/Cmd+Z واگرد · Ctrl/Cmd+Enter تأیید.</p>
                    {leaves.length > 0 && (
                      <div className="formula-slot-navigation">
                        <div><button type="button" onClick={() => moveLeafFocus(-1)}>قبلی</button><button className="is-primary" type="button" onClick={() => moveLeafFocus(1)}>بعدی</button></div>
                        <span><kbd>Tab</kbd> {Math.max(activeLeafIndex + 1, 1)} از {leaves.length}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="formula-advanced-stage">
                <div className="formula-advanced-copy"><strong>Advanced LaTeX</strong><span>برای فرمول‌های long-tail؛ منبع معتبر ولی پشتیبانی‌نشده بدون تغییر حفظ می‌شود.</span></div>
                <textarea dir="ltr" aria-label="ورودی LaTeX پیشرفته" value={rawLatex} onChange={(event) => commitRaw(event.target.value)} spellCheck={false} />
                <div className={`formula-advanced-status is-${advancedValidation.status}`} role={advancedValidation.status === "invalid" ? "alert" : "status"}>
                  <strong>{advancedValidation.status === "valid" ? "معتبر و قابل تبدیل" : advancedValidation.status === "unsupported" ? "معتبر؛ فقط در Advanced" : advancedValidation.status === "incomplete" ? "ناقص" : "نیاز به اصلاح"}</strong>
                  <span>{advancedValidation.message ?? "این فرمول می‌تواند به Expression Tree دیداری برگردد."}</span>
                  {advancedValidation.location && <code dir="ltr">Ln {advancedValidation.location.line}, Col {advancedValidation.location.column}</code>}
                </div>
                {rawLatex.trim() && <div className="formula-advanced-preview"><FormulaMath latex={rawLatex} /></div>}
              </div>
            )}
            {applyError && <div className="formula-inline-error" role="alert">{applyError}</div>}
          </section>

          <aside className={`formula-template-palette${symbolPickerOpen ? " is-symbol-picker" : ""}`} aria-label={symbolPickerOpen ? "انتخاب‌گر نماد" : "ساختارهای دیداری"}>
            <span className="formula-sheet-handle" aria-hidden="true" />
            {!isPristine && mode === "visual" && (
              <FormulaContextInspector
                node={contextNode}
                depth={contextDepth}
                onCalculusOperatorChange={(operator) => commitMutation(
                  `calculus operator ${operator}`,
                  (root, activeNodeId) => reconfigureFormulaLargeOperator(
                    root,
                    contextNode.id,
                    operator,
                    createFormulaNodeId,
                    activeNodeId,
                  ),
                  "نوع عملگر حسابان تغییر کرد",
                )}
                onResizeMatrix={(rows, columns) => commitMutation(
                  `resize matrix ${rows}x${columns}`,
                  (root, activeNodeId) => resizeFormulaMatrix(
                    root,
                    contextNode.id,
                    rows,
                    columns,
                    createFormulaNodeId,
                    activeNodeId,
                  ),
                  `اندازهٔ ماتریس به ${rows} در ${columns} تغییر کرد`,
                )}
                onMatrixDelimiterChange={(delimiter) => commitMutation(
                  `matrix delimiter ${delimiter}`,
                  (root, activeNodeId) => setFormulaMatrixDelimiter(
                    root,
                    contextNode.id,
                    delimiter,
                    activeNodeId,
                  ),
                  "جداکنندهٔ ماتریس تغییر کرد",
                )}
                onFunctionChange={(options) => commitMutation(
                  "reconfigure function",
                  (root, activeNodeId) => reconfigureFormulaFunction(
                    root,
                    contextNode.id,
                    options,
                    createFormulaNodeId,
                    activeNodeId,
                  ),
                  "ساختار تابع تغییر کرد",
                )}
                onFenceChange={(open, close) => commitMutation(
                  "reconfigure fence",
                  (root, activeNodeId) => reconfigureFormulaFence(root, contextNode.id, open, close, activeNodeId),
                  "نوع حصار تغییر کرد",
                )}
                onCasesResize={(rows) => commitMutation(
                  `resize cases ${rows}`,
                  (root, activeNodeId) => resizeFormulaCases(
                    root,
                    contextNode.id,
                    rows,
                    createFormulaNodeId,
                    activeNodeId,
                  ),
                  `تعداد ضابطه‌ها به ${rows} تغییر کرد`,
                )}
                onAccentChange={(accent) => commitMutation(
                  `reconfigure accent ${accent}`,
                  (root, activeNodeId) => reconfigureFormulaAccent(root, contextNode.id, accent, activeNodeId),
                  "نوع نشانه تغییر کرد",
                )}
                onChangeStructure={() => { searchRef.current?.focus(); setAnnouncement("ساختار جایگزین را انتخاب کنید"); }}
                onWrap={() => commitMutation("wrap fraction", (root) => wrapFormulaNode(root, contextNode.id, (node) => ({ id: createFormulaNodeId(), kind: "fraction", numerator: node, denominator: formulaSlot("denominator") })), "ساختار داخل کسر قرار گرفت")}
                onPromote={() => commitMutation("promote node", (root) => promoteFormulaNode(root, contextNode.id), "ساختار یک سطح بیرون آمد")}
                onDuplicate={() => commitMutation("duplicate node", (root) => duplicateFormulaNode(root, contextNode.id), "ساختار تکثیر شد")}
                onDelete={() => commitMutation("delete node", (root) => clearFormulaNode(root, contextNode.id), "ساختار حذف شد")}
              />
            )}
            <div className="formula-palette-header">
              <strong>{symbolPickerOpen ? "نمادهای دیداری" : "ساختارهای دیداری"}</strong>
              <span>{symbolPickerOpen ? "نماد در خانهٔ فعال درج یا به عبارت افزوده می‌شود." : "ساختار در خانهٔ فعال درج می‌شود."}</span>
            </div>
            <button type="button" className="formula-view-all" onClick={() => { setQuery(""); setCategory("base"); setCategoryFiltered(false); setSelectedStructure(null); setAnnouncement("همهٔ ساختارها نمایش داده شدند"); }}>مشاهدهٔ همه</button>
            <label className="formula-symbol-search"><span className="sr-only">{symbolPickerOpen ? "جست‌وجوی نماد" : "جست‌وجوی ساختار یا نماد"}</span><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={symbolPickerOpen ? "نام فارسی، انگلیسی یا LaTeX" : "جست‌وجوی ساختار یا نماد"} /><Search size={16} aria-hidden="true" /></label>
            {symbolPickerOpen ? (
              <FormulaSymbolPicker
                symbols={visibleSymbols}
                recent={query ? [] : recentSymbols}
                group={symbolGroup}
                onGroupChange={setSymbolGroup}
                onInsert={insertSymbol}
              />
            ) : (
              <>
                <div className="formula-template-grid">
                  {visibleStructures.map((structure) => (
                    <button key={structure.id} type="button" className={selectedStructure === structure.id ? "is-selected" : ""} aria-label={structure.title} aria-pressed={selectedStructure === structure.id} onClick={() => selectStructure(structure)}>
                      <FormulaTemplatePreview type={structure.id} />
                      <strong>{structure.title}</strong>
                      <span>{structure.hint}</span>
                    </button>
                  ))}
                </div>
                {!visibleStructures.length && <p className="formula-template-empty">ساختاری با این جست‌وجو پیدا نشد.</p>}
              </>
            )}
          </aside>
        </main>
        <span className="sr-only" aria-live="polite">{announcement}</span>
      </div>

      {confirmClose && (
        <div className="formula-confirm-backdrop" role="presentation">
          <div ref={confirmDialogRef} className="formula-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="formula-confirm-title" aria-describedby="formula-confirm-description" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setConfirmClose(false); } }}>
            <strong id="formula-confirm-title">تغییرات کنار گذاشته شوند؟</strong>
            <p id="formula-confirm-description">پیش‌نویس محلی این فرمول حذف می‌شود و سند دست‌نخورده می‌ماند.</p>
            <div>
              <button ref={confirmCancelRef} type="button" onClick={() => setConfirmClose(false)}>انصراف</button>
              <button className="is-destructive" type="button" onClick={() => { try { window.localStorage.removeItem(draftKey(fileName, session)); } catch { /* Storage cleanup is best effort. */ } onClose(session); }}>کنار گذاشتن</button>
            </div>
          </div>
        </div>
      )}
    </AccessibleModal>
  );
}
