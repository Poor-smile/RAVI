import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createSnapshotStorage } from "../desktop/snapshot-storage.mjs";
import { atomicWriteFile } from "../desktop/atomic-file.mjs";

test("large repeated snapshots preserve exact text while sharing immutable strings", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "raavi-snapshot-"));
  try {
    const file = path.join(root, "session.json");
    const store = createSnapshotStorage(root);
    const content = "فارسی 📝\r\n".repeat(300_000) + "\ud800";
    const data = { content, lastSavedSnapshot: JSON.stringify({ content, annotations: [], assets: [] }), versions: Array.from({ length: 10 }, (_, revision) => ({ revision, content })), metadata: { $raaviBlob: "literal", format: "raavi-snapshot/1" } };
    assert.ok(Buffer.byteLength(JSON.stringify(data)) > 48 * 1024 * 1024);
    await store.write(file, data);
    assert.ok((await readFile(file)).length < 10_000);
    assert.equal((await readdir(path.join(root, "strings"))).length, 1);
    assert.deepEqual(await createSnapshotStorage(root).read(file), data);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("collection releases replaced drafts while preserving other manifests and later writes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "raavi-snapshot-"));
  try {
    const first = path.join(root, "first.json"), second = path.join(root, "second.json");
    const store = createSnapshotStorage(root);
    await store.write(first, { content: "قدیمی".repeat(2000) });
    await store.write(second, { content: "تب دیگر".repeat(2000) });
    await store.write(first, { content: "جدید".repeat(2000) });
    assert.equal((await store.collect()).removed, 1);
    const cleanup = store.collect();
    const change = store.write(first, { content: "قدیمی".repeat(2000) });
    await Promise.all([cleanup, change]);
    assert.equal((await store.read(first)).content, "قدیمی".repeat(2000));
    assert.equal((await store.read(second)).content, "تب دیگر".repeat(2000));
    // A fresh instance discovers manifests before freeing any existing blobs.
    await createSnapshotStorage(root).collect();
    assert.equal((await store.read(second)).content, "تب دیگر".repeat(2000));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("migration retains legacy data and failed manifest commit retains the prior snapshot", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "raavi-snapshot-"));
  try {
    const file = path.join(root, "session.json");
    const original = { content: "متن اصلی".repeat(1000) };
    await writeFile(file, JSON.stringify(original));
    let fail = false;
    const store = createSnapshotStorage(root, { writeAtomic: async (target, value) => {
      if (fail && target === file) throw new Error("simulated manifest failure");
      return atomicWriteFile(target, value);
    } });
    assert.deepEqual(await store.read(file), original);
    await store.write(file, original);
    assert.deepEqual(JSON.parse(await readFile(`${file}.legacy.json`, "utf8")), original);
    fail = true;
    await assert.rejects(store.write(file, { content: "جدید".repeat(3000) }), /manifest failure/);
    assert.deepEqual(await createSnapshotStorage(root).read(file), original);
    const blob = (await readdir(path.join(root, "strings")))[0];
    // Corruption is surfaced rather than silently returning an empty document.
    for (const name of await readdir(path.join(root, "strings"))) await writeFile(path.join(root, "strings", name), '"corrupt"');
    assert.ok(blob);
    await assert.rejects(store.read(file), /integrity/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("collection cannot enter an active history mutation or a just-started read", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "raavi-snapshot-barrier-"));
  try {
    const file = path.join(root, "session.json");
    const store = createSnapshotStorage(root);
    await store.write(file, { content: "نسخه قدیم".repeat(2000) });
    await store.write(file, { content: "نسخه تازه".repeat(2000) });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const mutation = store.withMutation(() => gate);
    assert.equal((await store.collect()).removed, 0);
    release(); await mutation;
    const reading = store.read(file);
    assert.equal((await store.collect()).removed, 0);
    assert.equal((await reading).content, "نسخه تازه".repeat(2000));
    assert.equal((await store.collect()).removed, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
