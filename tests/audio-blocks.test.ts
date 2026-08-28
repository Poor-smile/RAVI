import assert from "node:assert/strict";
import test from "node:test";
import {
  audioBlockAtOffset,
  decodedAudioPath,
  findAudioBlocks,
  parseMarkdownAudio,
  serializeMarkdownAudio,
} from "../app/audio/markdown";

test("audio block serializes as portable standard Markdown", () => {
  const markdown = serializeMarkdownAudio(
    "گفت‌وگوی جلسه (نهایی).mp3",
    "./گزارش.assets/meeting-final.mp3",
  );
  assert.equal(
    markdown,
    '[🎧 گفت‌وگوی جلسه (نهایی).mp3](./%DA%AF%D8%B2%D8%A7%D8%B1%D8%B4.assets/meeting-final.mp3 "raavi-audio")',
  );
  const parsed = parseMarkdownAudio(markdown);
  assert.equal(parsed?.fileName, "گفت‌وگوی جلسه (نهایی).mp3");
  assert.equal(
    decodedAudioPath(parsed?.source ?? ""),
    "./گزارش.assets/meeting-final.mp3",
  );
});

test("ordinary links and unsupported extensions are not upgraded to audio", () => {
  assert.equal(parseMarkdownAudio("[سایت](https://example.com)"), null);
  assert.equal(
    parseMarkdownAudio('[🎧 notes.txt](./note.txt "raavi-audio")'),
    null,
  );
});

test("audio blocks keep exact source ranges", () => {
  const first = '[🎧 اول.mp3](./doc.assets/one.mp3 "raavi-audio")';
  const second = '[🎧 دوم.wav](./doc.assets/two.wav "raavi-audio")';
  const markdown = `# عنوان\n\n${first}\n\nمتن\n\n${second}\n`;
  const blocks = findAudioBlocks(markdown);
  assert.equal(blocks.length, 2);
  assert.equal(markdown.slice(blocks[0].startOffset, blocks[0].endOffset), first);
  assert.equal(audioBlockAtOffset(blocks, blocks[1].startOffset + 4)?.fileName, "دوم.wav");
});
