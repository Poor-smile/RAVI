import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createVaultBackupCoordinator } from "../desktop/backup-vault.mjs";

function snapshot(overrides = {}) {
  return {
    content: "# نوشته",
    fileName: "نوشته.md",
    annotations: [],
    assets: [{ id: "image-1", data: "abc" }],
    versions: [{ number: 1 }],
    activeDocumentPath: "C:/Study/note.md",
    draftId: "draft-1",
    ...overrides,
  };
}

test("Vault stages every promoted snapshot locally before Drive sync", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-vault-"));
  const coordinator = createVaultBackupCoordinator({ userDataPath: temporary, syncDelayMs: 60_000 });
  try {
    const result = await coordinator.stageSnapshot(snapshot(), "first-edit");
    assert.equal(result.saved, true);
    assert.equal(result.residency, "vault-local");
    assert.equal(await coordinator.documentResidency(snapshot()), "vault-local");
    const current = JSON.parse(
      await readFile(path.join(coordinator.paths.documentsPath, result.documentId, "current.json"), "utf8"),
    );
    assert.equal(current.reason, "first-edit");
    assert.equal(current.snapshot.content, "# نوشته");
    const status = await coordinator.status();
    assert.equal(status.queuedDocuments, 1);
    assert.equal(status.syncState, "local-saved");
  } finally {
    coordinator.dispose();
    await rm(temporary, { recursive: true, force: true });
  }
});

test("connected Drive flush uploads text while respecting media and history policy", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-vault-"));
  const uploads = [];
  const provider = {
    async getQuota() {
      return { limitBytes: 10 * 1024 ** 3, usageBytes: 9.7 * 1024 ** 3, trashBytes: 0 };
    },
    async uploadDocument(value) {
      uploads.push(value);
      return { remoteId: "drive-file-1" };
    },
  };
  const coordinator = createVaultBackupCoordinator({ userDataPath: temporary, provider, syncDelayMs: 60_000 });
  try {
    await coordinator.updatePreferences({
      textAndStructure: true,
      optimizedImages: true,
      audio: false,
      otherAttachments: false,
      versionHistory: false,
    });
    await coordinator.updateConnection({ state: "connected", accountEmail: "reader@example.com" });
    await coordinator.stageSnapshot(snapshot(), "edit");
    const result = await coordinator.flush();
    assert.equal(result.synced, 1);
    assert.equal(uploads.length, 1);
    assert.deepEqual(uploads[0].payload.assets, []);
    assert.deepEqual(uploads[0].payload.versions, []);
    const status = await coordinator.status();
    assert.equal(status.queuedDocuments, 0);
    assert.equal(status.syncState, "up-to-date");
  } finally {
    coordinator.dispose();
    await rm(temporary, { recursive: true, force: true });
  }
});

test("disconnected Drive keeps the durable outbox for a later retry", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-vault-"));
  const coordinator = createVaultBackupCoordinator({ userDataPath: temporary, syncDelayMs: 60_000 });
  try {
    await coordinator.stageSnapshot(snapshot({ activeDocumentPath: "" }), "manual-move");
    const result = await coordinator.flush();
    assert.equal(result.deferred, true);
    assert.equal((await coordinator.status()).queuedDocuments, 1);
  } finally {
    coordinator.dispose();
    await rm(temporary, { recursive: true, force: true });
  }
});

test("Vault compacts edit history but always keeps the current snapshot", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-vault-"));
  let clock = Date.UTC(2026, 7, 25, 8, 0, 0);
  const coordinator = createVaultBackupCoordinator({
    userDataPath: temporary,
    now: () => new Date(clock++),
    syncDelayMs: 60_000,
  });
  try {
    let documentId = "";
    for (let index = 0; index < 55; index += 1) {
      const result = await coordinator.stageSnapshot(
        snapshot({ content: `# نوشته ${index}` }),
        "edit",
      );
      documentId = result.documentId;
    }
    const journal = await readFile(
      path.join(coordinator.paths.documentsPath, documentId, "journal.ndjson"),
      "utf8",
    );
    const entries = journal
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));
    assert.equal(entries.length, 50);
    assert.equal(entries.at(-1).snapshot.content, "# نوشته 54");
  } finally {
    coordinator.dispose();
    await rm(temporary, { recursive: true, force: true });
  }
});

