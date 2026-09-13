import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { LARGE_MARKDOWN_THRESHOLD, splitMarkdownForProgressiveRender } from "../markdown/progressive-render";
import { yieldSearchTask } from "./yield-task";

type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  position?: { start: { offset?: number } };
};

export type ReadingDocumentMatch = {
  chunkIndex: number;
  blockOffset: number;
  start: number;
  end: number;
  label: string;
  quote: string;
  occurrence: number;
};

export type IndexedBlock = {
  chunkIndex: number;
  blockOffset: number;
  text: string;
  normalized: string;
  label: string;
};

export const READING_SEARCH_PAGE_SIZE = 50;

export function normalizeReadingQuery(value: string) {
  return value.toLocaleLowerCase("fa-IR").replace(/ي/gu, "ی").replace(/ك/gu, "ک");
}

function textOf(node: MarkdownNode): string {
  // Image alternatives and raw HTML are not visible document text. Formatting
  // boundaries, unlike block boundaries, do not interrupt a phrase match.
  if (node.type === "image" || node.type === "imageReference" || node.type === "html") return "";
  if (node.type === "break") return "\n";
  return node.value ?? node.children?.map(textOf).join("") ?? "";
}

function compact(value: string) {
  const text = value.replace(/\s+/gu, " ").trim();
  return text.length <= 48 ? text : `${text.slice(0, 47).trimEnd()}…`;
}

type ParsedChunk = { blocks: Omit<IndexedBlock, "chunkIndex">[]; lastHeading: string };

function parseChunk(content: string): ParsedChunk {
  const parser = unified().use(remarkParse).use(remarkGfm);
  const blocks: ParsedChunk["blocks"] = [];
  let heading = "";
    const tree = parser.parse(content) as MarkdownNode;
    function visit(node: MarkdownNode, parent?: MarkdownNode) {
      if (node.type === "heading") heading = compact(textOf(node));
      if (["heading", "paragraph", "code", "tableCell"].includes(node.type)) {
        const text = textOf(node);
        if (text) blocks.push({
          blockOffset: node.position?.start.offset ?? parent?.position?.start.offset ?? 0,
          text,
          normalized: normalizeReadingQuery(text),
          label: heading,
        });
        return;
      }
      for (const child of node.children ?? []) visit(child, node);
    }
    visit(tree);
  return { blocks, lastHeading: heading };
}

function documentChunks(content: string) {
  return content.length >= LARGE_MARKDOWN_THRESHOLD
    ? splitMarkdownForProgressiveRender(content) : [{ content, start: 0, end: content.length }];
}

function appendChunk(blocks: IndexedBlock[], parsed: ParsedChunk, chunkIndex: number, heading: string) {
  for (const block of parsed.blocks) blocks.push({ ...block, chunkIndex, label: block.label || heading || compact(block.text) });
  return parsed.lastHeading || heading;
}

export function buildReadingDocumentIndex(content: string): IndexedBlock[] {
  const blocks: IndexedBlock[] = [];
  let heading = "";
  documentChunks(content).forEach((chunk, chunkIndex) => {
    heading = appendChunk(blocks, parseChunk(chunk.content), chunkIndex, heading);
  });
  return blocks;
}

// Only the current document is retained. Unchanged chunks reuse visible text,
// never syntax trees; a cancelled build cannot replace the committed index.
export function createReadingDocumentIndexer() {
  let cached = new Map<string, ParsedChunk>();
  return {
    clear() { cached.clear(); },
    async build(content: string, cancelled: () => boolean = () => false, yieldTask = yieldSearchTask) {
      const next = new Map<string, ParsedChunk>();
      const blocks: IndexedBlock[] = [];
      let heading = "";
      let parsedChunks = 0;
      let reusedChunks = 0;
      const chunks = documentChunks(content);
      for (let index = 0; index < chunks.length; index++) {
        if (cancelled()) return null;
        const text = chunks[index].content;
        const reused = cached.get(text) ?? next.get(text);
        const parsed = reused ?? parseChunk(text);
        if (reused) reusedChunks++; else parsedChunks++;
        next.set(text, parsed);
        heading = appendChunk(blocks, parsed, index, heading);
        await yieldTask();
      }
      if (cancelled()) return null;
      cached = next;
      return { blocks, parsedChunks, reusedChunks };
    },
  };
}

export function createReadingSearchAccumulator(query: string, page = 0) {
  const needle = normalizeReadingQuery(query.trim());
  const results: ReadingDocumentMatch[] = [];
  let total = 0;
  const skip = Math.max(0, Math.trunc(page)) * READING_SEARCH_PAGE_SIZE;
  const add = (block: IndexedBlock) => {
    if (!needle) return;
    let cursor = 0;
    let occurrence = 0;
    while (cursor <= block.normalized.length - needle.length) {
      const start = block.normalized.indexOf(needle, cursor);
      if (start < 0) break;
      if (total >= skip && results.length < READING_SEARCH_PAGE_SIZE) results.push({
        chunkIndex: block.chunkIndex,
        blockOffset: block.blockOffset,
        start,
        end: start + needle.length,
        label: block.label,
        quote: block.text.slice(start, start + needle.length),
        occurrence,
      });
      total += 1;
      occurrence += 1;
      cursor = start + needle.length;
    }
  };
  return { add, result: () => ({ results, total }) };
}

export function searchReadingDocument(index: readonly IndexedBlock[], query: string, page = 0) {
  const scan = createReadingSearchAccumulator(query, page);
  for (const block of index) scan.add(block);
  return scan.result();
}
