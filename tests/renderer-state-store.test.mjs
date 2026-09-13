import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createSnapshotStorage } from "../desktop/snapshot-storage.mjs";
import { createRendererStateStore } from "../desktop/renderer-state-store.mjs";

test("new reading positions survive stale snapshots, reload and complete store recreation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "raavi-renderer-store-"));
  try {
    const file = path.join(root, "renderer.json"), positions = path.join(root, "positions.json");
    const storage = createSnapshotStorage(root);
    await writeFile(file, JSON.stringify({ content: "قدیمی", readingPositions: { a: { updatedAt: 10, scroll: 10 } } }));
    const store = createRendererStateStore(file, positions, storage);
    const first = store.writePositions({ a: { updatedAt: 30, scroll: 30 } });
    const second = store.write({ content: "تغییر ذخیره‌نشده", readingPositions: { a: { updatedAt: 20, scroll: 20 } } });
    assert.equal((await store.read()).content, "تغییر ذخیره‌نشده");
    await Promise.all([first, second]);await store.flush();
    assert.equal(store.hasUncommitted(), false);
    const restored = await createRendererStateStore(file, positions, storage).read();
    assert.equal(restored.content, "تغییر ذخیره‌نشده");
    assert.deepEqual(restored.readingPositions.a, { updatedAt: 30, scroll: 30 });
    assert.ok((await readFile(positions)).length < 100);
    // A late beforeunload message cannot invent a newer timestamp for an old
    // anchor and replace the position already acknowledged by the store.
    await store.writePositions({ a: { updatedAt: 20, scroll: 12 } }, { final: true });
    await store.write({ content: "متن نهایی", readingPositions: { a: { updatedAt: 30, scroll: 30 } } });
    await store.flush();
    assert.equal((await createRendererStateStore(file, positions, storage).read()).readingPositions.a.scroll, 30);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("failed checkpoint stays uncommitted and flush retries the newest snapshot", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "raavi-renderer-store-"));
  try {
    const storage = createSnapshotStorage(root);let fail = true;
    const store = createRendererStateStore(path.join(root, "state.json"), path.join(root, "positions.json"), {
      read: storage.read, write: (...args) => { if (fail) throw new Error("disk full"); return storage.write(...args); },
    });
    await assert.rejects(store.write({ content: "هنوز ذخیره نشده" }), /disk full/);
    assert.equal(store.hasUncommitted(), true);
    await assert.rejects(store.flush(), /disk full/);
    fail = false;await store.flush();
    assert.equal(store.hasUncommitted(), false);
    assert.equal((await storage.read(path.join(root, "state.json"))).content, "هنوز ذخیره نشده");
  } finally { await rm(root, { recursive: true, force: true }); }
});
