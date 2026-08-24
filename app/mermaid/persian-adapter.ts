export type MermaidDiagramKind =
  | "flowchart"
  | "sequence"
  | "class"
  | "state"
  | "er"
  | "requirement"
  | "architecture"
  | "c4"
  | "mindmap"
  | "timeline"
  | "kanban"
  | "gitgraph"
  | "pie"
  | "sankey"
  | "journey"
  | "quadrant"
  | "xychart"
  | "gantt"
  | "swimlane"
  | "block"
  | "packet"
  | "radar"
  | "eventmodeling"
  | "treemap"
  | "venn"
  | "ishikawa"
  | "wardley"
  | "cynefin"
  | "treeview"
  | "other";

export type MermaidRenderPreparation = {
  code: string;
  kind: MermaidDiagramKind;
  labelMap: Map<string, string>;
};

export class PersianMermaidInputError extends Error {
  line: number;
  suggestion: string;

  constructor(message: string, line: number, suggestion: string) {
    super(message);
    this.name = "PersianMermaidInputError";
    this.line = line;
    this.suggestion = suggestion;
  }
}

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/gu;

export function toAsciiDigits(value: string) {
  return value
    .replace(/[۰-۹]/gu, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/gu, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/٫/gu, ".");
}

export function normalizePersianSearch(value: string) {
  return toAsciiDigits(value)
    .normalize("NFKC")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/ي/gu, "ی")
    .replace(/ك/gu, "ک")
    .replace(/[‌\s]+/gu, " ")
    .trim()
    .toLocaleLowerCase("fa-IR");
}

export function detectMermaidKind(code: string): MermaidDiagramKind {
  const trimmed = code.trimStart();
  const body = trimmed.startsWith("---")
    ? trimmed.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/u, "")
    : trimmed;
  let insideDirective = false;
  const firstLine =
    body
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find((line) => {
        if (!line) return false;
        if (insideDirective) {
          if (line.includes("}%%")) insideDirective = false;
          return false;
        }
        if (line.startsWith("%%{")) {
          insideDirective = !line.includes("}%%");
          return false;
        }
        return !line.startsWith("%%");
      }) ?? "";
  if (/^(?:flowchart|graph)\b/iu.test(firstLine)) return "flowchart";
  if (/^sequenceDiagram\b/iu.test(firstLine)) return "sequence";
  if (/^classDiagram\b/iu.test(firstLine)) return "class";
  if (/^stateDiagram(?:-v2)?\b/iu.test(firstLine)) return "state";
  if (/^erDiagram\b/iu.test(firstLine)) return "er";
  if (/^requirementDiagram\b/iu.test(firstLine)) return "requirement";
  if (/^architecture-beta\b/iu.test(firstLine)) return "architecture";
  if (/^C4(?:Context|Container|Component|Dynamic|Deployment)\b/iu.test(firstLine)) return "c4";
  if (/^mindmap\b/iu.test(firstLine)) return "mindmap";
  if (/^timeline\b/iu.test(firstLine)) return "timeline";
  if (/^pie\b/iu.test(firstLine)) return "pie";
  if (/^sankey(?:-beta)?\b/iu.test(firstLine)) return "sankey";
  if (/^journey\b/iu.test(firstLine)) return "journey";
  if (/^quadrantChart\b/iu.test(firstLine)) return "quadrant";
  if (/^xychart(?:-beta)?\b/iu.test(firstLine)) return "xychart";
  if (/^gantt\b/iu.test(firstLine)) return "gantt";
  if (/^kanban\b/iu.test(firstLine)) return "kanban";
  if (/^gitGraph\b/iu.test(firstLine)) return "gitgraph";
  if (/^swimlane-beta\b/iu.test(firstLine)) return "swimlane";
  if (/^block(?:-beta)?\b/iu.test(firstLine)) return "block";
  if (/^packet(?:-beta)?\b/iu.test(firstLine)) return "packet";
  if (/^radar-beta\b/iu.test(firstLine)) return "radar";
  if (/^eventmodeling\b/iu.test(firstLine)) return "eventmodeling";
  if (/^treemap(?:-beta)?\b/iu.test(firstLine)) return "treemap";
  if (/^venn-beta\b/iu.test(firstLine)) return "venn";
  if (/^ishikawa(?:-beta)?\b/iu.test(firstLine)) return "ishikawa";
  if (/^wardley-beta\b/iu.test(firstLine)) return "wardley";
  if (/^cynefin-beta\b/iu.test(firstLine)) return "cynefin";
  if (/^treeView-beta\b/iu.test(firstLine)) return "treeview";
  return "other";
}

