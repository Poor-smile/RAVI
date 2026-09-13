import {
  AUDIO_BLOCK_TITLE,
  type AudioBlock,
  type AudioDescriptor,
} from "./types";

const AUDIO_LINK = /^\[([^\]\r\n]+)\]\(\s*(?:<([^>]+)>|([^\s)]+))\s+["']raavi-audio["']\s*\)$/u;
const AUDIO_EXTENSIONS = /\.(?:aac|flac|m4a|mp3|ogg|wav|webm)(?:[?#].*)?$/iu;

function unescapeMarkdownLabel(value: string) {
  return value.replace(/\\([\\\[\]])/gu, "$1").trim();
}

export function parseMarkdownAudio(source: string): AudioDescriptor | null {
  const match = AUDIO_LINK.exec(source.trim());
  if (!match) return null;
  const audioSource = (match[2] ?? match[3] ?? "").trim();
  if (!audioSource || !AUDIO_EXTENSIONS.test(audioSource)) return null;
  return {
    fileName: unescapeMarkdownLabel(match[1]).replace(/^🎧\s*/u, ""),
    source: audioSource,
    title: AUDIO_BLOCK_TITLE,
  };
}

export function serializeMarkdownAudio(
  fileName: string,
  relativePath: string,
) {
  const safeName = fileName
    .replace(/[\r\n]/gu, " ")
    .replace(/([\\\[\]])/gu, "\\$1")
    .trim();
  const source = encodeURI(relativePath.replace(/\\/gu, "/"))
    .replace(/\(/gu, "%28")
    .replace(/\)/gu, "%29");
  return `[🎧 ${safeName}](${source} "${AUDIO_BLOCK_TITLE}")`;
}

export function findAudioBlocks(markdown: string): AudioBlock[] {
  const blocks: AudioBlock[] = [];
  if (!markdown.includes("raavi-audio")) return blocks;
  let from = 0;
  for (const line of markdown.split(/(?<=\n)/u)) {
    const withoutBreak = line.replace(/\r?\n$/u, "");
    const descriptor = parseMarkdownAudio(withoutBreak);
    if (descriptor) {
      blocks.push({
        ...descriptor,
        raw: withoutBreak,
        startOffset: from,
        endOffset: from + withoutBreak.length,
      });
    }
    from += line.length;
  }
  return blocks;
}

export function audioBlockAtOffset(
  blocks: readonly AudioBlock[],
  offset: number | undefined,
) {
  if (offset === undefined) return null;
  return (
    blocks.find(
      (block) => offset >= block.startOffset && offset <= block.endOffset,
    ) ?? null
  );
}

export function decodedAudioPath(source: string) {
  try {
    return decodeURI(source);
  } catch {
    return source;
  }
}
