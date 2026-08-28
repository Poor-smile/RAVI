import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import JSZip from "jszip";
import { extractZipArchive } from "../desktop/zip-extract.mjs";

test("engine zip extraction supports Persian Windows paths", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "راوی-zip-"));
  const archivePath = path.join(root, "موتور.zip");
  const destination = path.join(root, "ابزار", "b4938");
  const archive = new JSZip();
  archive.file("whisper-bin-x64/Release/whisper-cli.exe", "engine");
  archive.file("whisper-bin-x64/README.txt", "راوی");
  await writeFile(archivePath, await archive.generateAsync({ type: "nodebuffer" }));
  try {
    await extractZipArchive(archivePath, destination);
    assert.equal(
      await readFile(
        path.join(destination, "whisper-bin-x64", "Release", "whisper-cli.exe"),
        "utf8",
      ),
      "engine",
    );
    assert.equal(
      await readFile(
        path.join(destination, "whisper-bin-x64", "README.txt"),
        "utf8",
      ),
      "راوی",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
