import katex from "katex";
import {
  createFormulaNodeId,
  formulaAtom,
  formulaRow,
  formulaSlot,
  type FormulaAccent,
  type FormulaExpressionNode,
  type FormulaFunctionNode,
  type FormulaLargeOperator,
  type FormulaLargeOperatorNode,
  type FormulaMatrixDelimiter,
  type FormulaNodeFactory,
} from "./expression-tree";

export type FormulaValidationStatus = "valid" | "incomplete" | "invalid" | "unsupported";

export type FormulaSourceLocation = {
  index: number;
  line: number;
  column: number;
  length: number;
};

export type FormulaLatexValidation = {
  status: FormulaValidationStatus;
  source: string;
  tree?: FormulaExpressionNode;
  normalizedLatex?: string;
  message?: string;
  location?: FormulaSourceLocation;
  preserveRaw: boolean;
};

export type FormulaTreeValidation = {
  status: "valid" | "incomplete" | "invalid";
  message?: string;
  nodeId?: string;
};

const DELIMITER_LATEX: Record<FormulaMatrixDelimiter, [string, string]> = {
  none: ["", ""],
  parentheses: ["(", ")"],
  brackets: ["[", "]"],
  braces: ["\\{", "\\}"],
  bars: ["|", "|"],
  "double-bars": ["\\lVert", "\\rVert"],
};

const MATRIX_ENVIRONMENT: Record<FormulaMatrixDelimiter, string> = {
  none: "matrix",
  parentheses: "pmatrix",
  brackets: "bmatrix",
  braces: "Bmatrix",
  bars: "vmatrix",
  "double-bars": "Vmatrix",
};

const ENVIRONMENT_DELIMITER: Record<string, FormulaMatrixDelimiter> = {
  matrix: "none",
  pmatrix: "parentheses",
  bmatrix: "brackets",
  Bmatrix: "braces",
  vmatrix: "bars",
  Vmatrix: "double-bars",
};

const ACCENT_COMMAND: Record<FormulaAccent, string> = {
  hat: "hat",
  bar: "bar",
  vector: "vec",
  dot: "dot",
  "double-dot": "ddot",
  tilde: "tilde",
  overline: "overline",
  underline: "underline",
};

const COMMAND_ACCENT = new Map(
  Object.entries(ACCENT_COMMAND).map(([accent, command]) => [command, accent as FormulaAccent]),
);

const LARGE_OPERATOR_COMMAND: Partial<Record<FormulaLargeOperator, string>> = {
  sum: "sum",
  product: "prod",
  limit: "lim",
  integral: "int",
  "double-integral": "iint",
  "triple-integral": "iiint",
  "contour-integral": "oint",
};

const COMMAND_LARGE_OPERATOR = new Map(
  Object.entries(LARGE_OPERATOR_COMMAND).map(([operator, command]) => [command, operator as FormulaLargeOperator]),
);

const FUNCTION_COMMANDS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan",
  "sinh", "cosh", "tanh", "log", "ln", "exp", "min", "max", "gcd", "det",
]);

const SPACING_COMMANDS = new Set([",", ";", ":", "!", "quad", "qquad", " "]);

const VISUAL_ATOM_COMMANDS = new Set([
  "partial", "nabla", "infty", "ell", "hbar", "imath", "jmath",
  "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta", "theta", "vartheta", "iota", "kappa", "lambda", "mu", "nu", "xi", "pi", "varpi", "rho", "varrho", "sigma", "varsigma", "tau", "upsilon", "phi", "varphi", "chi", "psi", "omega",
  "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Upsilon", "Phi", "Psi", "Omega",
  "pm", "mp", "times", "div", "cdot", "ast", "star", "circ", "bullet", "oplus", "otimes", "odot",
  "le", "leq", "ge", "geq", "ne", "neq", "approx", "sim", "simeq", "equiv", "propto", "cong",
  "in", "notin", "ni", "subset", "subseteq", "supset", "supseteq", "cup", "cap", "setminus", "emptyset", "varnothing",
  "forall", "exists", "nexists", "neg", "land", "lor", "therefore", "because",
  "to", "rightarrow", "leftarrow", "leftrightarrow", "Rightarrow", "Leftarrow", "Leftrightarrow", "mapsto", "uparrow", "downarrow",
  "angle", "triangle", "perp", "parallel", "degree", "prime",
]);

