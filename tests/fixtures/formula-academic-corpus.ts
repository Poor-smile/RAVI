export type AcademicFormulaCase = {
  id: string;
  category: "algebra" | "functions" | "calculus" | "matrix" | "cases" | "notation";
  latex: string;
};

const algebra = [
  "x+1",
  "x^{2}+1",
  "a_{1}+a_{2}",
  "x_{i}^{2}",
  "\\frac{x}{y}",
  "\\frac{x+1}{y-1}",
  "\\frac{\\frac{a}{b}}{c}",
  "\\sqrt{x}",
  "\\sqrt[3]{x+1}",
  "\\sqrt{\\frac{x}{y}}",
  "\\left(x+1\\right)",
  "\\left[x^{2}+1\\right]",
  "\\left\\{a+b\\right\\}",
  "\\left|x-1\\right|",
  "\\left\\lVert x\\right\\rVert",
  "\\left\\langle x,y\\right\\rangle",
  "\\left\\lfloor x\\right\\rfloor",
  "\\left\\lceil x\\right\\rceil",
  "\\binom{n}{k}",
  "\\frac{-b+\\sqrt{b^{2}-4ac}}{2a}",
];

const functionNames = [
  "sin", "cos", "tan", "cot", "sec", "csc",
  "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh",
  "log", "ln", "exp", "min", "max", "det",
];

const functions = [
  ...functionNames.map((name) => `\\${name}\\left(x\\right)`),
  "\\log_{2}\\left(x\\right)",
  "\\log_{10}\\left(x+1\\right)",
  "\\min\\left(x,y\\right)",
  "\\max\\left(a,b,c\\right)",
  "\\det\\left(A\\right)",
  "\\sin\\left(x^{2}\\right)",
  "\\cos\\left(\\frac{x}{2}\\right)",
  "\\exp\\left(-x^{2}\\right)",
  "\\ln\\left(\\sqrt{x}\\right)",
  "\\sin\\left(\\binom{n}{k}\\right)",
];

const calculus = [
  "\\int_{0}^{1}{x}\\,\\mathrm{d}{x}",
  "\\int_{a}^{b}{f}\\,\\mathrm{d}{x}",
  "\\int{}{x^{2}}\\,\\mathrm{d}{x}",
  "\\iint_{0}^{1}{f}\\,\\mathrm{d}{A}",
  "\\iiint_{0}^{1}{f}\\,\\mathrm{d}{V}",
  "\\oint_{0}^{1}{f}\\,\\mathrm{d}{z}",
  "\\sum_{i=1}^{n}{i}",
  "\\sum_{k=0}^{n}{k^{2}}",
  "\\sum_{i=1}^{n}{\\frac{1}{i}}",
  "\\prod_{i=1}^{n}{i}",
  "\\prod_{k=0}^{n}{x_{k}}",
  "\\lim_{x\\to0}{x}",
  "\\lim_{n\\to\\infty}{\\frac{1}{n}}",
  "\\frac{\\mathrm{d}{f}}{\\mathrm{d}{x}}",
  "\\frac{\\mathrm{d}^{2}{f}}{\\mathrm{d}{x}^{2}}",
  "\\frac{\\partial{f}}{\\partial{x}}",
  "\\frac{\\partial^{2}{f}}{\\partial{x}^{2}}",
  "\\int_{0}^{\\infty}{\\exp\\left(-x\\right)}\\,\\mathrm{d}{x}",
  "\\sum_{i=1}^{n}{\\binom{n}{i}}",
  "\\int_{-1}^{1}{\\sqrt{1-x^{2}}}\\,\\mathrm{d}{x}",
];

const matrix = [
  "\\begin{matrix}1 & 2 \\\\ 3 & 4\\end{matrix}",
  "\\begin{pmatrix}a & b \\\\ c & d\\end{pmatrix}",
  "\\begin{bmatrix}1 & 0 \\\\ 0 & 1\\end{bmatrix}",
  "\\begin{Bmatrix}x & y \\\\ z & w\\end{Bmatrix}",
  "\\begin{vmatrix}a & b \\\\ c & d\\end{vmatrix}",
  "\\begin{Vmatrix}x & 0 \\\\ 0 & y\\end{Vmatrix}",
  "\\begin{bmatrix}1 & 2 & 3\\end{bmatrix}",
  "\\begin{bmatrix}1 \\\\ 2 \\\\ 3\\end{bmatrix}",
  "\\begin{pmatrix}a & b & c \\\\ d & e & f \\\\ g & h & i\\end{pmatrix}",
  "\\begin{matrix}x^{2} & \\frac{1}{y} \\\\ \\sqrt{z} & 0\\end{matrix}",
  "\\begin{bmatrix}\\alpha & \\beta \\\\ \\gamma & \\delta\\end{bmatrix}",
  "\\begin{vmatrix}1 & x \\\\ x & 1\\end{vmatrix}",
];

const cases = [
  "\\begin{cases}x & x>0 \\\\ -x & x<0\\end{cases}",
  "\\begin{cases}1 & x>0 \\\\ 0 & x=0 \\\\ -1 & x<0\\end{cases}",
  "\\begin{cases}x^{2} & x\\geq0 \\\\ -x & x<0\\end{cases}",
  "\\begin{cases}\\sin\\left(x\\right) & x>0 \\\\ 0 & x=0\\end{cases}",
  "\\begin{cases}\\frac{x}{2} & x>1 \\\\ x+1 & x\\leq1\\end{cases}",
  "\\begin{cases}a & n=1 \\\\ b & n=2 \\\\ c & n=3\\end{cases}",
  "\\begin{cases}\\sqrt{x} & x\\geq0 \\\\ 0 & x<0\\end{cases}",
  "\\begin{cases}\\binom{n}{k} & k\\leq n \\\\ 0 & k>n\\end{cases}",
];

const notation = [
  "\\hat{x}",
  "\\bar{x}",
  "\\vec{x}",
  "\\dot{x}",
  "\\ddot{x}",
  "\\tilde{x}",
  "\\overline{AB}",
  "\\underline{x+1}",
  "\\alpha+\\beta=\\gamma",
  "x\\in A",
  "A\\subseteq B",
  "A\\cup B",
  "A\\cap B",
  "x\\neq y",
  "x\\leq y",
  "x\\geq y",
  "x\\to\\infty",
  "A\\Rightarrow B",
  "A\\Leftrightarrow B",
  "\\forall x\\in A",
];

function asCases(
  category: AcademicFormulaCase["category"],
  sources: string[],
): AcademicFormulaCase[] {
  return sources.map((latex, index) => ({
    id: `${category}-${String(index + 1).padStart(3, "0")}`,
    category,
    latex,
  }));
}

export const FORMULA_ACADEMIC_CORPUS: AcademicFormulaCase[] = [
  ...asCases("algebra", algebra),
  ...asCases("functions", functions),
  ...asCases("calculus", calculus),
  ...asCases("matrix", matrix),
  ...asCases("cases", cases),
  ...asCases("notation", notation),
];
