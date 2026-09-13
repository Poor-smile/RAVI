import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import * as nativeFs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createWindowsReplacement } from "./windows-save-permissions.mjs";

const platformFs = process.platform === "win32"
  ? { ...nativeFs, copyFile: createWindowsReplacement }
  : nativeFs;

// Resolve aliases in submission order, but let different files write in parallel.
export function createFileTaskQueue({ fs = nativeFs } = {}) {
  const pending = new Map();
  let resolving = Promise.resolve();
  return (filePath, task) => {
    const submittedPath = path.resolve(filePath);
    const resolved = resolving.then(async () => {
      let target;
      try {
        target = await fs.realpath(submittedPath);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        // A dangling link must not be silently replaced by a regular file.
        const entry = await fs.lstat(submittedPath).catch((failure) => {
          if (failure.code !== "ENOENT") throw failure;
          return null;
        });
        if (entry?.isSymbolicLink()) throw error;
        target = path.join(await fs.realpath(path.dirname(submittedPath)), path.basename(submittedPath));
      }
      const key = process.platform === "win32" ? target.toLowerCase() : target;
      const result = (pending.get(key) ?? Promise.resolve()).then(() => task(target));
      const settled = result.catch(() => {});
      pending.set(key, settled);
      void settled.then(() => {
        if (pending.get(key) === settled) pending.delete(key);
      });
      return { result };
    });
    resolving = resolved.then(() => {}, () => {});
    return resolved.then(({ result }) => result);
  };
}

export async function writeAll(file, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const { bytesWritten } = await file.write(bytes, offset, bytes.length - offset);
    if (!Number.isInteger(bytesWritten) || bytesWritten <= 0) {
      throw Object.assign(new Error("File write made no progress."), { code: "EIO" });
    }
    offset += bytesWritten;
  }
}

export function createAtomicFileWriter({ fs = platformFs } = {}) {
  const enqueue = createFileTaskQueue({ fs });
  return (filePath, content) => {
    const bytes = Buffer.from(content); // Callers cannot mutate an enqueued save.
    return enqueue(filePath, async (target) => {
      const started = performance.now();
      const timings = [];
      const mark = (stage) => { if (process.env.RAAVI_PERFORMANCE_TRACE === "1") timings.push({ stage, elapsedMs: performance.now() - started }); };
      const temporary = path.join(path.dirname(target), `.raavi-save-${randomUUID()}.tmp`);
      let ownedTemporary = false;
      let file;
      try {
        const previous = await fs.stat(target).catch((error) => {
          if (error.code !== "ENOENT") throw error;
          return null;
        });
        if (previous) {
          if (!previous.isFile()) throw Object.assign(new Error("Save target is not a file."), { code: "EISDIR" });
          // Check write permission without truncating the original. On Windows,
          // create the replacement with the original security descriptor.
          const original = await fs.open(target, "r+");
          await original.close();
          await fs.copyFile(target, temporary, constants.COPYFILE_EXCL);
          mark("replacement-created");
          ownedTemporary = true;
          file = await fs.open(temporary, "r+");
          if (process.platform !== "win32") {
            const copied = await file.stat();
            if (copied.uid !== previous.uid || copied.gid !== previous.gid) {
              await file.chown(previous.uid, previous.gid);
            }
            await file.chmod(previous.mode & 0o777);
          }
          await file.truncate(0);
        } else {
          file = await fs.open(temporary, "wx", 0o666);
          ownedTemporary = true;
        }
        await writeAll(file, bytes);
        mark("bytes-written");
        await file.sync();
        mark("file-synced");
        await file.close();
        file = null;
        // Never delete or truncate the original if replacement is refused.
        for (let attempt = 0; ; attempt += 1) {
          try {
            await fs.rename(temporary, target);
            break;
          } catch (error) {
            // Windows indexers/readers can briefly deny replacement. Retrying
            // never entails unlinking the original or changing its contents.
            if (process.platform !== "win32" || attempt >= 5 || !["EPERM", "EACCES", "EBUSY"].includes(error.code)) throw error;
            await delay(10 * 2 ** attempt);
          }
        }
        ownedTemporary = false;
        mark("renamed");
        if (process.platform !== "win32") {
          const directory = await fs.open(path.dirname(target), "r");
          try {
            await directory.sync();
          } finally {
            await directory.close();
          }
        }
      } finally {
        await file?.close().catch(() => {});
        if (ownedTemporary) await fs.rm(temporary, { force: true }).catch(() => {});
        if (process.env.RAAVI_PERFORMANCE_TRACE === "1") console.log("[raavi-performance]", JSON.stringify({ operation: "atomic-write", bytes: bytes.length, timings }));
      }
    });
  };
}

export const atomicWriteFile = createAtomicFileWriter();
