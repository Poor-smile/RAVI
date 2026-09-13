import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createSnapshotStorage } from "../desktop/snapshot-storage.mjs";
import { createDocumentHistoryStore } from "../desktop/document-history-store.mjs";

test("legacy history migrates exactly, separate files commit independently, and folder rename preserves versions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "raavi-history-store-"));
  try {
    const legacy = path.join(root, "legacy.json");
    const a = path.join(root, "folder", "الف.md"), b = path.join(root, "ب.md");
    const versions = [{ content: "متن فارسی".repeat(1000), revision: 2 }];
    const old = JSON.stringify({ documents: { [a]: { path: a, revision: 3, versions } } });
    await writeFile(legacy, old);
    const storage = createSnapshotStorage(root), directory = path.join(root, "history");
    const store = createDocumentHistoryStore(directory, legacy, storage);
    assert.deepEqual(await store.read(a), { revision: 3, versions });
    assert.equal(await readFile(legacy, "utf8"), old);
    await Promise.all([store.write(a, 4, versions), store.write(b, 7, versions)]);
    const next = path.join(root, "renamed", "الف.md");
    await store.remap(file => file === a ? next : undefined);
    const restored = createDocumentHistoryStore(directory, legacy, storage);
    assert.deepEqual(await restored.read(next), { revision: 4, versions });
    assert.deepEqual(await restored.read(b), { revision: 7, versions });
    assert.equal((await readdir(path.join(root, "strings"))).length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
