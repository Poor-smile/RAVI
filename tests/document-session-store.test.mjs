import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createDocumentSessionStore } from "../desktop/document-session-store.mjs";

test("queued session checkpoints leave the exact newest document recoverable", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "raavi-session-store-"));
  try {
    const file = path.join(directory, "session.json");
    const store = createDocumentSessionStore(file);
    assert.equal(await store.read(), null);
    const versions = Array.from({ length: 12 }, (_, revision) => ({
      version: 2, activeTabId: "draft", closedTabs: [],
      tabs: [{ id: "draft", snapshot: { content: "فارسی 📝\n".repeat(10000) + revision } }],
    }));
    const writes = versions.map(value => store.write(value));
    assert.deepEqual(await store.read(), versions.at(-1));
    await Promise.all(writes);
    await store.flush();
    assert.equal(store.isWriting(), false);
    assert.deepEqual(await createDocumentSessionStore(file).read(), versions.at(-1));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("an invalid session cannot overwrite the last committed checkpoint", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "raavi-session-store-"));
  try {
    const store = createDocumentSessionStore(path.join(directory, "session.json"));
    const session = { version: 2, activeTabId: "", tabs: [], closedTabs: [] };
    await store.write(session);
    await assert.rejects(store.write({ version: 2, tabs: null }), /invalid/);
    await store.flush();
    assert.deepEqual(await store.read(), session);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
