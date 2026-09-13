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
  let queue = Promise.resolve();
  let running = 0;
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
  const enqueue = task => {
    running++;
    const result = queue.then(task).finally(() => { running--; });
    queue = result.catch(() => {});
    return result;
  };
  const persistPositions = async () => {
    const current = positions;
    await atomicWriteFile(positionsFile, JSON.stringify(current));
    if (positions === current) dirtyPositions = false;
  };
  const read = async () => {
    await load();
    return latest ? { ...latest, readingPositions: positions } : Object.keys(positions).length ? { readingPositions: positions } : null;
  };
  const write = snapshot => {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return Promise.reject(new Error("Renderer state is invalid."));
    latest = snapshot;
    positions = mergeReadingPositions(positions, snapshot.readingPositions);
    dirtySnapshot = true;
    dirtyPositions = true;
    return enqueue(async () => {
      await load();
      await persistPositions();
      // Reading anchors have a small independent checkpoint. They no longer
      // force JSON parsing or rewriting all text/history during pagehide.
      await storage.write(file, { ...snapshot, readingPositions: undefined });
      if (latest === snapshot) dirtySnapshot = false;
      return { saved: true };
    });
  };
  const writePositions = incoming => {
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return Promise.reject(new Error("Renderer reading positions are invalid."));
    positions = mergeReadingPositions(positions, incoming);
    dirtyPositions = true;
    return enqueue(async () => {
      await load();
      await persistPositions();
      return { saved: true };
    });
  };
  const flush = async () => {
    await queue;
    if (dirtySnapshot) await write(latest);
    else if (dirtyPositions) await writePositions(positions);
  };
  return { read, write, writePositions, flush, hasUncommitted: () => running > 0 || dirtySnapshot || dirtyPositions };
}
