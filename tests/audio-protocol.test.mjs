import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createAudioFileResponse } from "../desktop/audio-protocol.mjs";

test("audio protocol supports full and byte-range responses", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "raavi-audio-protocol-"));
  const filePath = path.join(root, "sample.mp3");
  await writeFile(filePath, Buffer.from("0123456789", "utf8"));
  try {
    const full = await createAudioFileResponse(
      new Request("raavi-audio://asset/sample"),
      filePath,
    );
    assert.equal(full.status, 200);
    assert.equal(full.headers.get("accept-ranges"), "bytes");
    assert.equal(full.headers.get("content-type"), "audio/mpeg");
    assert.equal(await full.text(), "0123456789");

    const partial = await createAudioFileResponse(
      new Request("raavi-audio://asset/sample", {
        headers: { range: "bytes=3-6" },
      }),
      filePath,
    );
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get("content-range"), "bytes 3-6/10");
    assert.equal(partial.headers.get("content-length"), "4");
    assert.equal(await partial.text(), "3456");

    const suffix = await createAudioFileResponse(
      new Request("raavi-audio://asset/sample", {
        headers: { range: "bytes=-3" },
      }),
      filePath,
    );
    assert.equal(await suffix.text(), "789");

    const invalid = await createAudioFileResponse(
      new Request("raavi-audio://asset/sample", {
        headers: { range: "bytes=12-20" },
      }),
      filePath,
    );
    assert.equal(invalid.status, 416);
    assert.equal(invalid.headers.get("content-range"), "bytes */10");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
