import { appendFile, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const DEFAULT_PREFERENCES = Object.freeze({
  textAndStructure: true,
  optimizedImages: true,
  audio: false,
  otherAttachments: false,
  versionHistory: true,
});

const DEFAULT_STATE = Object.freeze({
  version: 1,
  providerId: "google-drive",
  connection: { state: "disconnected", accountEmail: "" },
  preferences: DEFAULT_PREFERENCES,
  quota: null,
  documents: {},
  lastSyncAt: "",
  lastError: "",
  lastWarning: "",
});

const TEXT_HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
const TEXT_HISTORY_MAX_VERSIONS = 50;

function safePreferences(value) {
  const candidate = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_PREFERENCES).map(([key, fallback]) => [
      key,
      typeof candidate[key] === "boolean" ? candidate[key] : fallback,
    ]),
  );
}

function safeConnection(value) {
  const allowed = new Set(["disconnected", "connected", "reauth", "error"]);
  return {
    state: allowed.has(value?.state) ? value.state : "disconnected",
    accountEmail:
      typeof value?.accountEmail === "string"
        ? value.accountEmail.slice(0, 320)
        : "",
  };
}

function safeProviderId(value) {
  return value === "proton-drive" ? "proton-drive" : "google-drive";
}

function safeDocuments(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, document]) => document && typeof document === "object")
      .slice(0, 10_000),
  );
}

function parseState(value) {
  return {
    version: 1,
    providerId: safeProviderId(value?.providerId),
    connection: safeConnection(value?.connection),
    preferences: safePreferences(value?.preferences),
    quota:
      value?.quota &&
      Number.isFinite(value.quota.limitBytes) &&
      Number.isFinite(value.quota.usageBytes)
        ? {
            limitBytes: Math.max(0, value.quota.limitBytes),
            usageBytes: Math.max(0, value.quota.usageBytes),
            trashBytes: Math.max(0, Number(value.quota.trashBytes) || 0),
          }
        : null,
    documents: safeDocuments(value?.documents),
    lastSyncAt:
      typeof value?.lastSyncAt === "string" ? value.lastSyncAt : "",
    lastError: typeof value?.lastError === "string" ? value.lastError : "",
    lastWarning:
      typeof value?.lastWarning === "string" ? value.lastWarning : "",
  };
}

function documentIdentity(snapshot) {
  const source =
    typeof snapshot?.activeDocumentPath === "string" &&
    snapshot.activeDocumentPath.trim()
      ? `path:${path.resolve(snapshot.activeDocumentPath).toLocaleLowerCase("en-US")}`
      : `draft:${String(snapshot?.draftId || "active")}`;
  return createHash("sha256").update(source).digest("hex").slice(0, 32);
}

function safeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("نمای فوری مخزن معتبر نیست.");
  }
  if (typeof snapshot.content !== "string" || typeof snapshot.fileName !== "string") {
    throw new Error("محتوای نمای فوری مخزن معتبر نیست.");
  }
  return snapshot;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(value, null, 2), "utf8");
  try {
    await rename(temporaryPath, filePath);
  } catch {
    await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
    await rm(temporaryPath, { force: true });
  }
}

function quotaAllowsMedia(quota) {
  if (!quota || quota.limitBytes <= 0) return true;
  const reserve = Math.min(
    quota.limitBytes,
    Math.max(500 * 1024 * 1024, Math.round(quota.limitBytes * 0.05)),
  );
  return quota.limitBytes - quota.usageBytes > reserve;
}

function hasCloudBackupCategory(preferences) {
  return Boolean(
    preferences.textAndStructure ||
      preferences.optimizedImages ||
      preferences.audio ||
      preferences.otherAttachments,
  );
}