test("content policy can back up compressed audio without copying Markdown text", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-vault-"));
  const uploads = [];
  const provider = {
    async getQuota() {
      return { limitBytes: 10 * 1024 ** 3, usageBytes: 1024 ** 3, trashBytes: 0 };
    },
    async uploadDocument(value) {
      uploads.push(value);
      return { remoteId: "audio-backup" };
    },
  };
  const coordinator = createVaultBackupCoordinator({
    userDataPath: temporary,
    provider,
    prepareAudioAssets: async () => [
      { id: "audio-1", name: "voice.opus", mimeType: "audio/ogg", data: "b3B1cw==" },
    ],
    syncDelayMs: 60_000,
  });
  try {
    await coordinator.updatePreferences({
      textAndStructure: false,
      optimizedImages: false,
      audio: true,
      otherAttachments: false,
      versionHistory: true,
    });
    await coordinator.updateConnection({ state: "connected", accountEmail: "reader@example.com" });
    await coordinator.stageSnapshot(snapshot(), "edit");
    await coordinator.flush();
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].payload.content, "");
    assert.deepEqual(uploads[0].payload.assets, []);
    assert.equal(uploads[0].payload.audioAssets[0].name, "voice.opus");
    assert.deepEqual(uploads[0].payload.versions, []);
    assert.equal(uploads[0].payload.backupCategories.textAndStructure, false);
  } finally {
    coordinator.dispose();
    await rm(temporary, { recursive: true, force: true });
  }
});

test("an unavailable audio encoder never blocks the durable text backup", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-vault-"));
  const uploads = [];
  const coordinator = createVaultBackupCoordinator({
    userDataPath: temporary,
    provider: {
      async getQuota() {
        return { limitBytes: 10 * 1024 ** 3, usageBytes: 1024 ** 3, trashBytes: 0 };
      },
      async uploadDocument(value) {
        uploads.push(value);
        return { remoteId: "text-partial" };
      },
    },
    prepareAudioAssets: async () => {
      throw new Error("Opus encoder is unavailable");
    },
    syncDelayMs: 60_000,
  });
  try {
    await coordinator.updatePreferences({
      textAndStructure: true,
      optimizedImages: false,
      audio: true,
      otherAttachments: false,
      versionHistory: true,
    });
    await coordinator.updateConnection({ state: "connected", accountEmail: "reader@example.com" });
    await coordinator.stageSnapshot(snapshot(), "edit");
    const result = await coordinator.flush();
    assert.equal(result.error, undefined);
    assert.equal(uploads[0].payload.content, "# نوشته");
    const status = await coordinator.status();
    assert.equal(status.queuedDocuments, 1);
    assert.match(status.lastWarning, /Opus encoder is unavailable/u);
    assert.equal(status.lastError, "");
  } finally {
    coordinator.dispose();
    await rm(temporary, { recursive: true, force: true });
  }
});

test("switching cloud providers requeues the current Vault without losing local data", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-vault-"));
  const googleUploads = [];
  const protonUploads = [];
  const coordinator = createVaultBackupCoordinator({
    userDataPath: temporary,
    providers: {
      "google-drive": {
        async getQuota() {
          return { limitBytes: 15 * 1024 ** 3, usageBytes: 1024 ** 3 };
        },
        async uploadDocument(value) {
          googleUploads.push(value);
          return { remoteId: "google-note" };
        },
      },
      "proton-drive": {
        async getQuota() {
          return null;
        },
        async uploadDocument(value) {
          protonUploads.push(value);
          return { remoteId: "/my-files/Raavi/Vault/note" };
        },
      },
    },
    syncDelayMs: 60_000,
  });
  try {
    await coordinator.updateConnection({
      state: "connected",
      accountEmail: "reader@example.com",
    });
    await coordinator.stageSnapshot(snapshot(), "edit");
    await coordinator.flush();
    assert.equal(googleUploads.length, 1);
    assert.equal((await coordinator.status()).queuedDocuments, 0);

    await coordinator.updateProvider("proton-drive", {
      state: "connected",
      accountEmail: "",
    });
    assert.equal((await coordinator.status()).providerId, "proton-drive");
    assert.equal((await coordinator.status()).queuedDocuments, 1);
    await coordinator.flush();
    assert.equal(protonUploads.length, 1);
    assert.equal((await coordinator.status()).queuedDocuments, 0);
    assert.equal(await coordinator.documentResidency(snapshot()), "backed-up");
  } finally {
    coordinator.dispose();
    await rm(temporary, { recursive: true, force: true });
  }
});
