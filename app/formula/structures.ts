import {
  createFormulaLargeOperator,
  createFormulaFunction,
  createFormulaMatrix,
  createFormulaNodeId,
  formulaAtom,
  formulaRow,
  formulaSlot,
  type FormulaExpressionNode,
  type FormulaNodeFactory,
} from "./expression-tree";
import { normalizeFormulaSearch } from "./model";

export type FormulaStudioCategory =
  | "base"
  | "power"
  | "algebra"
  | "calculus"
  | "matrix"
  | "symbols";

export type FormulaStructureId =
  | "fraction"
  | "power"
  | "root"
  | "function"
  | "fence"
  | "cases"
  | "accent"
  | "binomial"
  | "integral"
  | "double-integral"
  | "triple-integral"
  | "contour-integral"
  | "derivative"
  | "partial-derivative"
  | "sum"
  | "product"
  | "limit"
  | "matrix"
  | "symbols";

export type FormulaStructureDefinition = {
  id: FormulaStructureId;
  title: string;
  category: FormulaStudioCategory;
  preview: string;
  hint: string;
  keywords: string[];
  create: (idFactory?: FormulaNodeFactory) => FormulaExpressionNode;
};

export const FORMULA_STUDIO_CATEGORIES: Array<[FormulaStudioCategory, string]> = [
  ["base", "پایه"],
  ["power", "توان و ریشه"],
  ["algebra", "توابع و جبر"],
  ["calculus", "حسابان"],
  ["matrix", "ماتریس"],
  ["symbols", "نمادها"],
];