function timestampOf(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function retainedVersions(versions, currentTime) {
  if (!Array.isArray(versions)) return [];
  const candidates = versions.filter(
    (version) => version && typeof version === "object",
  );
  const pinned = candidates.filter((version) => version.pinned === true);
  const pinnedSet = new Set(pinned);
  const recent = candidates
    .filter(
      (version) =>
        !pinnedSet.has(version) &&
        currentTime - timestampOf(version.savedAt) <= TEXT_HISTORY_MAX_AGE_MS,
    )
    .sort((left, right) => timestampOf(right.savedAt) - timestampOf(left.savedAt))
    .slice(0, TEXT_HISTORY_MAX_VERSIONS);
  return [...pinned, ...recent].sort(
    (left, right) => timestampOf(left.savedAt) - timestampOf(right.savedAt),
  );
}

async function compactJournal(journalPath, currentTime) {
  const raw = await readFile(journalPath, "utf8").catch(() => "");
  const entries = raw
    .split(/\r?\n/u)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const value = JSON.parse(line);
        return value && typeof value === "object" ? [value] : [];
      } catch {
        return [];
      }
    });
  if (entries.length <= 1) return;
  const latest = entries.at(-1);
  const cutoff = currentTime - TEXT_HISTORY_MAX_AGE_MS;
  const retained = entries
    .slice(0, -1)
    .filter((entry) => timestampOf(entry.savedAt) >= cutoff)
    .slice(-(TEXT_HISTORY_MAX_VERSIONS - 1));
  if (latest) retained.push(latest);
  if (retained.length === entries.length) return;
  await writeFile(
    journalPath,
    retained.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
    "utf8",
  );
}