// This list is deliberately finite. Advanced input may use the academic KaTeX
// vocabulary below, but executable, URL and macro-definition commands never
// enter either the visual tree or the renderer.
const SAFE_LATEX_COMMANDS = new Set([
  "frac", "dfrac", "tfrac", "sqrt", "left", "right", "middle",
  "begin", "end", "text", "mathrm", "mathbf", "mathit", "mathsf", "mathtt",
  "operatorname", "overline", "underline", "hat", "widehat", "bar", "vec", "dot", "ddot", "tilde", "widetilde",
  "sum", "prod", "coprod", "lim", "limsup", "liminf", "int", "iint", "iiint", "oint",
  "partial", "nabla", "infty", "ell", "hbar", "imath", "jmath",
  "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta", "theta", "vartheta", "iota", "kappa", "lambda", "mu", "nu", "xi", "pi", "varpi", "rho", "varrho", "sigma", "varsigma", "tau", "upsilon", "phi", "varphi", "chi", "psi", "omega",
  "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Upsilon", "Phi", "Psi", "Omega",
  "pm", "mp", "times", "div", "cdot", "ast", "star", "circ", "bullet", "oplus", "otimes", "odot",
  "le", "leq", "ge", "geq", "ne", "neq", "approx", "sim", "simeq", "equiv", "propto", "cong",
  "in", "notin", "ni", "subset", "subseteq", "supset", "supseteq", "cup", "cap", "setminus", "emptyset", "varnothing",
  "forall", "exists", "nexists", "neg", "land", "lor", "therefore", "because",
  "to", "rightarrow", "leftarrow", "leftrightarrow", "Rightarrow", "Leftarrow", "Leftrightarrow", "mapsto", "uparrow", "downarrow",
  "angle", "triangle", "perp", "parallel", "degree", "prime",
  "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "log", "ln", "exp", "min", "max", "gcd", "det",
  "lfloor", "rfloor", "lceil", "rceil", "langle", "rangle", "lvert", "rvert", "lVert", "rVert",
  "overbrace", "underbrace", "binom", "dbinom", "tbinom", "cases", "color", "cancel",
  "quad", "qquad", "phantom", "mathbb", "mathcal", "mathfrak",
]);

const FORBIDDEN_LATEX_COMMANDS = new Set([
  "href", "url", "includegraphics", "htmlClass", "htmlId", "htmlStyle", "htmlData",
  "def", "gdef", "edef", "xdef", "newcommand", "renewcommand", "providecommand",
  "input", "include", "require", "write", "openout", "read", "csname", "catcode",
]);

