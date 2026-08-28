export type EditorBlockType =
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "paragraph"
  | "task"
  | "bullet-list"
  | "ordered-list"
  | "code-block"
  | "quote"
  | "divider"
  | "table"
  | "mermaid"
  | "image"
  | "audio"
  | "formula";

export type DirectEditorBlockType = Exclude<
  EditorBlockType,
  "table" | "mermaid" | "image" | "audio"
>;

export type ConvertedMarkdownBlock = {
  markdown: string;
  selectionOffset: number;
};

export type MarkdownBlockKind =
  | "text"
  | "heading"
  | "quote"
  | "divider"
  | "list"
  | "table"
  | "code"
  | "mermaid"
  | "image"
  | "audio"
  | "formula"
  | "blank";

/**
 * Half-open source offsets for one complete Markdown block. Line numbers are
 * one-based and inclusive so UI consumers never need to reinterpret offsets.
 */
export type MarkdownBlockRange = {
  from: number;
  to: number;
  kind: MarkdownBlockKind;
  lineFrom: number;
  lineTo: number;
};

const BLOCK_PREFIX = /^(?:#{1,6}[\t ]+|>[\t ]?(?:\[![^\]]+\][\t ]*)?|(?:[-+*][\t ]+(?:\[[ xX]\][\t ]*)?)|(?:\d+[.)][\t ]+))/u;

const PREFIX_BY_TYPE: Record<
  Exclude<DirectEditorBlockType, "code-block" | "formula" | "divider">,
  string
> = {
  "heading-1": "# ",
  "heading-2": "## ",
  "heading-3": "### ",
  paragraph: "",
  task: "- [ ] ",
  "bullet-list": "- ",
  "ordered-list": "1. ",
  quote: "> ",
};

function convertMarkdownLine(
  line: string,
  selectionColumn: number,
  type: Exclude<DirectEditorBlockType, "code-block" | "formula" | "divider">,
  stripExistingPrefix: boolean,
): ConvertedMarkdownBlock {
  const indentation = line.match(/^[\t ]*/u)?.[0] ?? "";
  const body = line.slice(indentation.length);
  const prefixMatch = stripExistingPrefix
    ? (body.match(BLOCK_PREFIX)?.[0] ?? "")
    : "";
  const slashOnly = stripExistingPrefix && body === "/";
  const content = slashOnly ? "" : body.slice(prefixMatch.length);
  const originalContentStart =
    indentation.length + (slashOnly ? 1 : prefixMatch.length);
  const logicalSelection = Math.max(
    0,
    Math.min(selectionColumn - originalContentStart, content.length),
  );
  const prefix = PREFIX_BY_TYPE[type];
  return {
    markdown: `${indentation}${prefix}${content}`,
    selectionOffset: indentation.length + prefix.length + logicalSelection,
  };
}

/**
 * Converts one editor line without inventing content. The selection follows the
 * same logical character after the Markdown marker changes, which keeps typing
 * continuous after a block-menu choice.
 */
export function convertMarkdownLineToBlock(
  line: string,
  selectionColumn: number,
  type: DirectEditorBlockType,
): ConvertedMarkdownBlock {
  if (type === "divider") {
    const indentation = line.match(/^[\t ]*/u)?.[0] ?? "";
    return {
      markdown: `${indentation}---`,
      selectionOffset: indentation.length + 3,
    };
  }

  if (type === "formula") {
    const plain = convertMarkdownLine(
      line,
      selectionColumn,
      "paragraph",
      true,
    );
    const indentation = line.match(/^[\t ]*/u)?.[0] ?? "";
    const content = plain.markdown.slice(indentation.length);
    const opening = `${indentation}$$\n`;
    const closing = `\n${indentation}$$`;
    return {
      markdown: `${opening}${content}${closing}`,
      selectionOffset:
        opening.length +
        Math.max(0, plain.selectionOffset - indentation.length),
    };
  }

  if (type === "code-block") {
    const plain = convertMarkdownLine(
      line,
      selectionColumn,
      "paragraph",
      true,
    );
    const indentation = line.match(/^[\t ]*/u)?.[0] ?? "";
    const content = plain.markdown.slice(indentation.length);
    const opening = `${indentation}\`\`\`text\n`;
    const closing = `\n${indentation}\`\`\``;
    return {
      markdown: `${opening}${content}${closing}`,
      selectionOffset:
        opening.length +
        Math.max(0, plain.selectionOffset - indentation.length),
    };
  }

  return convertMarkdownLine(line, selectionColumn, type, true);
}

/** Converts the complete syntactic block, including multi-line fenced blocks. */
export function convertMarkdownBlockToType(
  block: string,
  selectionOffset: number,
  type: DirectEditorBlockType,
): ConvertedMarkdownBlock {
  const safeSelection = Math.max(0, Math.min(selectionOffset, block.length));

  if (type === "divider") {
    return { markdown: "---", selectionOffset: 3 };
  }

  const firstBreak = block.indexOf("\n");
  const lastBreak = block.lastIndexOf("\n");
  const firstLine = firstBreak === -1 ? block : block.slice(0, firstBreak);
  const lastLine = lastBreak === -1 ? block : block.slice(lastBreak + 1);
  const openingFence = firstLine.match(/^[\t ]*(`{3,}|~{3,})/u)?.[1];
  const isFenced =
    Boolean(openingFence) &&
    firstBreak !== -1 &&
    lastBreak > firstBreak &&
    lastLine.trimStart().startsWith(openingFence!);
  const isFormula =
    /^[\t ]*\$\$[\t ]*$/u.test(firstLine) &&
    /^[\t ]*\$\$[\t ]*$/u.test(lastLine) &&
    firstBreak !== -1 &&
    lastBreak > firstBreak;
  const isWrappedBlock = isFenced || isFormula;
  const content = isWrappedBlock
    ? block.slice(firstBreak + 1, lastBreak)
    : block;
  const contentSelection = isWrappedBlock
    ? Math.max(0, Math.min(safeSelection - firstBreak - 1, content.length))
    : safeSelection;

  if (type === "formula") {
    const plain = isFormula
      ? {
          markdown: content,
          selectionOffset: contentSelection,
        }
      : convertMarkdownBlockToType(block, safeSelection, "paragraph");
    const opening = "$$\n";
    return {
      markdown: `${opening}${plain.markdown}\n$$`,
      selectionOffset: opening.length + plain.selectionOffset,
    };
  }

  if (type === "code-block") {
    const plain = isWrappedBlock
      ? { markdown: content, selectionOffset: contentSelection }
      : convertMarkdownBlockToType(block, safeSelection, "paragraph");
    const opening = "```text\n";
    return {
      markdown: `${opening}${plain.markdown}\n\`\`\``,
      selectionOffset: opening.length + plain.selectionOffset,
    };
  }

  const lines = content.split("\n");
  const selectionLine = content
    .slice(0, contentSelection)
    .split("\n").length - 1;
  const selectionLineStart =
    selectionLine === 0
      ? 0
      : content.lastIndexOf("\n", Math.max(0, contentSelection - 1)) + 1;
  const selectionColumn = contentSelection - selectionLineStart;
  const firstContentLine = Math.max(
    0,
    lines.findIndex((line) => line.trim().length > 0),
  );
  let nextSelection = 0;
  let outputLength = 0;
  const convertedLines = lines.map((line, index) => {
    const targetType =
      type.startsWith("heading-") && index !== firstContentLine
        ? "paragraph"
        : type;
    if (!line.trim() && targetType !== "paragraph") {
      if (index === selectionLine) nextSelection = outputLength;
      outputLength += index < lines.length - 1 ? 1 : 0;
      return "";
    }
    const converted = convertMarkdownLine(
      line,
      index === selectionLine ? selectionColumn : 0,
      targetType,
      !isWrappedBlock,
    );
    const markdown =
      targetType === "ordered-list"
        ? converted.markdown.replace(
            /^(\s*)1\./u,
            `$1${lines.slice(0, index + 1).filter((item) => item.trim()).length}.`,
          )
        : converted.markdown;
    if (index === selectionLine) {
      nextSelection = outputLength + converted.selectionOffset;
    }
    outputLength += markdown.length + (index < lines.length - 1 ? 1 : 0);
    return markdown;
  });

  return {
    markdown: convertedLines.join("\n"),
    selectionOffset: nextSelection,
  };
}
