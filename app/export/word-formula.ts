import { Math as WordMath, MathRun, MathFraction, MathRadical, MathSubScript, MathSuperScript,
  MathSubSuperScript, MathRoundBrackets, MathSquareBrackets, MathCurlyBrackets,
  MathFunction, XmlComponent, XmlAttributeComponent, type MathComponent } from "docx";
import { parseLatexExpression } from "../formula/latex";
import type { FormulaExpressionNode } from "../formula/expression-tree";

const symbols: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ", lambda: "λ",
  mu: "μ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Pi: "Π", Sigma: "Σ", Omega: "Ω",
  times: "×", cdot: "·", pm: "±", mp: "∓", div: "÷", le: "≤", leq: "≤", ge: "≥", geq: "≥",
  ne: "≠", neq: "≠", approx: "≈", infty: "∞", partial: "∂", nabla: "∇", in: "∈",
  notin: "∉", to: "→", rightarrow: "→", leftarrow: "←", forall: "∀", exists: "∃",
  ell: "ℓ", hbar: "ℏ", ldots: "…", cdots: "⋯", percent: "%",
  varepsilon: "ϵ", zeta: "ζ", eta: "η", vartheta: "ϑ", iota: "ι", kappa: "κ", nu: "ν", xi: "ξ", varpi: "ϖ", varrho: "ϱ", varsigma: "ς", upsilon: "υ", varphi: "ϕ", chi: "χ", psi: "ψ",
  Xi: "Ξ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", imath: "ı", jmath: "ȷ",
  ast: "∗", star: "⋆", circ: "∘", bullet: "∙", oplus: "⊕", otimes: "⊗", odot: "⊙", sim: "∼", simeq: "≃", equiv: "≡", propto: "∝", cong: "≅",
  ni: "∋", subset: "⊂", subseteq: "⊆", supset: "⊃", supseteq: "⊇", cup: "∪", cap: "∩", setminus: "∖", emptyset: "∅", varnothing: "∅",
  nexists: "∄", neg: "¬", land: "∧", lor: "∨", therefore: "∴", because: "∵", leftrightarrow: "↔", Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔", mapsto: "↦", uparrow: "↑", downarrow: "↓",
  angle: "∠", triangle: "△", perp: "⊥", parallel: "∥", degree: "°", prime: "′",
  lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉", langle: "⟨", rangle: "⟩", lvert: "|", rvert: "|", lVert: "‖", rVert: "‖",
  quad: "　", qquad: "　　",
};

function atom(value: string) {
  return value.replace(/\\([A-Za-z]+|.)/gu, (_, name: string) => {
    if (symbols[name]) return symbols[name];
    if (["sin", "cos", "tan", "log", "ln", "exp", "lim", "max", "min"].includes(name)) return name;
    if ([",", ";", ":", " ", "!"].includes(name)) return " ";
    if (["{", "}", "%", "_"].includes(name)) return name;
    throw new Error("UNSUPPORTED_WORD_FORMULA");
  });
}

// Native OMML structures that docx does not expose as high-level builders.
// Values pass through the library's XML serializer, never through raw XML interpolation.
class MathValue extends XmlAttributeComponent<{ value: string }> {
  protected readonly xmlKeys = { value: "m:val" };
}
class Omml extends XmlComponent {
  constructor(name: string, children: XmlComponent[] = [], value?: string) {
    super(`m:${name}`);
    if (value !== undefined) this.root.push(new MathValue({ value }));
    this.root.push(...children);
  }
}
const element = (name: string, children: MathComponent[]) => new Omml(name, children);
const property = (name: string, value: string) => new Omml(name, [], value);
function delimiter(children: MathComponent[], open: string, close: string) {
  return new Omml("d", [new Omml("dPr", [property("begChr", open), property("endChr", close)]), element("e", children)]);
}
function matrix(rows: MathComponent[][][]) {
  return new Omml("m", rows.map(row => new Omml("mr", row.map(cell => element("e", cell)))));
}