function escapeText(value: string) {
  return value.replace(/([{}%#$&_])/gu, "\\$1");
}

function serializeAtom(node: Extract<FormulaExpressionNode, { kind: "atom" }>) {
  if (node.atomKind === "text") return `\\text{${escapeText(node.value)}}`;
  if (node.atomKind === "symbol" && node.value.startsWith("\\")) return node.value;
  return escapeText(node.value);
}

export function serializeFormulaToLatex(
  node: FormulaExpressionNode,
  options: { allowPlaceholders?: boolean } = {},
): string {
  const serialize = (child: FormulaExpressionNode) => serializeFormulaToLatex(child, options);
  switch (node.kind) {
    case "slot":
      if (!node.required) return "";
      if (options.allowPlaceholders) return "\\square";
      throw new Error(`Formula slot '${node.name}' is incomplete.`);
    case "atom":
      return serializeAtom(node);
    case "row": {
      let source = "";
      for (const child of node.children) {
        const next = serialize(child);
        if (/\\[A-Za-z]+$/u.test(source) && /^\p{L}/u.test(next)) source += " ";
        source += next;
      }
      return source;
    }
    case "fraction":
      return `\\frac{${serialize(node.numerator)}}{${serialize(node.denominator)}}`;
    case "script":
      return `${serialize(node.base)}${node.subscript ? `_{${serialize(node.subscript)}}` : ""}${node.superscript ? `^{${serialize(node.superscript)}}` : ""}`;
    case "radical":
      return `\\sqrt${node.index ? `[${serialize(node.index)}]` : ""}{${serialize(node.radicand)}}`;
    case "fence":
      return `\\left${node.open}${serialize(node.body)}\\right${node.close}`;
    case "function": {
      const name = FUNCTION_COMMANDS.has(node.name) ? `\\${node.name}` : `\\operatorname{${escapeText(node.name)}}`;
      const subscript = node.subscript ? `_{${serialize(node.subscript)}}` : "";
      if (!node.arguments.length) return `${name}${subscript}`;
      return `${name}${subscript}\\left(${node.arguments.map(serialize).join(",")}\\right)`;
    }
    case "large-operator":
      return serializeLargeOperator(node, serialize);
    case "matrix": {
      const environment = MATRIX_ENVIRONMENT[node.delimiter];
      const rows = Array.from({ length: node.rows }, (_, row) =>
        node.cells.slice(row * node.columns, (row + 1) * node.columns).map(serialize).join(" & "),
      ).join(" \\\\ ");
      return `\\begin{${environment}}${rows}\\end{${environment}}`;
    }
    case "cases":
      return `\\begin{cases}${node.rows.map((row) => `${serialize(row.value)} & ${serialize(row.condition)}`).join(" \\\\ ")}\\end{cases}`;
    case "accent":
      return `\\${ACCENT_COMMAND[node.accent]}{${serialize(node.body)}}`;
    case "binomial":
      return `\\binom{${serialize(node.upper)}}{${serialize(node.lower)}}`;
  }
}

function serializeLargeOperator(
  node: FormulaLargeOperatorNode,
  serialize: (node: FormulaExpressionNode) => string,
) {
  const order = node.order ? serialize(node.order) : "";
  const body = serialize(node.body);
  const variable = node.variable ? serialize(node.variable) : "x";
  if (node.operator === "derivative" || node.operator === "partial-derivative") {
    const differential = node.operator === "partial-derivative" ? "\\partial" : "\\mathrm{d}";
    const exponent = order ? `^{${order}}` : "";
    return `\\frac{${differential}${exponent}{${body}}}{${differential}{${variable}}${exponent}}`;
  }
  const command = LARGE_OPERATOR_COMMAND[node.operator] ?? "int";
  const lower = node.lower ? `_{${serialize(node.lower)}}` : "";
  const upper = node.upper ? `^{${serialize(node.upper)}}` : "";
  const differential = node.differential ? `\\,\\mathrm{d}{${serialize(node.differential)}}` : "";
  return `\\${command}${lower}${upper}{${body}}${differential}`;
}

export function validateFormulaTree(node: FormulaExpressionNode): FormulaTreeValidation {
  const visit = (current: FormulaExpressionNode): FormulaTreeValidation => {
    if (current.kind === "slot") {
      return current.required
        ? { status: "incomplete", message: `خانهٔ «${current.name}» هنوز خالی است.`, nodeId: current.id }
        : { status: "valid" };
    }
    if (current.kind === "atom" && !current.value.trim()) {
      return { status: "invalid", message: "مقدار اتم فرمول خالی است.", nodeId: current.id };
    }
    if (current.kind === "matrix") {
      if (current.rows < 1 || current.columns < 1 || current.rows > 8 || current.columns > 8 || current.cells.length !== current.rows * current.columns) {
        return { status: "invalid", message: "ابعاد یا تعداد خانه‌های ماتریس معتبر نیست.", nodeId: current.id };
      }
    }
    if (current.kind === "function") {
      if (current.arguments.length === 0) {
        return { status: "incomplete", message: "حداقل یک آرگومان برای تابع لازم است.", nodeId: current.id };
      }
      if (current.arguments.length > 3) {
        return { status: "invalid", message: "تابع دیداری حداکثر سه آرگومان دارد.", nodeId: current.id };
      }
    }
    if (current.kind === "cases") {
      if (current.rows.length === 0) {
        return { status: "incomplete", message: "حداقل یک ردیف برای تابع چندضابطه‌ای لازم است.", nodeId: current.id };
      }
      if (current.rows.length > 8) {
        return { status: "invalid", message: "تابع چندضابطه‌ای حداکثر هشت ردیف دارد.", nodeId: current.id };
      }
    }
    for (const child of formulaChildren(current)) {
      const result = visit(child);
      if (result.status !== "valid") return result;
    }
    return { status: "valid" };
  };
  return visit(node);
}

function formulaChildren(node: FormulaExpressionNode): FormulaExpressionNode[] {
  switch (node.kind) {
    case "slot":
    case "atom": return [];
    case "row": return node.children;
    case "fraction": return [node.numerator, node.denominator];
    case "script": return [node.base, ...(node.subscript ? [node.subscript] : []), ...(node.superscript ? [node.superscript] : [])];
    case "radical": return [...(node.index ? [node.index] : []), node.radicand];
    case "fence": return [node.body];
    case "function": return [...(node.subscript ? [node.subscript] : []), ...node.arguments];
    case "large-operator": return [node.body, ...(node.lower ? [node.lower] : []), ...(node.upper ? [node.upper] : []), ...(node.variable ? [node.variable] : []), ...(node.differential ? [node.differential] : []), ...(node.order ? [node.order] : [])];
    case "matrix": return node.cells;
    case "cases": return node.rows.flatMap((row) => [row.value, row.condition]);
    case "accent": return [node.body];
    case "binomial": return [node.upper, node.lower];
  }
}

class FormulaParseError extends Error {
  constructor(message: string, readonly index: number, readonly unsupported = false) {
    super(message);
    this.name = "FormulaParseError";
  }
}

function sourceLocation(source: string, index: number, length = 1): FormulaSourceLocation {
  const safeIndex = Math.max(0, Math.min(index, source.length));
  const prefix = source.slice(0, safeIndex);
  const lines = prefix.split("\n");
  return { index: safeIndex, line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1, length };
}

class LatexExpressionParser {
  private index = 0;

  constructor(
    private readonly source: string,
    private readonly idFactory: FormulaNodeFactory,
  ) {}

  parse(): FormulaExpressionNode {
    const result = this.parseRow();
    this.skipWhitespace();
    if (this.index < this.source.length) throw new FormulaParseError("نشانهٔ اضافی در پایان فرمول.", this.index);
    return result;
  }

  private parseRow(stopCharacter?: string, stopCommand?: string): FormulaExpressionNode {
    const children: FormulaExpressionNode[] = [];
    while (this.index < this.source.length) {
      this.skipWhitespace();
      if (stopCharacter && this.source[this.index] === stopCharacter) break;
      if (stopCommand && this.source.startsWith(`\\${stopCommand}`, this.index)) break;
      if (this.index >= this.source.length) break;
      let primary = this.parsePrimary();
      let subscript: FormulaExpressionNode | undefined;
      let superscript: FormulaExpressionNode | undefined;
      while (this.source[this.index] === "_" || this.source[this.index] === "^") {
        const marker = this.source[this.index];
        this.index += 1;
        const script = this.parseScriptArgument(marker === "_" ? "زیرنویس" : "بالانویس");
        if (marker === "_") subscript = script;
        else superscript = script;
      }
      if (subscript || superscript) {
        primary = { id: this.idFactory(), kind: "script", base: primary, subscript, superscript };
      }
      this.skipWhitespace();
      const functionNode: FormulaFunctionNode | undefined = primary.kind === "function"
        ? primary
        : primary.kind === "script" && primary.base.kind === "function" && !primary.superscript
          ? { ...primary.base, subscript: primary.subscript }
          : undefined;
      if (functionNode && this.source.startsWith("\\left", this.index)) {
        const fenced = this.parsePrimary();
        if (fenced.kind !== "fence" || fenced.open !== "(" || fenced.close !== ")") {
          throw new FormulaParseError("آرگومان تابع باید داخل پرانتز باشد.", this.index);
        }
        primary = { ...functionNode, arguments: functionArgumentsFromBody(fenced.body, this.idFactory) };
      }
      children.push(primary);
    }
    if (children.length === 1) return children[0];
    return formulaRow(children, this.idFactory());
  }

  private parsePrimary(): FormulaExpressionNode {
    const character = this.source[this.index];
    if (character === "{") {
      this.index += 1;
      const group = this.parseRow("}");
      if (this.source[this.index] !== "}") throw new FormulaParseError("آکولاد بسته پیدا نشد.", this.index);
      this.index += 1;
      return group;
    }
    if (character === "}") throw new FormulaParseError("آکولاد بسته بدون گروه باز دیده شد.", this.index);
    if (character === "\\") return this.parseCommand();

    const start = this.index;
    if (/\d/u.test(character)) {
      while (/\d|[.,]/u.test(this.source[this.index] ?? "")) this.index += 1;
      return formulaAtom(this.source.slice(start, this.index), "number", this.idFactory());
    }
    if (/\p{L}/u.test(character)) {
      while (/\p{L}/u.test(this.source[this.index] ?? "")) this.index += 1;
      return formulaAtom(this.source.slice(start, this.index), "identifier", this.idFactory());
    }
    this.index += 1;
    return formulaAtom(character, "symbol", this.idFactory());
  }

  private parseCommand(): FormulaExpressionNode {
    const commandStart = this.index;
    const command = this.readCommand();
    if (SPACING_COMMANDS.has(command)) return formulaAtom(`\\${command}`, "symbol", this.idFactory());
    if (command === "frac" || command === "dfrac" || command === "tfrac") {
      return {
        id: this.idFactory(),
        kind: "fraction",
        numerator: this.parseArgument("صورت"),
        denominator: this.parseArgument("مخرج"),
      };
    }
    if (command === "sqrt") {
      const index = this.source[this.index] === "[" ? this.parseBracketArgument("درجهٔ ریشه") : undefined;
      return { id: this.idFactory(), kind: "radical", index, radicand: this.parseArgument("عبارت زیر ریشه") };
    }
    if (command === "left") {
      const open = this.readDelimiter();
      const body = this.parseRow(undefined, "right");
      if (!this.source.startsWith("\\right", this.index)) throw new FormulaParseError("\\right متناظر پیدا نشد.", this.index);
      this.index += "\\right".length;
      const close = this.readDelimiter();
      return { id: this.idFactory(), kind: "fence", open, body, close };
    }
    if (command === "begin") return this.parseEnvironment(commandStart);
    if (command === "binom" || command === "dbinom" || command === "tbinom") {
      return {
        id: this.idFactory(),
        kind: "binomial",
        upper: this.parseArgument("عضو بالا"),
        lower: this.parseArgument("عضو پایین"),
      };
    }
    const accent = COMMAND_ACCENT.get(command);
    if (accent) return { id: this.idFactory(), kind: "accent", accent, body: this.parseArgument("عبارت") };
    if (FUNCTION_COMMANDS.has(command)) {
      return { id: this.idFactory(), kind: "function", name: command, arguments: [] };
    }
    if (command === "operatorname") {
      const name = this.readRawGroup("نام تابع");
      return { id: this.idFactory(), kind: "function", name, arguments: [] };
    }
    const largeOperator = COMMAND_LARGE_OPERATOR.get(command);
    if (largeOperator) return this.parseLargeOperator(largeOperator);
    if (command === "text" || command === "mathrm" || command === "mathbf" || command === "mathit" || command === "mathsf" || command === "mathtt") {
      const value = this.readRawGroup("متن");
      return formulaAtom(value, command === "text" ? "text" : "identifier", this.idFactory());
    }
    if (VISUAL_ATOM_COMMANDS.has(command)) return formulaAtom(`\\${command}`, "symbol", this.idFactory());
    if (SAFE_LATEX_COMMANDS.has(command)) {
      throw new FormulaParseError(`فرمان \\${command} معتبر است، اما هنوز به node دیداری تبدیل نمی‌شود.`, commandStart, true);
    }
    throw new FormulaParseError(`فرمان \\${command} در ویرایشگر دیداری پشتیبانی نمی‌شود.`, commandStart, true);
  }

  private parseLargeOperator(operator: FormulaLargeOperator): FormulaLargeOperatorNode {
    let lower: FormulaExpressionNode | undefined;
    let upper: FormulaExpressionNode | undefined;
    while (this.source[this.index] === "_" || this.source[this.index] === "^") {
      const marker = this.source[this.index];
      this.index += 1;
      const bound = this.parseScriptArgument(marker === "_" ? "کران پایین" : "کران بالا");
      if (marker === "_") lower = bound;
      else upper = bound;
    }
    const body = this.source[this.index] === "{"
      ? this.parseArgument("عبارت")
      : formulaSlot("body", false, this.idFactory());
    return { id: this.idFactory(), kind: "large-operator", operator, body, lower, upper };
  }

  private parseEnvironment(commandStart: number): FormulaExpressionNode {
    const environment = this.readRawGroup("نام محیط");
    const endToken = `\\end{${environment}}`;
    const end = this.source.indexOf(endToken, this.index);
    if (end < 0) throw new FormulaParseError(`پایان محیط ${environment} پیدا نشد.`, commandStart);
    const body = this.source.slice(this.index, end);
    this.index = end + endToken.length;
    if (environment === "cases") {
      const rows = splitTopLevel(body, "\\\\").filter((row) => row.trim()).map((row) => {
        const cells = splitTopLevel(row, "&");
        return {
          id: this.idFactory(),
          value: parseLatexExpression(cells[0]?.trim() ?? "", this.idFactory),
          condition: parseLatexExpression(cells.slice(1).join("&").trim(), this.idFactory),
        };
      });
      return { id: this.idFactory(), kind: "cases", rows };
    }
    const delimiter = ENVIRONMENT_DELIMITER[environment];
    if (!delimiter) throw new FormulaParseError(`محیط ${environment} هنوز در Builder دیداری پشتیبانی نمی‌شود.`, commandStart, true);
    const rowSources = splitTopLevel(body, "\\\\").filter((row) => row.trim().length > 0);
    const parsedRows = rowSources.map((row) => splitTopLevel(row, "&").map((cell) => parseLatexExpression(cell.trim(), this.idFactory)));
    const columns = Math.max(1, ...parsedRows.map((row) => row.length));
    const rows = Math.max(1, parsedRows.length);
    if (rows > 8 || columns > 8 || parsedRows.some((row) => row.length !== columns)) {
      throw new FormulaParseError("ماتریس باید مستطیلی و حداکثر ۸×۸ باشد.", commandStart);
    }
    return { id: this.idFactory(), kind: "matrix", rows, columns, delimiter, cells: parsedRows.flat() };
  }

  private parseArgument(label: string): FormulaExpressionNode {
    this.skipWhitespace();
    if (this.source[this.index] !== "{") throw new FormulaParseError(`گروه «${label}» با { شروع نشده است.`, this.index);
    this.index += 1;
    const value = this.parseRow("}");
    if (this.source[this.index] !== "}") throw new FormulaParseError(`گروه «${label}» بسته نشده است.`, this.index);
    this.index += 1;
    return value;
  }

  private parseScriptArgument(label: string): FormulaExpressionNode {
    this.skipWhitespace();
    if (this.source[this.index] === "{") return this.parseArgument(label);
    if (this.index >= this.source.length) {
      throw new FormulaParseError(`مقدار «${label}» پیدا نشد.`, this.index);
    }
    return this.parsePrimary();
  }

  private parseBracketArgument(label: string): FormulaExpressionNode {
    if (this.source[this.index] !== "[") throw new FormulaParseError(`گروه «${label}» با [ شروع نشده است.`, this.index);
    this.index += 1;
    const value = this.parseRow("]");
    if (this.source[this.index] !== "]") throw new FormulaParseError(`گروه «${label}» بسته نشده است.`, this.index);
    this.index += 1;
    return value;
  }

  private readRawGroup(label: string) {
    this.skipWhitespace();
    if (this.source[this.index] !== "{") throw new FormulaParseError(`گروه «${label}» پیدا نشد.`, this.index);
    const start = ++this.index;
    let depth = 1;
    while (this.index < this.source.length && depth > 0) {
      const character = this.source[this.index];
      if (character === "{") depth += 1;
      if (character === "}") depth -= 1;
      this.index += 1;
    }
    if (depth !== 0) throw new FormulaParseError(`گروه «${label}» بسته نشده است.`, this.index);
    return this.source.slice(start, this.index - 1);
  }

  private readDelimiter() {
    this.skipWhitespace();
    if (this.source[this.index] === "\\") return `\\${this.readCommand()}`;
    const delimiter = this.source[this.index];
    if (!delimiter) throw new FormulaParseError("جداکنندهٔ پرانتز پیدا نشد.", this.index);
    this.index += 1;
    return delimiter;
  }

  private readCommand() {
    if (this.source[this.index] !== "\\") throw new FormulaParseError("فرمان LaTeX معتبر نیست.", this.index);
    this.index += 1;
    const start = this.index;
    if (/\p{L}/u.test(this.source[this.index] ?? "")) {
      while (/\p{L}/u.test(this.source[this.index] ?? "")) this.index += 1;
    } else {
      this.index += 1;
    }
    return this.source.slice(start, this.index);
  }

  private skipWhitespace() {
    while (/\s/u.test(this.source[this.index] ?? "")) this.index += 1;
  }
}

function functionArgumentsFromBody(
  body: FormulaExpressionNode,
  idFactory: FormulaNodeFactory,
): FormulaExpressionNode[] {
  const children = body.kind === "row" ? body.children : [body];
  const result: FormulaExpressionNode[][] = [[]];
  for (const child of children) {
    if (child.kind === "atom" && child.atomKind === "symbol" && child.value === ",") {
      result.push([]);
    } else {
      result.at(-1)!.push(child);
    }
  }
  return result.map((parts) => {
    if (parts.length === 0) return formulaSlot("function-argument", true, idFactory());
    return parts.length === 1 ? parts[0] : formulaRow(parts, idFactory());
  });
}

function splitTopLevel(source: string, separator: string) {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{" && source[index - 1] !== "\\") depth += 1;
    if (character === "}" && source[index - 1] !== "\\") depth -= 1;
    if (depth === 0 && source.startsWith(separator, index)) {
      parts.push(source.slice(start, index));
      index += separator.length - 1;
      start = index + 1;
    }
  }
  parts.push(source.slice(start));
  return parts;
}

function calculusMarker(node: FormulaExpressionNode) {
  const source = node.kind === "script" ? node.base : node;
  if (source.kind !== "atom") return undefined;
  if (source.value !== "d" && source.value !== "\\partial") return undefined;
  return {
    operator: source.value === "\\partial" ? "partial-derivative" as const : "derivative" as const,
    order: node.kind === "script" ? node.superscript : undefined,
  };
}

function expressionFromParts(parts: FormulaExpressionNode[], idFactory: FormulaNodeFactory) {
  if (parts.length === 1) return parts[0];
  return formulaRow(parts, idFactory());
}

function normalizeTopLevelCalculus(
  node: FormulaExpressionNode,
  idFactory: FormulaNodeFactory,
): FormulaExpressionNode {
  if (node.kind === "fraction") {
    const numerator = node.numerator.kind === "row" ? node.numerator.children : [node.numerator];
    const denominator = node.denominator.kind === "row" ? node.denominator.children : [node.denominator];
    const numeratorMarker = calculusMarker(numerator[0]);
    const denominatorMarker = calculusMarker(denominator[0]);
    if (
      numeratorMarker
      && denominatorMarker
      && numeratorMarker.operator === denominatorMarker.operator
      && numerator.length >= 2
      && denominator.length >= 2
    ) {
      const denominatorVariable = denominator.length === 2 && denominator[1].kind === "script"
        ? denominator[1].base
        : expressionFromParts(denominator.slice(1), idFactory);
      const denominatorOrder = denominator.length === 2 && denominator[1].kind === "script"
        ? denominator[1].superscript
        : undefined;
      // A noncanonical fraction must retain both orders, not silently become a derivative.
      if (serializeFormulaToLatex(numeratorMarker.order ?? formulaAtom("1")) !== serializeFormulaToLatex(denominatorOrder ?? formulaAtom("1"))) return node;
      return {
        id: idFactory(),
        kind: "large-operator",
        operator: numeratorMarker.operator,
        body: expressionFromParts(numerator.slice(1), idFactory),
        variable: denominatorVariable,
        order: numeratorMarker.order ?? denominatorOrder,
      };
    }
  }

  if (node.kind === "row" && node.children[0]?.kind === "large-operator") {
    const operator = node.children[0];
    if (["integral", "double-integral", "triple-integral", "contour-integral"].includes(operator.operator)) {
      const remainder = node.children.slice(1).filter((child) => !(
        child.kind === "atom"
        && child.atomKind === "symbol"
        && ["\\,", "\\;", "\\:", "\\!", "\\quad", "\\qquad"].includes(child.value)
      ));
      const markerIndex = remainder.findIndex((child) => calculusMarker(child)?.operator === "derivative");
      if (markerIndex >= 0 && remainder.length > markerIndex + 1) {
        return {
          ...operator,
          body: expressionFromParts([...(operator.body.kind === "slot" ? [] : operator.body.kind === "row" ? operator.body.children : [operator.body]), ...remainder.slice(0, markerIndex)], idFactory),
          differential: expressionFromParts(remainder.slice(markerIndex + 1), idFactory),
        };
      }
    }
  }
  return node;
}

export function parseLatexExpression(
  source: string,
  idFactory: FormulaNodeFactory = createFormulaNodeId,
) {
  if (!source.trim()) return formulaSlot("expression", true, idFactory());
  return normalizeTopLevelCalculus(new LatexExpressionParser(source, idFactory).parse(), idFactory);
}

function latexCommands(source: string) {
  const commands: Array<{ command: string; index: number }> = [];
  const expression = /\\([A-Za-z]+|.)/gu;
  for (const match of source.matchAll(expression)) {
    commands.push({ command: match[1], index: match.index ?? 0 });
  }
  return commands;
}

export function validateAdvancedLatex(source: string): FormulaLatexValidation {
  const normalized = source.replace(/\r\n?/gu, "\n").trim();
  if (!normalized) {
    return { status: "incomplete", source, message: "فرمول هنوز خالی است.", location: sourceLocation(source, 0, 0), preserveRaw: false };
  }

  for (const token of latexCommands(normalized)) {
    if (FORBIDDEN_LATEX_COMMANDS.has(token.command)) {
      return {
        status: "invalid",
        source,
        message: `فرمان \\${token.command} به دلایل امنیتی مجاز نیست.`,
        location: sourceLocation(normalized, token.index, token.command.length + 1),
        preserveRaw: false,
      };
    }
    if (/^[A-Za-z]+$/u.test(token.command) && !SAFE_LATEX_COMMANDS.has(token.command)) {
      return {
        status: "invalid",
        source,
        message: `فرمان \\${token.command} در فهرست امن فرمول نیست.`,
        location: sourceLocation(normalized, token.index, token.command.length + 1),
        preserveRaw: false,
      };
    }
  }

  try {
    katex.renderToString(normalized, {
      displayMode: true,
      output: "mathml",
      throwOnError: true,
      strict: "error",
      trust: false,
    });
  } catch (error) {
    const parseError = error as Partial<katex.ParseError> & Error;
    const index = typeof parseError.position === "number" ? parseError.position : 0;
    return {
      status: "invalid",
      source,
      message: parseError.rawMessage ?? parseError.message ?? "LaTeX معتبر نیست.",
      location: sourceLocation(normalized, index, parseError.length ?? 1),
      preserveRaw: false,
    };
  }

  try {
    const tree = parseLatexExpression(normalized);
    const treeValidation = validateFormulaTree(tree);
    if (treeValidation.status === "incomplete") {
      return { status: "incomplete", source, tree, message: treeValidation.message, preserveRaw: false };
    }
    if (treeValidation.status === "invalid") {
      return { status: "invalid", source, tree, message: treeValidation.message, preserveRaw: false };
    }
    return {
      status: "valid",
      source,
      tree,
      normalizedLatex: serializeFormulaToLatex(tree),
      preserveRaw: false,
    };
  } catch (error) {
    if (error instanceof FormulaParseError && error.unsupported) {
      return {
        status: "unsupported",
        source,
        message: error.message,
        location: sourceLocation(normalized, error.index),
        preserveRaw: true,
      };
    }
    const parseError = error as Error & { index?: number };
    return {
      status: "invalid",
      source,
      message: parseError.message || "ساختار LaTeX قابل تبدیل نیست.",
      location: sourceLocation(normalized, parseError.index ?? 0),
      preserveRaw: false,
    };
  }
}

export function formulaTreeIsComplete(node: FormulaExpressionNode) {
  return validateFormulaTree(node).status === "valid";
}

export function matrixDelimiterPair(delimiter: FormulaMatrixDelimiter) {
  return DELIMITER_LATEX[delimiter];
}
