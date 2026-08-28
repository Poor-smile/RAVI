import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

function safeArchiveTarget(destination, entryName) {
  const root = path.resolve(destination);
  const target = path.resolve(root, entryName.replaceAll("\\", "/"));
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("ساختار بستهٔ موتور صوتی معتبر نیست.");
  }
  return target;
}

export async function extractZipArchive(archivePath, destination) {
  const archive = await JSZip.loadAsync(await readFile(archivePath), {
    checkCRC32: true,
  });
  await mkdir(destination, { recursive: true });
  for (const entry of Object.values(archive.files)) {
    const target = safeArchiveTarget(destination, entry.name);
    if (entry.dir) {
      await mkdir(target, { recursive: true });
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await entry.async("nodebuffer"));
  }
}

export const __zipExtractTesting = { safeArchiveTarget };