export function parseMermaidCsvRow(line: string) {
  const fields: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && (character === "," || character === "،")) {
      fields.push(field.trim());
      field = "";
      continue;
    }
    field += character;
  }

  if (quoted) return null;
  fields.push(field.trim());
  return fields;
}

function normalizeBracketNumbers(line: string) {
  return line.replace(/\[([^\]]*)\]/gu, (match, values: string) => {
    if (!/[۰-۹٠-٩٫]/u.test(values)) return match;
    return `[${toAsciiDigits(values)}]`;
  });
}

function diagramStartIndex(lines: string[]) {
  let index = 0;
  while (index < lines.length && !lines[index].trim()) index += 1;
  if (lines[index]?.trim() !== "---") return index;
  index += 1;
  while (index < lines.length && lines[index].trim() !== "---") index += 1;
  if (index < lines.length) index += 1;
  while (index < lines.length && !lines[index].trim()) index += 1;
  return index;
}

function normalizeNumericSyntax(code: string, kind: MermaidDiagramKind) {
  const lines = code.split(/\r?\n/u);
  const startIndex = diagramStartIndex(lines);
  return lines
    .map((line, index) => {
      if (index <= startIndex) return line;
      if (kind === "pie") {
        const separator = line.lastIndexOf(":");
        if (separator < 0) return line;
        return `${line.slice(0, separator + 1)}${toAsciiDigits(line.slice(separator + 1))}`;
      }
      if (kind === "quadrant") return normalizeBracketNumbers(line);
      if (kind === "xychart") {
        const bracketed = normalizeBracketNumbers(line);
        if (!/^\s*y-axis\b/iu.test(bracketed)) return bracketed;
        return bracketed.replace(
          /([۰-۹٠-٩\d]+(?:[٫.]?[۰-۹٠-٩\d]+)?)\s*-->\s*([۰-۹٠-٩\d]+(?:[٫.]?[۰-۹٠-٩\d]+)?)/u,
          (range) => toAsciiDigits(range),
        );
      }
      if (kind === "journey") {
        const parts = line.split(":");
        if (parts.length < 3) return line;
        parts[1] = toAsciiDigits(parts[1]);
        return parts.join(":");
      }
      if (kind === "gantt") {
        const separator = line.indexOf(":");
        if (separator < 0) return line;
        return `${line.slice(0, separator + 1)}${toAsciiDigits(line.slice(separator + 1))}`;
      }
      if (kind === "packet") {
        return line.replace(
          /^(\s*)(\+?[۰-۹٠-٩\d]+)(?:\s*-\s*([۰-۹٠-٩\d]+))?(\s*:)/u,
          (_match, indent: string, start: string, end: string | undefined, suffix: string) =>
            `${indent}${toAsciiDigits(start)}${end ? `-${toAsciiDigits(end)}` : ""}${suffix}`,
        );
      }
      if (kind === "radar") {
        if (/^\s*(?:max|min|ticks)\b/iu.test(line)) return toAsciiDigits(line);
        return line.replace(/\{([^}]*)\}/gu, (match, values: string) =>
          /[۰-۹٠-٩٫]/u.test(values) ? `{${toAsciiDigits(values)}}` : match,
        );
      }
      if (kind === "treemap" || kind === "venn") {
        const separator = line.lastIndexOf(":");
        if (separator < 0) return line;
        return `${line.slice(0, separator + 1)}${toAsciiDigits(line.slice(separator + 1))}`;
      }
      if (kind === "wardley") {
        const bracketed = normalizeBracketNumbers(line);
        return /^\s*evolve\b/iu.test(bracketed) ? toAsciiDigits(bracketed) : bracketed;
      }
      if (kind === "eventmodeling") {
        return line.replace(
          /^(\s*(?:tf|timeframe|rf|resetframe)\s+)([۰-۹٠-٩\d]+)/iu,
          (_match, prefix: string, frame: string) => `${prefix}${toAsciiDigits(frame)}`,
        );
      }
      if (kind === "block") {
        return line.replace(/^(\s*columns\s+)([۰-۹٠-٩\d]+)/iu, (_match, prefix: string, columns: string) => `${prefix}${toAsciiDigits(columns)}`);
      }
      return line;
    })
    .join("\n");
}