function convert(node: FormulaExpressionNode): MathComponent[] {
  switch (node.kind) {
    case "slot":
      if (!node.required) return [];
      throw new Error("UNSUPPORTED_WORD_FORMULA");
    case "atom": return [new MathRun(atom(node.value))];
    case "row": return node.children.flatMap(convert);
    case "fraction": return [new MathFraction({ numerator: convert(node.numerator), denominator: convert(node.denominator) })];
    case "radical": return [new MathRadical({ children: convert(node.radicand), degree: node.index ? convert(node.index) : undefined })];
    case "script": {
      const children = convert(node.base);
      if (node.subscript && node.superscript) return [new MathSubSuperScript({ children, subScript: convert(node.subscript), superScript: convert(node.superscript) })];
      if (node.subscript) return [new MathSubScript({ children, subScript: convert(node.subscript) })];
      if (node.superscript) return [new MathSuperScript({ children, superScript: convert(node.superscript) })];
      return children;
    }
    case "fence": {
      const children = convert(node.body);
      if (node.open === "(" && node.close === ")") return [new MathRoundBrackets({ children })];
      if (node.open === "[" && node.close === "]") return [new MathSquareBrackets({ children })];
      if (node.open === "{" && node.close === "}") return [new MathCurlyBrackets({ children })];
      return [delimiter(children, node.open === "." ? "" : atom(node.open), node.close === "." ? "" : atom(node.close))];
    }
    case "function": {
      const name = [new MathRun(atom(node.name))];
      const argumentsWithSeparators = node.arguments.flatMap((argument, index) => [...(index ? [new MathRun(",")] : []), ...convert(argument)]);
      return [new MathFunction({ name: node.subscript ? [new MathSubScript({ children: name, subScript: convert(node.subscript) })] : name, children: node.arguments.length ? [new MathRoundBrackets({ children: argumentsWithSeparators })] : [] })];
    }
    case "large-operator": {
      const body = convert(node.body);
      const lower = node.lower ? convert(node.lower) : [], upper = node.upper ? convert(node.upper) : [];
      if (node.operator === "derivative" || node.operator === "partial-derivative") {
        if (!node.variable) throw new Error("UNSUPPORTED_WORD_FORMULA");
        const marker = [new MathRun(node.operator === "derivative" ? "d" : "∂")];
        const variable = convert(node.variable);
        return [new MathFraction({ numerator: [...(node.order ? [new MathSuperScript({ children: marker, superScript: convert(node.order) })] : marker), ...body], denominator: [...marker, ...(node.order ? [new MathSuperScript({ children: variable, superScript: convert(node.order) })] : variable)] })];
      }
      if (node.operator === "limit") {
        // Superscripted limits are outside the supported corpus. Preserve
        // their exact source through the warning fallback, never drop a bound.
        if (node.upper) throw new Error("UNSUPPORTED_WORD_FORMULA");
        return [new Omml("limLow", [element("e", [new MathRun("lim")]), element("lim", lower)]), ...body];
      }
      const glyph = { sum: "∑", product: "∏", integral: "∫", "double-integral": "∬", "triple-integral": "∭", "contour-integral": "∮" }[node.operator];
      const integral = node.operator.includes("integral");
      return [new Omml("nary", [new Omml("naryPr", [property("chr", glyph), property("limLoc", integral ? "subSup" : "undOvr"), property("subHide", lower.length ? "0" : "1"), property("supHide", upper.length ? "0" : "1")]), element("sub", lower), element("sup", upper), element("e", [...body, ...(node.differential ? [new MathRun(" d"), ...convert(node.differential)] : [])])])];
    }
    case "matrix": {
      const rows = Array.from({ length: node.rows }, (_, row) => node.cells.slice(row * node.columns, (row + 1) * node.columns).map(convert));
      const content = matrix(rows);
      const pair = { none: ["", ""], parentheses: ["(", ")"], brackets: ["[", "]"], braces: ["{", "}"], bars: ["|", "|"], "double-bars": ["‖", "‖"] }[node.delimiter];
      return node.delimiter === "none" ? [content] : [delimiter([content], pair[0], pair[1])];
    }
    case "cases": return [delimiter([matrix(node.rows.map(row => [convert(row.value), convert(row.condition)]))], "{", "")];
    case "accent": {
      if (node.accent === "overline" || node.accent === "underline") return [new Omml("bar", [new Omml("barPr", [property("pos", node.accent === "underline" ? "bot" : "top")]), element("e", convert(node.body))])];
      const glyph = { hat: "̂", bar: "̅", vector: "⃗", dot: "̇", "double-dot": "̈", tilde: "̃" }[node.accent];
      return [new Omml("acc", [new Omml("accPr", [property("chr", glyph)]), element("e", convert(node.body))])];
    }
    case "binomial": return [delimiter([new Omml("f", [new Omml("fPr", [property("type", "noBar")]), element("num", convert(node.upper)), element("den", convert(node.lower))])], "(", ")")];
    default: throw new Error("UNSUPPORTED_WORD_FORMULA");
  }
}

/** Only structurally supported equations become OMML; others retain their exact source with a warning. */
export function createWordFormula(latex: string) {
  return new WordMath({ children: convert(parseLatexExpression(latex)) });
}