export function createVaultBackupCoordinator({
  userDataPath,
  provider = null,
  providers = null,
  prepareAudioAssets = async () => [],
  now = () => new Date(),
  syncDelayMs = 2_500,
  maxSyncDelayMs = 10_000,
  onStatus = () => {},
}) {
  const rootPath = path.join(userDataPath, "vault");
  const statePath = path.join(rootPath, "backup-state.json");
  const documentsPath = path.join(rootPath, "documents");
  const outboxPath = path.join(rootPath, "outbox");
  let statePromise = null;
  let writeQueue = Promise.resolve();
  let flushQueue = Promise.resolve();
  let idleTimer = null;
  let maxTimer = null;
  const providerRegistry =
    providers && typeof providers === "object"
      ? providers
      : provider
        ? { "google-drive": provider }
        : {};

  function providerFor(providerId) {
    return providerRegistry[safeProviderId(providerId)] ?? null;
  }

  async function loadState() {
    if (!statePromise) {
      statePromise = readJson(statePath, DEFAULT_STATE).then(parseState);
    }
    return statePromise;
  }

  async function persistState(state) {
    statePromise = Promise.resolve(state);
    await writeJsonAtomic(statePath, state);
  }

  async function status() {
    const state = await loadState();
    const queued = await readdir(outboxPath).catch(() => []);
    return {
      providerId: state.providerId,
      connection: state.connection,
      preferences: state.preferences,
      quota: state.quota,
      queuedDocuments: queued.filter((name) => name.endsWith(".json")).length,
      syncState:
        state.lastError
          ? "error"
          : queued.length
            ? state.connection.state === "connected"
              ? "syncing"
              : "local-saved"
            : state.lastSyncAt
              ? "up-to-date"
              : "local-saved",
      lastSyncAt: state.lastSyncAt,
      lastError: state.lastError,
      lastWarning: state.lastWarning,
    };
  }

  async function emitStatus() {
    onStatus(await status());
  }

  function scheduleFlush() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => void flush(), syncDelayMs);
    idleTimer.unref?.();
    if (!maxTimer) {
      maxTimer = setTimeout(() => void flush(), maxSyncDelayMs);
      maxTimer.unref?.();
    }
  }

  async function updatePreferences(preferences) {
    const state = await loadState();
    const nextPreferences = safePreferences(preferences);
    const next = {
      ...state,
      preferences: nextPreferences,
      lastWarning: nextPreferences.audio ? state.lastWarning : "",
    };
    await persistState(next);
    await reconcileOutbox(next);
    if (hasCloudBackupCategory(next.preferences)) scheduleFlush();
    await emitStatus();
    return status();
  }

  async function reconcileOutbox(state) {
    await mkdir(outboxPath, { recursive: true });
    const shouldQueue = hasCloudBackupCategory(state.preferences);
    for (const documentId of Object.keys(state.documents)) {
      const outboxFile = path.join(outboxPath, `${documentId}.json`);
      if (!shouldQueue) {
        await rm(outboxFile, { force: true });
        continue;
      }
      const current = await readJson(
        path.join(documentsPath, documentId, "current.json"),
        null,
      );
      if (current) await writeJsonAtomic(outboxFile, current);
    }
  }

  async function updateConnection(connection) {
    const state = await loadState();
    const next = {
      ...state,
      connection: safeConnection(connection),
      lastError:
        connection?.state === "error"
          ? String(connection.error || "Cloud connection failed.")
          : "",
    };
    await persistState(next);
    if (next.connection.state === "connected") scheduleFlush();
    await emitStatus();
    return status();
  }

  async function updateProvider(providerId, connection = null) {
    const state = await loadState();
    const nextProviderId = safeProviderId(providerId);
    const next = {
      ...state,
      providerId: nextProviderId,
      connection: safeConnection(
        connection ?? { state: "disconnected", accountEmail: "" },
      ),
      quota: null,
      lastError:
        connection?.state === "error"
          ? String(connection.error || "Cloud connection failed.")
          : "",
      lastWarning: "",
    };
    await persistState(next);
    await reconcileOutbox(next);
    if (next.connection.state === "connected") scheduleFlush();
    await emitStatus();
    return status();
  }

  async function updateQuota(quota) {
    const state = await loadState();
    const next = parseState({ ...state, quota });
    await persistState(next);
    await emitStatus();
    return status();
  }

  function stageSnapshot(snapshot, reason = "edit") {
    safeSnapshot(snapshot);
    writeQueue = writeQueue
      .catch(() => {})
      .then(async () => {
        const documentId = documentIdentity(snapshot);
        const documentRoot = path.join(documentsPath, documentId);
        const timestamp = now().toISOString();
        const current = {
          version: 1,
          documentId,
          reason,
          savedAt: timestamp,
          snapshot: { ...snapshot, residency: "vault-local" },
        };
        await mkdir(documentRoot, { recursive: true });
        const journalPath = path.join(documentRoot, "journal.ndjson");
        await appendFile(
          journalPath,
          `${JSON.stringify(current)}\n`,
          "utf8",
        );
        await compactJournal(journalPath, now().getTime());
        await writeJsonAtomic(path.join(documentRoot, "current.json"), current);

        const state = await loadState();
        await mkdir(outboxPath, { recursive: true });
        if (hasCloudBackupCategory(state.preferences)) {
          await writeJsonAtomic(path.join(outboxPath, `${documentId}.json`), current);
        } else {
          await rm(path.join(outboxPath, `${documentId}.json`), { force: true });
        }
        await persistState({
          ...state,
          documents: {
            ...state.documents,
            [documentId]: {
              documentId,
              fileName: snapshot.fileName,
              sourcePath: snapshot.activeDocumentPath || "",
              residency: "vault-local",
              updatedAt: timestamp,
            },
          },
          lastError: "",
        });
        if (hasCloudBackupCategory(state.preferences)) scheduleFlush();
        await emitStatus();
        return { saved: true, documentId, residency: "vault-local" };
      });
    return writeQueue;
  }

  function flush() {
    if (idleTimer) clearTimeout(idleTimer);
    if (maxTimer) clearTimeout(maxTimer);
    idleTimer = null;
    maxTimer = null;
    flushQueue = flushQueue
      .catch(() => {})
      .then(async () => {
        const state = await loadState();
        const activeProvider = providerFor(state.providerId);
        if (!activeProvider || state.connection.state !== "connected") {
          await emitStatus();
          return { synced: 0, deferred: true };
        }
        const names = (await readdir(outboxPath).catch(() => [])).filter((name) => name.endsWith(".json"));
        let synced = 0;
        try {
          const quota = (await activeProvider.getQuota?.()) ?? null;
          await updateQuota(quota);
          const freshState = await loadState();
          for (const name of names) {
            const item = await readJson(path.join(outboxPath, name), null);
            if (!item) continue;
            const snapshot = item.snapshot;
            const mediaAllowed = quotaAllowsMedia(freshState.quota);
            let audioAssets = [];
            let audioPreparationError = "";
            if (freshState.preferences.audio && mediaAllowed) {
              try {
                audioAssets = await prepareAudioAssets(snapshot);
              } catch (error) {
                audioPreparationError =
                  error instanceof Error
                    ? error.message
                    : "Audio compression is not available.";
              }
            }
            const payload = {
              ...snapshot,
              content: freshState.preferences.textAndStructure
                ? snapshot.content
                : "",
              annotations: freshState.preferences.textAndStructure
                ? snapshot.annotations ?? []
                : [],
              assets:
                freshState.preferences.optimizedImages && mediaAllowed
                  ? snapshot.assets ?? []
                  : [],
              audioAssets,
              attachments:
                freshState.preferences.otherAttachments && mediaAllowed
                  ? snapshot.attachments ?? []
                  : [],
              versions:
                freshState.preferences.textAndStructure &&
                freshState.preferences.versionHistory
                ? retainedVersions(snapshot.versions, now().getTime())
                : [],
              backupCategories: {
                textAndStructure: freshState.preferences.textAndStructure,
                optimizedImages:
                  freshState.preferences.optimizedImages && mediaAllowed,
                audio: freshState.preferences.audio && mediaAllowed,
                otherAttachments:
                  freshState.preferences.otherAttachments && mediaAllowed,
                versionHistory:
                  freshState.preferences.textAndStructure &&
                  freshState.preferences.versionHistory,
              },
            };
            const remote = await activeProvider.uploadDocument({
              documentId: item.documentId,
              payload,
              preferences: freshState.preferences,
            });
            if (audioPreparationError) {
              const latest = await loadState();
              const document = latest.documents[item.documentId] ?? {};
              await persistState({
                ...latest,
                documents: {
                  ...latest.documents,
                  [item.documentId]: {
                    ...document,
                    residency: "vault-local",
                    remoteId: remote?.remoteId ?? document.remoteId ?? "",
                  },
                },
                lastWarning: `فایل صوتی هنوز فشرده و ارسال نشده است: ${audioPreparationError}`,
                lastError: "",
              });
              continue;
            }
            await rm(path.join(outboxPath, name), { force: true });
            const latest = await loadState();
            const document = latest.documents[item.documentId] ?? {};
            await persistState({
              ...latest,
              documents: {
                ...latest.documents,
                [item.documentId]: {
                  ...document,
                  residency: "backed-up",
                  remoteId: remote?.remoteId ?? document.remoteId ?? "",
                  remoteIds: {
                    ...(document.remoteIds ?? {}),
                    [freshState.providerId]:
                      remote?.remoteId ??
                      document.remoteIds?.[freshState.providerId] ??
                      "",
                  },
                  syncedAt: now().toISOString(),
                },
              },
              lastSyncAt: now().toISOString(),
              lastError: "",
              lastWarning: "",
            });
            synced += 1;
          }
          await emitStatus();
          return { synced, deferred: false };
        } catch (error) {
          const latest = await loadState();
          await persistState({
            ...latest,
            lastError:
              error instanceof Error ? error.message : "Cloud sync failed.",
          });
          await emitStatus();
          return { synced, deferred: false, error: true };
        }
      });
    return flushQueue;
  }

  async function documentResidency(snapshot) {
    const state = await loadState();
    return state.documents[documentIdentity(snapshot)]?.residency ?? "reading";
  }

  function dispose() {
    if (idleTimer) clearTimeout(idleTimer);
    if (maxTimer) clearTimeout(maxTimer);
    idleTimer = null;
    maxTimer = null;
  }

  return {
    status,
    updatePreferences,
    updateProvider,
    updateConnection,
    updateQuota,
    stageSnapshot,
    documentResidency,
    flush,
    dispose,
    paths: { rootPath, statePath, documentsPath, outboxPath },
  };
}
