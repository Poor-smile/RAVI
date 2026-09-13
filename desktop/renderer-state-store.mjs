import { readFile } from "node:fs/promises";
import { atomicWriteFile } from "./atomic-file.mjs";

export function mergeReadingPositions(...maps) {
  const result = {};
  for (const map of maps) {
    if (!map || typeof map !== "object" || Array.isArray(map)) continue;
    for (const [key, record] of Object.entries(map)) {
      if (!Object.hasOwn(result, key) || Number(record?.updatedAt ?? 0) >= Number(result[key]?.updatedAt ?? 0)) {
        Object.defineProperty(result, key, { value: record, enumerable: true, writable: true, configurable: true });
      }
    }
  }
  return result;
}

export function createRendererStateStore(file, positionsFile, storage) {
  let latest;
  let positions = {};
  let loading;
  let running = null;
  let pendingSnapshot = false;
  let pendingPositions = false;
  let waiters = [];
  let dirtySnapshot = false;
  let dirtyPositions = false;
  const load = () => loading ??= (async () => {
    const snapshot = await storage.read(file);
    let savedPositions;
    try { savedPositions = JSON.parse(await readFile(positionsFile, "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (latest === undefined) latest = snapshot;
    positions = mergeReadingPositions(snapshot?.readingPositions, savedPositions, positions);
  })().catch(error => { loading = undefined; throw error; });
  const persistPositions = async () => {
    const current = positions;
    await atomicWriteFile(positionsFile, JSON.stringify(current));
    if (positions === current) dirtyPositions = false;
  };
  const read = async () => {
    await load();
    return latest ? { ...latest, readingPositions: positions } : Object.keys(positions).length ? { readingPositions: positions } : null;
  };
  const drain = async () => {
    while (pendingSnapshot || pendingPositions) {
      const snapshot = pendingSnapshot ? latest : null;
      const currentWaiters = waiters;
      pendingSnapshot = false;
      pendingPositions = false;
      waiters = [];
      try {
        await load();
        await persistPositions();
        if (snapshot) {
          await storage.write(file, { ...snapshot, readingPositions: undefined });
          if (latest === snapshot) dirtySnapshot = false;
        }
        currentWaiters.forEach(waiter => waiter.resolve({ saved: true }));
      } catch (error) {
        currentWaiters.forEach(waiter => waiter.reject(error));
      }
    }
  };
  const start = () => {
    if (!running) running = drain().finally(() => {
      running = null;
      if (pendingSnapshot || pendingPositions) start();
    });
  };
  const enqueue = () => {
    const result = new Promise((resolve, reject) => waiters.push({ resolve, reject }));
    start();
    return result;
  };
  const write = snapshot => {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return Promise.reject(new Error("Renderer state is invalid."));
    latest = snapshot;
    positions = mergeReadingPositions(positions, snapshot.readingPositions);
    dirtySnapshot = true;
    dirtyPositions = true;
    // Only one disk write is in flight. Replace queued snapshots with the
    // newest state, so the final close checkpoint cannot sit behind a long
    // sequence of obsolete edits or reading-position updates. Every caller
    // is acknowledged only after its batch reaches durable storage.
    pendingSnapshot = true;
    pendingPositions = true;
    return enqueue();
  };
  const writePositions = incoming => {
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return Promise.reject(new Error("Renderer reading positions are invalid."));
    positions = mergeReadingPositions(positions, incoming);
    dirtyPositions = true;
    pendingPositions = true;
    return enqueue();
  };
  const flush = async () => {
    while (running) await running;
    if (dirtySnapshot) await write(latest);
    else if (dirtyPositions) await writePositions(positions);
  };
  return { read, write, writePositions, flush, hasUncommitted: () => running !== null || dirtySnapshot || dirtyPositions };
}
