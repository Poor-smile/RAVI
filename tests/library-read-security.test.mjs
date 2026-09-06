import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readLibraryDocument, readMarkdownFile } from "../desktop/server.mjs";

test("library reads reject a junction or symlink escaping the selected root", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "raavi-read-security-"));
  const library = path.join(temporaryRoot, "library");
  const outside = path.join(temporaryRoot, "outside");
  try {
    await mkdir(library);
    await mkdir(outside);
    await writeFile(path.join(outside, "private.md"), "outside fixture");
    await symlink(outside, path.join(library, "linked"), process.platform === "win32" ? "junction" : "dir");
    const requested = path.join(library, "linked", "private.md");
    for (const read of [readMarkdownFile, readLibraryDocument]) {
      await assert.rejects(() => read(requested, new Set([library])), /outside the selected library/i);
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("library reads allow an internal link and dot-prefixed document names", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "raavi-read-security-"));
  try {
    const nested = path.join(temporaryRoot, "nested");
    await mkdir(nested);
    await writeFile(path.join(nested, "valid.md"), "inside fixture");
    await writeFile(path.join(temporaryRoot, "..notes.md"), "dot fixture");
    await symlink(nested, path.join(temporaryRoot, "linked"), process.platform === "win32" ? "junction" : "dir");
    assert.equal(await readMarkdownFile(path.join(temporaryRoot, "linked", "valid.md"), new Set([temporaryRoot])), "inside fixture");
    const requested = path.join(temporaryRoot, "linked", "valid.md");
    assert.equal((await readLibraryDocument(requested, new Set([temporaryRoot]))).path, requested);
    assert.equal((await readLibraryDocument(path.join(temporaryRoot, "..notes.md"), new Set([temporaryRoot]))).content, "dot fixture");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
