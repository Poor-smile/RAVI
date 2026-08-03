import { detectMermaidKind, type MermaidDiagramKind } from "./persian-adapter";

export type MermaidComplexity = {
  kind: MermaidDiagramKind;
  characters: number;
  lines: number;
  nodes: number;
  edges: number;
  nesting: number;
  score: number;
  level: "normal" | "high" | "extreme";
  svgBytes?: number;
};

const EDGE_PATTERNS = [
  /-->|---|-.->|==>|==|~~~|<-->|<--|--x|--o/gu,
  /\bRel(?:_\w+)?\s*\(/gu,
  /^\s*[\w\p{L}."' -]+\s*,\s*[\w\p{L}."' -]+\s*,\s*-?\d/gu,
] as const;

const DECLARATION_PATTERNS = [
  /^\s*([A-Za-z_][\w-]*)\s*(?:\[|\(|\{|\(\(|\[\[|>)/gmu,
  /^\s*(?:class|state|entity|requirement|element|service|group|block)\s+([\w-]+)/gimu,
  /\b(?:Person|System|Container|Component|Deployment_Node|Boundary)\s*\(\s*([\w-]+)/gimu,
] as const;

function countMatches(code: string, patterns: readonly RegExp[]) {
  return patterns.reduce((total, pattern) => {
    pattern.lastIndex = 0;
    return total + Array.from(code.matchAll(pattern)).length;
  }, 0);
}

function estimateNodes(code: string) {
  const identifiers = new Set<string>();
  for (const pattern of DECLARATION_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of code.matchAll(pattern)) {
      if (match[1]) identifiers.add(match[1]);
    }
  }
  const arrowEndpoint = /(?:^|\s)([A-Za-z_][\w-]*)\s*(?:-->|---|-.->|==>|~~~|<-->|<--|--x|--o)\s*([A-Za-z_][\w-]*)/gmu;
  for (const match of code.matchAll(arrowEndpoint)) {
    if (match[1]) identifiers.add(match[1]);
    if (match[2]) identifiers.add(match[2]);
  }
  return identifiers.size;
}

function estimateNesting(code: string) {
  let structuralDepth = 0;
  let maximum = 0;
  for (const line of code.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (/^(?:end\b|[}])/iu.test(trimmed)) structuralDepth = Math.max(0, structuralDepth - 1);
    const indentation = Math.floor((line.match(/^\s*/u)?.[0].replaceAll("\t", "  ").length ?? 0) / 2);
    maximum = Math.max(maximum, structuralDepth + indentation);
    if (/^(?:subgraph|section|block:|group\s)|\{\s*$/iu.test(trimmed)) structuralDepth += 1;
  }
  return maximum;
}

export function estimateMermaidComplexity(code: string): MermaidComplexity {
  const lines = code.split(/\r?\n/u).length;
  const nodes = estimateNodes(code);
  const edges = countMatches(code, EDGE_PATTERNS);
  const nesting = estimateNesting(code);
  const score = Math.round(
    nodes * 2.2 + edges * 3.2 + nesting * 9 + lines * 0.45 + code.length / 220,
  );
  const level =
    score > 2_200 || nodes > 550 || edges > 900 || nesting > 36
      ? "extreme"
      : score > 850 || nodes > 240 || edges > 360 || nesting > 22
        ? "high"
        : "normal";

  return {
    kind: detectMermaidKind(code),
    characters: code.length,
    lines,
    nodes,
    edges,
    nesting,
    score,
    level,
  };
}

export function withSvgComplexity(
  complexity: MermaidComplexity,
  svg: string,
): MermaidComplexity {
  return { ...complexity, svgBytes: new TextEncoder().encode(svg).byteLength };
}
