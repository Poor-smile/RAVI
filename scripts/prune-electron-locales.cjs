/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs/promises");
const path = require("node:path");

const KEEP_LOCALES = new Set(["en-US.pak", "fa.pak"]);

async function fileSize(filePath) {
  try {
    const details = await fs.stat(filePath);
    return details.size;
  } catch {
    return 0;
  }
}

async function pruneLocales(appOutDir) {
  const localesDir = path.join(appOutDir, "locales");
  let entries;
  try {
    entries = await fs.readdir(localesDir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { deleted: 0, kept: 0, savedBytes: 0, localesDir };
    }
    throw error;
  }

  let deleted = 0;
  let kept = 0;
  let savedBytes = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".pak")) continue;

    const localePath = path.join(localesDir, entry.name);
    if (KEEP_LOCALES.has(entry.name)) {
      kept += 1;
      continue;
    }

    savedBytes += await fileSize(localePath);
    await fs.rm(localePath);
    deleted += 1;
  }

  return { deleted, kept, savedBytes, localesDir };
}

async function run(appOutDir) {
  const result = await pruneLocales(appOutDir);
  const savedMb = (result.savedBytes / 1024 / 1024).toFixed(2);
  console.log(
    `Pruned Electron locales in ${result.localesDir}: kept ${result.kept}, deleted ${result.deleted}, saved ${savedMb} MB.`,
  );
}

module.exports = async function afterPack(context) {
  await run(context.appOutDir);
};

if (require.main === module) {
  const appOutDir = process.argv[2];
  if (!appOutDir) {
    console.error("Usage: node scripts/prune-electron-locales.cjs <appOutDir>");
    process.exit(1);
  }

  run(path.resolve(appOutDir)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