export const FORMULA_STRUCTURES: FormulaStructureDefinition[] = [
  {
    id: "fraction",
    title: "کسر",
    category: "base",
    preview: "a⁄b",
    hint: "صورت · مخرج",
    keywords: ["fraction", "کسر", "صورت", "مخرج"],
    create: (ids = createFormulaNodeId) => ({
      id: ids(),
      kind: "fraction",
      numerator: formulaSlot("numerator", true, ids()),
      denominator: formulaSlot("denominator", true, ids()),
    }),
  },
  {
    id: "power",
    title: "توان",
    category: "power",
    preview: "xⁿ",
    hint: "پایه · نما",
    keywords: ["power", "script", "توان", "نما", "زیرنویس"],
    create: (ids = createFormulaNodeId) => ({
      id: ids(),
      kind: "script",
      base: formulaSlot("base", true, ids()),
      superscript: formulaSlot("superscript", true, ids()),
    }),
  },
  {
    id: "root",
    title: "ریشه",
    category: "power",
    preview: "ⁿ√x",
    hint: "درجه · عبارت",
    keywords: ["root", "sqrt", "radical", "ریشه", "رادیکال", "درجه"],
    create: (ids = createFormulaNodeId) => ({
      id: ids(),
      kind: "radical",
      index: formulaSlot("index", false, ids()),
      radicand: formulaSlot("radicand", true, ids()),
    }),
  },
  {
    id: "function",
    title: "تابع",
    category: "algebra",
    preview: "sin(x)",
    hint: "مثلثاتی · لگاریتمی",
    keywords: ["function", "sin", "cos", "log", "ln", "تابع", "مثلثاتی", "لگاریتم"],
    create: (ids = createFormulaNodeId) => createFormulaFunction("sin", 1, false, ids),
  },
  {
    id: "fence",
    title: "پرانتز و حصار",
    category: "algebra",
    preview: "(x)",
    hint: "پرانتز · قدرمطلق",
    keywords: ["fence", "parentheses", "absolute", "پرانتز", "حصار", "قدرمطلق"],
    create: (ids = createFormulaNodeId) => ({
      id: ids(),
      kind: "fence",
      open: "(",
      body: formulaSlot("fenced-expression", true, ids()),
      close: ")",
    }),
  },
  {
    id: "cases",
    title: "چندضابطه‌ای",
    category: "algebra",
    preview: "{ f(x)",
    hint: "مقدار · شرط",
    keywords: ["cases", "piecewise", "case", "چند ضابطه", "شرط", "تابع تکه‌ای"],
    create: (ids = createFormulaNodeId) => ({
      id: ids(),
      kind: "cases",
      rows: Array.from({ length: 2 }, (_, index) => ({
        id: ids(),
        value: formulaSlot(`case-value-${index + 1}`, true, ids()),
        condition: formulaSlot(`case-condition-${index + 1}`, true, ids()),
      })),
    }),
  },
  {
    id: "accent",
    title: "نشانهٔ بالا",
    category: "algebra",
    preview: "x̂",
    hint: "بردار · میانگین",
    keywords: ["accent", "hat", "bar", "vector", "اکسنت", "بردار", "میانگین"],
    create: (ids = createFormulaNodeId) => ({
      id: ids(),
      kind: "accent",
      accent: "hat",
      body: formulaSlot("accented-expression", true, ids()),
    }),
  },
  {
    id: "binomial",
    title: "دوجمله‌ای",
    category: "algebra",
    preview: "(ⁿₖ)",
    hint: "بالا · پایین",
    keywords: ["binomial", "choose", "combination", "دوجمله‌ای", "ترکیب", "انتخاب"],
    create: (ids = createFormulaNodeId) => ({
      id: ids(),
      kind: "binomial",
      upper: formulaSlot("binomial-upper", true, ids()),
      lower: formulaSlot("binomial-lower", true, ids()),
    }),
  },
  {
    id: "integral",
    title: "انتگرال",
    category: "calculus",
    preview: "∫₀¹f dx",
    hint: "کران · عبارت · متغیر",
    keywords: ["integral", "calculus", "انتگرال", "حسابان", "کران"],
    create: (ids = createFormulaNodeId) => createFormulaLargeOperator("integral", ids),
  },
  {
    id: "double-integral",
    title: "انتگرال دوگانه",
    category: "calculus",
    preview: "∬ f dA",
    hint: "ناحیه · عبارت",
    keywords: ["double integral", "surface", "انتگرال دوگانه", "سطح"],
    create: (ids = createFormulaNodeId) => createFormulaLargeOperator("double-integral", ids),
  },
  {
    id: "triple-integral",
    title: "انتگرال سه‌گانه",
    category: "calculus",
    preview: "∭ f dV",
    hint: "حجم · عبارت",
    keywords: ["triple integral", "volume", "انتگرال سه گانه", "حجم"],
    create: (ids = createFormulaNodeId) => createFormulaLargeOperator("triple-integral", ids),
  },
  {
    id: "contour-integral",
    title: "انتگرال مسیر بسته",
    category: "calculus",
    preview: "∮ f dz",
    hint: "مسیر · عبارت",
    keywords: ["contour integral", "closed path", "انتگرال مسیر", "کانتور"],
    create: (ids = createFormulaNodeId) => createFormulaLargeOperator("contour-integral", ids),
  },
  {
    id: "derivative",
    title: "مشتق",
    category: "calculus",
    preview: "dⁿf⁄dxⁿ",
    hint: "مرتبه · متغیر",
    keywords: ["derivative", "partial", "مشتق", "دیفرانسیل", "مرتبه"],
    create: (ids = createFormulaNodeId) => createFormulaLargeOperator("derivative", ids),
  },
  {
    id: "partial-derivative",
    title: "مشتق جزئی",
    category: "calculus",
    preview: "∂ⁿf⁄∂xⁿ",
    hint: "مرتبه · متغیر",
    keywords: ["partial derivative", "partial", "مشتق جزئی", "مشتق جزیی"],
    create: (ids = createFormulaNodeId) => createFormulaLargeOperator("partial-derivative", ids),
  },
  {
    id: "sum",
    title: "مجموع",
    category: "calculus",
    preview: "Σᵢⁿ aᵢ",
    hint: "کران پایین · بالا",
    keywords: ["sum", "sigma", "مجموع", "سیگما"],
    create: (ids = createFormulaNodeId) => createFormulaLargeOperator("sum", ids),
  },
  {
    id: "product",
    title: "حاصل‌ضرب",
    category: "calculus",
    preview: "Πᵢⁿ aᵢ",
    hint: "کران پایین · بالا",
    keywords: ["product", "pi", "حاصل ضرب", "ضرب"],
    create: (ids = createFormulaNodeId) => createFormulaLargeOperator("product", ids),
  },
  {
    id: "limit",
    title: "حد",
    category: "calculus",
    preview: "limₓ→₀ f",
    hint: "شرط نزدیک‌شدن",
    keywords: ["limit", "approach", "حد", "میل", "نزدیک"],
    create: (ids = createFormulaNodeId) => createFormulaLargeOperator("limit", ids),
  },
  {
    id: "matrix",
    title: "ماتریس",
    category: "matrix",
    preview: "[aᵢⱼ]",
    hint: "ردیف · ستون",
    keywords: ["matrix", "ماتریس", "جدول", "آرایه"],
    create: (ids = createFormulaNodeId) => createFormulaMatrix(2, 2, "brackets", ids),
  },
  {
    id: "symbols",
    title: "نمادها",
    category: "symbols",
    preview: "α β ∞",
    hint: "جست‌وجو",
    keywords: ["symbols", "alpha", "beta", "infinity", "نماد", "آلفا", "بتا", "بی‌نهایت"],
    create: (ids = createFormulaNodeId) => formulaRow([
      formulaAtom("\\alpha", "symbol", ids(), false),
      formulaAtom("+", "symbol", ids(), false),
      formulaAtom("\\beta", "symbol", ids(), false),
      formulaAtom("=", "symbol", ids(), false),
      formulaAtom("\\infty", "symbol", ids(), false),
    ], ids()),
  },
];

export function filterFormulaStructures(
  query: string,
  category?: FormulaStudioCategory,
) {
  const normalized = normalizeFormulaSearch(query);
  return FORMULA_STRUCTURES.filter((structure) => {
    if (category && structure.category !== category) return false;
    if (!normalized) return true;
    return normalizeFormulaSearch([
      structure.title,
      structure.id,
      structure.preview,
      structure.hint,
      ...structure.keywords,
    ].join(" ")).includes(normalized);
  });
}

export function createFormulaStructure(
  structureId: FormulaStructureId,
  idFactory: FormulaNodeFactory = createFormulaNodeId,
) {
  const definition = FORMULA_STRUCTURES.find((item) => item.id === structureId);
  if (!definition) throw new Error(`Unknown formula structure: ${structureId}`);
  return definition.create(idFactory);
}