function commentLabelMap(code: string) {
  const labels = new Map<string, string>();
  for (const match of code.matchAll(/^%% raavi-label:([A-Za-z0-9_]+):([^\r\n]+)$/gmu)) {
    try {
      labels.set(match[1], decodeURIComponent(match[2]));
    } catch {
      // A malformed private label comment must not make an otherwise valid diagram fail.
    }
  }
  return labels;
}

function prepareSankey(code: string): MermaidRenderPreparation {
  const lines = code.split(/\r?\n/u);
  const startIndex = diagramStartIndex(lines);
  const labelMap = new Map<string, string>();
  const labelTokens = new Map<string, string>();
  let tokenSequence = 0;
  const tokenFor = (label: string) => {
    const known = labelTokens.get(label);
    if (known) return known;
    tokenSequence += 1;
    const token = `RAAVI_FA_${tokenSequence}`;
    labelTokens.set(label, token);
    labelMap.set(token, label);
    return token;
  };

  const prepared = lines.map((line, index) => {
    if (index <= startIndex || !line.trim() || line.trimStart().startsWith("%%")) return line;
    const displayLine = (index + 1).toLocaleString("fa-IR");
    const fields = parseMermaidCsvRow(line);
    if (!fields || fields.length !== 3) {
      throw new PersianMermaidInputError(
        `ردیف ${displayLine} قابل خواندن نیست.`,
        index + 1,
        "هر مسیر باید سه بخش داشته باشد: مبدأ، مقصد و مقدار.",
      );
    }
    const [source, target, rawValue] = fields;
    if (!source || !target) {
      throw new PersianMermaidInputError(
        `مبدأ یا مقصد در ردیف ${displayLine} خالی است.`,
        index + 1,
        "برای هر مسیر، هر دو خانهٔ مبدأ و مقصد را کامل کنید.",
      );
    }
    const normalizedValue = toAsciiDigits(rawValue).trim();
    const number = Number(normalizedValue);
    if (!normalizedValue || !Number.isFinite(number) || number < 0) {
      throw new PersianMermaidInputError(
        `مقدار ردیف ${displayLine} معتبر نیست.`,
        index + 1,
        "یک عدد صفر یا بزرگ‌تر وارد کنید؛ اعداد فارسی نیز پذیرفته می‌شوند.",
      );
    }
    return `${tokenFor(source)},${tokenFor(target)},${normalizedValue}`;
  });

  return { code: prepared.join("\n"), kind: "sankey", labelMap };
}

export function prepareMermaidForRender(code: string): MermaidRenderPreparation {
  const kind = detectMermaidKind(code);
  const labels = commentLabelMap(code);
  if (kind === "sankey") {
    const prepared = prepareSankey(code);
    for (const [token, label] of labels) prepared.labelMap.set(token, label);
    return prepared;
  }
  return {
    code: normalizeNumericSyntax(code, kind),
    kind,
    labelMap: labels,
  };
}
