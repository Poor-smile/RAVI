export type FormulaCategory = "base" | "power" | "calculus" | "matrix" | "symbols";
export type FormulaTemplateId =
  | "fraction"
  | "power"
  | "root"
  | "integral"
  | "matrix"
  | "symbols";

export type FormulaTemplate = {
  id: FormulaTemplateId;
  title: string;
  category: FormulaCategory;
  slotCount: number;
  keywords: string[];
};

export const FORMULA_TEMPLATES: FormulaTemplate[] = [
  { id: "fraction", title: "کسر", category: "base", slotCount: 2, keywords: ["fraction", "کسر", "صورت", "مخرج"] },
  { id: "power", title: "توان", category: "power", slotCount: 2, keywords: ["power", "توان", "exponent"] },
  { id: "root", title: "ریشه", category: "power", slotCount: 1, keywords: ["root", "sqrt", "ریشه", "رادیکال"] },
  { id: "integral", title: "انتگرال", category: "calculus", slotCount: 2, keywords: ["integral", "calculus", "انتگرال", "حسابان"] },
  { id: "matrix", title: "ماتریس", category: "matrix", slotCount: 4, keywords: ["matrix", "ماتریس", "جدول"] },
  { id: "symbols", title: "نمادها", category: "symbols", slotCount: 0, keywords: ["symbol", "alpha", "beta", "infinity", "نماد", "آلفا", "بتا", "بی نهایت"] },
];

export function normalizeFormulaSearch(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("fa")
    .replace(/[يى]/gu, "ی")
    .replace(/ك/gu, "ک")
    .replace(/[\u064B-\u065F\u0670]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

export function filterFormulaTemplates(
  query: string,
  category?: FormulaCategory,
) {
  const normalized = normalizeFormulaSearch(query);
  return FORMULA_TEMPLATES.filter((template) => {
    if (category && template.category !== category) return false;
    if (!normalized) return true;
    return normalizeFormulaSearch(
      [template.title, template.id, ...template.keywords].join(" "),
    ).includes(normalized);
  });
}

export function smartFormulaInput(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[×✕]/gu, "\\times ")
    .replace(/÷/gu, "\\div ")
    .replace(/√\s*\(([^()]*)\)/gu, "\\sqrt{$1}")
    .replace(/\bsqrt\s*\(([^()]*)\)/giu, "\\sqrt{$1}")
    .replace(/([\p{L}\p{N})])\^?([0-9])\b/gu, "$1^{$2}")
    .replace(/∞/gu, "\\infty ")
    .trim();
}

function slot(value: string | undefined) {
  return smartFormulaInput(value ?? "");
}

export function formulaLatexFromTemplate(
  template: FormulaTemplateId,
  slots: string[],
) {
  switch (template) {
    case "fraction":
      return `\\frac{${slot(slots[0])}}{${slot(slots[1])}}`;
    case "power":
      return `{${slot(slots[0])}}^{${slot(slots[1])}}`;
    case "root":
      return `\\sqrt{${slot(slots[0])}}`;
    case "integral":
      return `\\int_{0}^{1} \\frac{x^{2} + ${slot(slots[0])}}{\\sqrt{x}}\\,dx = ${slot(slots[1])}`;
    case "matrix":
      return `\\begin{bmatrix}${slot(slots[0])} & ${slot(slots[1])} \\\\ ${slot(slots[2])} & ${slot(slots[3])}\\end{bmatrix}`;
    case "symbols":
      return "\\alpha + \\beta = \\infty";
  }
}

export function templateIsComplete(
  template: FormulaTemplateId | null,
  slots: string[],
) {
  if (!template) return false;
  const definition = FORMULA_TEMPLATES.find((item) => item.id === template);
  return Boolean(
    definition &&
      (definition.slotCount === 0 ||
        slots.slice(0, definition.slotCount).every((value) => value.trim().length > 0)),
  );
}

export function formulaAccessibleText(latex: string) {
  return latex
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/gu, "$1 تقسیم بر $2")
    .replace(/\\sqrt\{([^{}]*)\}/gu, "ریشهٔ $1")
    .replace(/\\int/gu, "انتگرال")
    .replace(/\\(?:alpha|beta|infty)/gu, (token) => ({
      "\\alpha": "آلفا",
      "\\beta": "بتا",
      "\\infty": "بی‌نهایت",
    })[token] ?? token)
    .replace(/[{}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}
