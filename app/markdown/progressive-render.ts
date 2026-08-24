export const LARGE_MARKDOWN_THRESHOLD = 64 * 1024;
export const MARKDOWN_RENDER_CHUNK_TARGET = 32 * 1024;

export type MarkdownRenderChunk = {
  content: string;
  start: number;
  end: number;
};

const FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})/u;
const ATX_HEADING_PATTERN = /^ {0,3}#{1,6}[ \t]+/u;

export function splitMarkdownForProgressiveRender(
  markdown: string,
  targetSize = MARKDOWN_RENDER_CHUNK_TARGET,
): MarkdownRenderChunk[] {
  if (markdown.length <= targetSize) {
    return [{ content: markdown, start: 0, end: markdown.length }];
  }

  const chunks: MarkdownRenderChunk[] = [];
  const linePattern = /.*(?:\r\n|\n|$)/gu;
  let chunkStart = 0;
  let fenceMarker = "";
  let match: RegExpExecArray | null;

  while ((match = linePattern.exec(markdown))) {
    const lineStart = match.index;
    const lineWithEnding = match[0];
    if (!lineWithEnding && lineStart === markdown.length) break;
    const line = lineWithEnding.replace(/\r?\n$/u, "");
    const fence = FENCE_PATTERN.exec(line);
    const isHeading = !fenceMarker && ATX_HEADING_PATTERN.test(line);
    const chunkLength = lineStart - chunkStart;
    const isSafeFallbackBoundary =
      !fenceMarker && !line.trim() && chunkLength >= targetSize * 2;

    if (
      lineStart > chunkStart &&
      chunkLength >= targetSize &&
      (isHeading || isSafeFallbackBoundary)
    ) {
      chunks.push({
        content: markdown.slice(chunkStart, lineStart),
        start: chunkStart,
        end: lineStart,
      });
      chunkStart = lineStart;
    }

    if (fence) {
      const marker = fence[1][0];
      fenceMarker = fenceMarker === marker ? "" : fenceMarker || marker;
    }
  }

  if (chunkStart < markdown.length) {
    chunks.push({
      content: markdown.slice(chunkStart),
      start: chunkStart,
      end: markdown.length,
    });
  }

  return chunks.length
    ? chunks
    : [{ content: markdown, start: 0, end: markdown.length }];
}
