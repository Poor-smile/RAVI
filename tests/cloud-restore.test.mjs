import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { restoreCloudBackupSet } from "../desktop/cloud-restore.mjs";

function backup(documentId = "0123456789abcdef0123456789abcdef") {
  return {
    documentId,
    content: "# یادداشت\n\n![جلد](raavi-image://cover-image)\n\n[صدا](audio/source.wav \"raavi-audio\")",
    metadata: {
      format: "raavi-vault-metadata",
      version: 1,
      documentId,
      fileName: "یادداشت.md",
      annotations: [
        {
          id: "note-1",
          kind: "comment",
          start: 2,
          end: 9,
          quote: "یادداشت",
          prefix: "# ",
          suffix: "",
          body: "نظر",
        },
      ],
      versions: [
        {
          number: 2,
          savedAt: "2026-08-25T10:00:00.000Z",
          content: "# نسخه\n\n![جلد](raavi-image://cover-image)",
          annotations: [],
        },
      ],
    },
    assets: [
      {
        id: "cover-image",
        name: "cover.webp",
        mimeType: "image/webp",
        data: Buffer.from("optimized-image").toString("base64"),
      },
    ],
    audio: [
      {
        id: "voice",
        name: "voice.opus",
        mimeType: "audio/ogg",
        sourcePath: "audio/source.wav",
        data: Buffer.from("compressed-audio").toString("base64"),
      },
    ],
    attachments: [],
  };
}

test("cloud restore rebuilds portable Markdown, media, annotations, and history without overwriting", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-restore-"));
  const histories = [];
  try {
    await writeFile(path.join(temporary, "یادداشت.md"), "existing", "utf8");
    const first = await restoreCloudBackupSet({
      documentIds: ["0123456789abcdef0123456789abcdef"],
      parentDirectory: temporary,
      downloadBackup: async () => backup(),
      saveHistory: async (...args) => histories.push(args),
      now: () => Date.UTC(2026, 7, 26, 12, 30, 0),
    });
    const restoredPath = first.restored[0].filePath;
    const markdown = await readFile(restoredPath, "utf8");
    assert.match(markdown, /raavi:annotations:v1/u);
    assert.doesNotMatch(markdown, /raavi-image:\/\//u);
    assert.doesNotMatch(markdown, /audio\/source\.wav/u);
    assert.match(markdown, /یادداشت-files\/Images/u);
    assert.match(markdown, /یادداشت-files\/Audio/u);
    assert.equal(await readFile(path.join(temporary, "یادداشت.md"), "utf8"), "existing");
    const restoredEntries = await readdir(first.restoreRoot, { recursive: true });
    assert.ok(restoredEntries.some((entry) => /cover\.webp$/u.test(String(entry))));
    assert.ok(restoredEntries.some((entry) => /voice\.opus$/u.test(String(entry))));
    assert.equal(histories.length, 1);
    assert.equal(histories[0][1], 2);
    assert.match(histories[0][2][0].content, /یادداشت-files\/Images/u);

    const second = await restoreCloudBackupSet({
      documentIds: ["0123456789abcdef0123456789abcdef"],
      parentDirectory: temporary,
      downloadBackup: async () => backup(),
      now: () => Date.UTC(2026, 7, 26, 12, 30, 0),
    });
    assert.notEqual(second.restoreRoot, first.restoreRoot);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("cloud restore preserves successful documents when another backup fails", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-restore-"));
  const goodId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const badId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  try {
    const result = await restoreCloudBackupSet({
      documentIds: [badId, goodId],
      parentDirectory: temporary,
      downloadBackup: async (documentId) => {
        if (documentId === badId) throw new Error("remote unavailable");
        return backup(goodId);
      },
      now: () => Date.UTC(2026, 7, 26, 12, 30, 0),
    });
    assert.equal(result.restored.length, 1);
    assert.equal(result.restored[0].documentId, goodId);
    assert.deepEqual(result.failed, [
      { documentId: badId, message: "remote unavailable" },
    ]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
