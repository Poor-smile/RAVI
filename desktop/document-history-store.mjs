import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { normalizedPathKey } from "./document-access.mjs";
import { atomicWriteFile } from "./atomic-file.mjs";

export function createDocumentHistoryStore(directory, legacyPath, storage, maxVersions = 30, maxDocuments = 50) {
  const marker = path.join(directory, "migration.json");
  let migration;
  let queue = Promise.resolve();
  const recordPath = file => path.join(directory, `${createHash("sha256").update(normalizedPathKey(file)).digest("hex")}.json`);
  const writeRecord = async record => {
    const value = { ...record, path: path.resolve(record.path), versions: (record.versions ?? []).slice(-maxVersions) };
    await storage.write(recordPath(value.path), value, { path: value.path, updatedAt: value.updatedAt });
  };
  const prune = async () => {
    const records = [];
    for (const name of await readdir(directory)) {
      if (!/^[a-f0-9]{64}\.json$/u.test(name)) continue;
      const file = path.join(directory, name);
      const manifest = JSON.parse(await readFile(file, "utf8"));
      records.push({ file, updatedAt: Date.parse(manifest.meta?.updatedAt ?? "") || 0 });
    }
    records.sort((a, b) => b.updatedAt - a.updatedAt);
    for (const { file } of records.slice(maxDocuments)) await rename(file, `${file}.retired-${Date.now()}`);
  };
  const ensure = () => migration ??= storage.withMutation(async () => {
    await mkdir(directory, { recursive: true });
    try { await stat(marker); return; } catch (error) { if (error.code !== "ENOENT") throw error; }
    let legacy;
    try { legacy = JSON.parse(await readFile(legacyPath, "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    for (const [key, item] of Object.entries(legacy?.documents ?? {})) {
      const record = { ...item, path: item.path ?? key };
      // Resume an interrupted migration without overwriting a committed record.
      try { await stat(recordPath(record.path)); }
      catch (error) { if (error.code !== "ENOENT") throw error; await writeRecord(record); }
    }
    await prune();
    await atomicWriteFile(marker, JSON.stringify({ version: 1, migratedAt: new Date().toISOString() }));
  }).catch(error => { migration = undefined; throw error; });
  const serialize = task => {
    const result = queue.then(() => storage.withMutation(task));
    queue = result.catch(() => {});
    return result;
  };
  const read = async file => {
    await ensure();
    const record = await storage.read(recordPath(file));
    return record ? {
      revision: Number.isSafeInteger(record.revision) && record.revision > 0 ? record.revision : 1,
      versions: Array.isArray(record.versions) ? record.versions.slice(-maxVersions) : [],
    } : { revision: 1, versions: [] };
  };
  const write = (file, revision, versions) => serialize(async () => {
    await ensure();
    await writeRecord({ path: file, revision, versions, updatedAt: new Date().toISOString() });
    await prune();
  });
  const remap = map => serialize(async () => {
    await ensure();
    for (const name of await readdir(directory)) {
      if (!/^[a-f0-9]{64}\.json$/u.test(name)) continue;
      const original = path.join(directory, name);
      const manifest = JSON.parse(await readFile(original, "utf8"));
      const next = map(manifest.meta?.path);
      if (!next) continue;
      const record = await storage.read(original);
      await writeRecord({ ...record, path: next });
      const target = recordPath(next);
      // Keep an archived manifest for recovery without listing it as current.
      if (target !== original) await rename(original, `${original}.moved-${Date.now()}`);
    }
  });
  return { read, write, remap, flush: async () => { await queue; } };
}
