import { normalizeFormulaSearch } from "./model";

export type FormulaSymbolGroup = "greek" | "operators" | "relations" | "sets" | "arrows";

export type FormulaSymbolDefinition = {
  id: string;
  latex: string;
  glyph: string;
  label: string;
  english: string;
  group: FormulaSymbolGroup;
  keywords: string[];
};

export const FORMULA_SYMBOL_GROUPS: Array<[FormulaSymbolGroup, string]> = [
  ["greek", "یونانی"],
  ["operators", "عملگرها"],
  ["relations", "روابط"],
  ["sets", "مجموعه‌ها"],
  ["arrows", "پیکان‌ها"],
];

export const FORMULA_SYMBOLS: FormulaSymbolDefinition[] = [
  { id: "alpha", latex: "\\alpha", glyph: "α", label: "آلفا", english: "alpha", group: "greek", keywords: ["الفا"] },
  { id: "beta", latex: "\\beta", glyph: "β", label: "بتا", english: "beta", group: "greek", keywords: [] },
  { id: "gamma", latex: "\\gamma", glyph: "γ", label: "گاما", english: "gamma", group: "greek", keywords: [] },
  { id: "delta", latex: "\\delta", glyph: "δ", label: "دلتا", english: "delta", group: "greek", keywords: [] },
  { id: "epsilon", latex: "\\epsilon", glyph: "ε", label: "اپسیلون", english: "epsilon", group: "greek", keywords: [] },
  { id: "theta", latex: "\\theta", glyph: "θ", label: "تتا", english: "theta", group: "greek", keywords: [] },
  { id: "lambda", latex: "\\lambda", glyph: "λ", label: "لامبدا", english: "lambda", group: "greek", keywords: [] },
  { id: "mu", latex: "\\mu", glyph: "μ", label: "مو", english: "mu", group: "greek", keywords: [] },
  { id: "pi", latex: "\\pi", glyph: "π", label: "پی", english: "pi", group: "greek", keywords: [] },
  { id: "rho", latex: "\\rho", glyph: "ρ", label: "رو", english: "rho", group: "greek", keywords: [] },
  { id: "sigma", latex: "\\sigma", glyph: "σ", label: "سیگما", english: "sigma", group: "greek", keywords: [] },
  { id: "phi", latex: "\\phi", glyph: "φ", label: "فی", english: "phi", group: "greek", keywords: [] },
  { id: "psi", latex: "\\psi", glyph: "ψ", label: "سای", english: "psi", group: "greek", keywords: [] },
  { id: "omega", latex: "\\omega", glyph: "ω", label: "امگا", english: "omega", group: "greek", keywords: [] },
  { id: "Gamma", latex: "\\Gamma", glyph: "Γ", label: "گامای بزرگ", english: "capital gamma", group: "greek", keywords: [] },
  { id: "Delta", latex: "\\Delta", glyph: "Δ", label: "دلتای بزرگ", english: "capital delta", group: "greek", keywords: [] },
  { id: "Sigma", latex: "\\Sigma", glyph: "Σ", label: "سیگمای بزرگ", english: "capital sigma", group: "greek", keywords: [] },
  { id: "Omega", latex: "\\Omega", glyph: "Ω", label: "امگای بزرگ", english: "capital omega", group: "greek", keywords: [] },

  { id: "plus-minus", latex: "\\pm", glyph: "±", label: "مثبت منفی", english: "plus minus", group: "operators", keywords: [] },
  { id: "times", latex: "\\times", glyph: "×", label: "ضرب", english: "times", group: "operators", keywords: [] },
  { id: "divide", latex: "\\div", glyph: "÷", label: "تقسیم", english: "divide", group: "operators", keywords: [] },
  { id: "dot", latex: "\\cdot", glyph: "⋅", label: "ضرب نقطه‌ای", english: "dot product", group: "operators", keywords: [] },
  { id: "oplus", latex: "\\oplus", glyph: "⊕", label: "جمع مستقیم", english: "direct sum", group: "operators", keywords: [] },
  { id: "otimes", latex: "\\otimes", glyph: "⊗", label: "ضرب تانسوری", english: "tensor product", group: "operators", keywords: [] },
  { id: "partial", latex: "\\partial", glyph: "∂", label: "مشتق جزئی", english: "partial", group: "operators", keywords: [] },
  { id: "nabla", latex: "\\nabla", glyph: "∇", label: "نابلا", english: "nabla gradient", group: "operators", keywords: ["گرادیان"] },
  { id: "infinity", latex: "\\infty", glyph: "∞", label: "بی‌نهایت", english: "infinity", group: "operators", keywords: ["بینهایت"] },

  { id: "equal", latex: "=", glyph: "=", label: "برابر", english: "equal", group: "relations", keywords: [] },
  { id: "not-equal", latex: "\\neq", glyph: "≠", label: "نامساوی", english: "not equal", group: "relations", keywords: ["نابرابر"] },
  { id: "less-equal", latex: "\\leq", glyph: "≤", label: "کوچک‌تر مساوی", english: "less than or equal", group: "relations", keywords: [] },
  { id: "greater-equal", latex: "\\geq", glyph: "≥", label: "بزرگ‌تر مساوی", english: "greater than or equal", group: "relations", keywords: [] },
  { id: "approx", latex: "\\approx", glyph: "≈", label: "تقریباً برابر", english: "approximately", group: "relations", keywords: [] },
  { id: "equivalent", latex: "\\equiv", glyph: "≡", label: "هم‌ارز", english: "equivalent", group: "relations", keywords: [] },
  { id: "proportional", latex: "\\propto", glyph: "∝", label: "متناسب", english: "proportional", group: "relations", keywords: [] },
  { id: "perpendicular", latex: "\\perp", glyph: "⊥", label: "عمود", english: "perpendicular", group: "relations", keywords: [] },
  { id: "parallel", latex: "\\parallel", glyph: "∥", label: "موازی", english: "parallel", group: "relations", keywords: [] },

  { id: "in", latex: "\\in", glyph: "∈", label: "عضو", english: "element of", group: "sets", keywords: [] },
  { id: "not-in", latex: "\\notin", glyph: "∉", label: "عضو نیست", english: "not element of", group: "sets", keywords: [] },
  { id: "subset", latex: "\\subset", glyph: "⊂", label: "زیرمجموعه", english: "subset", group: "sets", keywords: [] },
  { id: "subset-equal", latex: "\\subseteq", glyph: "⊆", label: "زیرمجموعه یا مساوی", english: "subset or equal", group: "sets", keywords: [] },
  { id: "superset", latex: "\\supset", glyph: "⊃", label: "فرامجموعه", english: "superset", group: "sets", keywords: [] },
  { id: "union", latex: "\\cup", glyph: "∪", label: "اجتماع", english: "union", group: "sets", keywords: [] },
  { id: "intersection", latex: "\\cap", glyph: "∩", label: "اشتراک", english: "intersection", group: "sets", keywords: [] },
  { id: "empty-set", latex: "\\emptyset", glyph: "∅", label: "مجموعهٔ تهی", english: "empty set", group: "sets", keywords: [] },
  { id: "forall", latex: "\\forall", glyph: "∀", label: "برای هر", english: "for all", group: "sets", keywords: [] },
  { id: "exists", latex: "\\exists", glyph: "∃", label: "وجود دارد", english: "exists", group: "sets", keywords: [] },

  { id: "to", latex: "\\to", glyph: "→", label: "میل می‌کند", english: "to", group: "arrows", keywords: [] },
  { id: "left", latex: "\\leftarrow", glyph: "←", label: "پیکان چپ", english: "left arrow", group: "arrows", keywords: [] },
  { id: "both", latex: "\\leftrightarrow", glyph: "↔", label: "پیکان دوسویه", english: "left right arrow", group: "arrows", keywords: [] },
  { id: "implies", latex: "\\Rightarrow", glyph: "⇒", label: "نتیجه می‌دهد", english: "implies", group: "arrows", keywords: [] },
  { id: "implied-by", latex: "\\Leftarrow", glyph: "⇐", label: "نتیجه از", english: "implied by", group: "arrows", keywords: [] },
  { id: "iff", latex: "\\Leftrightarrow", glyph: "⇔", label: "اگر و تنها اگر", english: "if and only if", group: "arrows", keywords: [] },
  { id: "maps-to", latex: "\\mapsto", glyph: "↦", label: "نگاشت به", english: "maps to", group: "arrows", keywords: [] },
  { id: "up", latex: "\\uparrow", glyph: "↑", label: "پیکان بالا", english: "up arrow", group: "arrows", keywords: [] },
  { id: "down", latex: "\\downarrow", glyph: "↓", label: "پیکان پایین", english: "down arrow", group: "arrows", keywords: [] },
];

export function filterFormulaSymbols(
  query: string,
  group: FormulaSymbolGroup | "all" = "all",
) {
  const normalized = normalizeFormulaSearch(query);
  return FORMULA_SYMBOLS.filter((symbol) => {
    if (group !== "all" && symbol.group !== group) return false;
    if (!normalized) return true;
    return normalizeFormulaSearch([
      symbol.id,
      symbol.latex,
      symbol.glyph,
      symbol.label,
      symbol.english,
      ...symbol.keywords,
    ].join(" ")).includes(normalized);
  });
}

export function formulaSymbolsFromRecent(ids: string[]) {
  const order = new Map(ids.map((id, index) => [id, index]));
  return FORMULA_SYMBOLS
    .filter((symbol) => order.has(symbol.id))
    .sort((left, right) => order.get(left.id)! - order.get(right.id)!);
}
