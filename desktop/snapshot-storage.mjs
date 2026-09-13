import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile } from "./atomic-file.mjs";

const FORMAT = "raavi-snapshot/1";
const EXTERNAL_STRING_LENGTH = 4096;
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

// The manifest commits last. Immutable string blobs can be shared by active
// text, saved text, tab checkpoints and history without duplicating their bytes.
// Tagged nodes also keep arbitrary user metadata distinct from storage refs.
export function createSnapshotStorage(directory, { writeAtomic = atomicWriteFile, manifests = [], automaticCollection = false } = {}) {
  const blobs = path.join(directory, "strings");
  const known = new Set();
  const writing = new Map();
  const registered = new Set(manifests);
  let activeWrites = 0;
  let activeReads = 0;
  let collecting = null;
  let collectionTimer;
  async function storeString(value) {
    const bytes = Buffer.from(JSON.stringify(value)); // Preserve lone surrogates too.
    const hash = digest(bytes);
    if (known.has(hash)) return hash;
    if (!writing.has(hash)) {
      writing.set(hash, (async () => {
        await mkdir(blobs, { recursive: true });
        const file = path.join(blobs, `${hash}.json`);
        try {
          if (digest(await readFile(file)) !== hash) throw new Error("Snapshot blob failed integrity validation.");
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          await writeAtomic(file, bytes);
        }
        if (known.size >= 4096) known.clear();
        known.add(hash);
      })().finally(() => writing.delete(hash)));
    }
    await writing.get(hash);
    return hash;
  }
  async function encode(value, strings, key) {
    if (key === "lastSavedSnapshot" && typeof value === "string" && value.length >= EXTERNAL_STRING_LENGTH) {
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch { /* Non-canonical or legacy strings retain their exact bytes. */ }
      if (parsed !== undefined && JSON.stringify(parsed) === value) return ["j", await encode(parsed, strings)];
    }
    if (typeof value === "string" && value.length >= EXTERNAL_STRING_LENGTH) {
      if (!strings.has(value)) strings.set(value, storeString(value));
      return ["s", await strings.get(value)];
    }
    if (Array.isArray(value)) {
      const items = [];
      for (const item of value) items.push(await encode(item, strings));
      return ["a", items];
    }
    if (value && typeof value === "object") {
      const entries = [];
      for (const [key, item] of Object.entries(value)) {
        if (item !== undefined) entries.push([key, await encode(item, strings, key)]);
      }
      return ["o", entries];
    }
    if (value === undefined) return ["v", null];
    if (!["string", "number", "boolean"].includes(typeof value) && value !== null) throw new Error("Snapshot contains unsupported data.");
    return ["v", value];
  }
  async function decode(node, strings) {
    if (!Array.isArray(node) || node.length !== 2) throw new Error("Invalid snapshot node.");
    const [kind, value] = node;
    if (kind === "v") return value;
    if (kind === "j") return JSON.stringify(await decode(value, strings));
    if (kind === "s") {
      if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) throw new Error("Invalid snapshot reference.");
      if (!strings.has(value)) strings.set(value, (async () => {
        const bytes = await readFile(path.join(blobs, `${value}.json`));
        if (digest(bytes) !== value) throw new Error("Snapshot blob failed integrity validation.");
        const text = JSON.parse(bytes.toString("utf8"));
        if (typeof text !== "string") throw new Error("Invalid snapshot string.");
        return text;
      })());
      return strings.get(value);
    }
    if (!Array.isArray(value)) throw new Error("Invalid snapshot collection.");
    if (kind === "a") return Promise.all(value.map(item => decode(item, strings)));
    if (kind === "o") return Object.fromEntries(await Promise.all(value.map(async ([key, item]) => [key, await decode(item, strings)])));
    throw new Error("Unknown snapshot node.");
  }
  const read = async (file, fallback = null) => {
    registered.add(file);
    while (collecting) await collecting;
    activeReads++;
    try {
    let value;
    try { value = JSON.parse(await readFile(file, "utf8")); }
    catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
    return value?.format === FORMAT ? await decode(value.root, new Map()) : value;
    } finally { activeReads--; }
  };
  const write = async (file, value, meta) => {
    while (collecting) await collecting;
    activeWrites++;
    registered.add(file);
    try {
    const root = await encode(value, new Map());
    // Keep the legacy representation intact for migration review/recovery.
    try {
      const previous = await readFile(file, "utf8");
      if (JSON.parse(previous)?.format !== FORMAT) {
        const backup = `${file}.legacy.json`;
        try { await stat(backup); }
        catch (error) { if (error.code !== "ENOENT") throw error; await writeAtomic(backup, previous); }
      }
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    await writeAtomic(file, JSON.stringify({ format: FORMAT, root, meta }));
    } finally {
      activeWrites--;
      if (automaticCollection && !activeWrites) {
        clearTimeout(collectionTimer);
        collectionTimer = setTimeout(() => { void collect().catch(() => {}); }, 2000);
        collectionTimer.unref();
      }
    }
  };
  const collect = () => {
    if (collecting) return collecting;
    if (activeWrites || activeReads) return Promise.resolve({ removed: 0 });
    collecting = (async () => {
      const files = new Set(registered);
      const expiredArchives = [];
      const scan = async root => {
        let entries;
        try { entries = await readdir(root, { withFileTypes: true }); }
        catch (error) { if (error.code === "ENOENT") return; throw error; }
        for (const entry of entries) {
          const file = path.join(root, entry.name);
          if (entry.isDirectory() && file !== blobs) await scan(file);
          else if (entry.isFile()) {
            const archive = /^[a-f0-9]{64}\.json\.(?:moved|retired)-(\d+)$/u.exec(entry.name);
            if (archive && Date.now() - Number(archive[1]) > 24 * 60 * 60 * 1000) expiredArchives.push(file);
            else if (entry.name.endsWith(".json") || archive) files.add(file);
          }
        }
      };
      await scan(directory);
      const used = new Set();
      const visit = node => {
        if (!Array.isArray(node)) throw new Error("Invalid manifest during collection.");
        if (node[0] === "s") used.add(node[1]);
        else if (node[0] === "j") visit(node[1]);
        else if (node[0] === "a") node[1].forEach(visit);
        else if (node[0] === "o") node[1].forEach(([, value]) => visit(value));
        else if (node[0] !== "v") throw new Error("Unknown manifest node during collection.");
      };
      for (const file of files) {
        let value;
        try { value = JSON.parse(await readFile(file, "utf8")); }
        catch (error) { if (error.code === "ENOENT") continue; throw error; }
        if (value?.format === FORMAT) visit(value.root);
      }
      let removed = 0;
      for (const file of expiredArchives) await unlink(file);
      for (const name of await readdir(blobs).catch(error => { if (error.code === "ENOENT") return []; throw error; })) {
        if (!/^[a-f0-9]{64}\.json$/u.test(name) || used.has(name.slice(0, -5))) continue;
        // Only owned, unreachable blob files are removed. Writers wait until
        // collection finishes, so no pending manifest can acquire a deleted ref.
        await unlink(path.join(blobs, name));
        known.delete(name.slice(0, -5));
        removed++;
      }
      return { removed };
    })().finally(() => { collecting = null; });
    return collecting;
  };
  const withMutation = async task => {
    while (collecting) await collecting;
    activeWrites++;
    try { return await task(); }
    finally {
      activeWrites--;
      if (automaticCollection && !activeWrites) {
        clearTimeout(collectionTimer);
        collectionTimer = setTimeout(() => { void collect().catch(() => {}); }, 2000);
        collectionTimer.unref();
      }
    }
  };
  return { read, write, collect, withMutation };
}
