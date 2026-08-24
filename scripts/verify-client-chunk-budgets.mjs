import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultAssetsDirectory = path.join(projectRoot, "dist", "client", "assets");
const budgetFile = path.join(
  projectRoot,
  "app",
  "release",
  "client-chunk-budgets.json",
);

export async function readClientChunkBudgets() {
  const raw = await readFile(budgetFile, "utf8");
  return JSON.parse(raw);
}

export async function inspectClientChunkBudgets(
  assetsDirectory = defaultAssetsDirectory,
) {
  const config = await readClientChunkBudgets();
  const files = await readdir(assetsDirectory);
  const results = [];

  for (const [id, budget] of Object.entries(config.artifacts)) {
    const matcher = new RegExp(budget.pattern, "u");
    const matches = files.filter((fileName) => matcher.test(fileName));
    if (matches.length !== 1) {
      results.push({
        id,
        label: budget.label,
        status: "missing",
        matches,
        maxBytes: budget.maxBytes,
      });
      continue;
    }

    const fileName = matches[0];
    const metadata = await stat(path.join(assetsDirectory, fileName));
    results.push({
      id,
      label: budget.label,
      status: metadata.size <= budget.maxBytes ? "pass" : "over",
      fileName,
      bytes: metadata.size,
      baselineBytes: budget.baselineBytes,
      maxBytes: budget.maxBytes,
    });
  }

  return results;
}

function kib(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

export async function verifyClientChunkBudgets(
  assetsDirectory = defaultAssetsDirectory,
) {
  const results = await inspectClientChunkBudgets(assetsDirectory);
  let failed = false;

  for (const result of results) {
    if (result.status === "missing") {
      failed = true;
      console.error(
        `[chunk-budget] FAIL ${result.label}: expected exactly one artifact, found ${result.matches.length}.`,
      );
      continue;
    }

    const change = result.bytes - result.baselineBytes;
    const changeLabel = `${change >= 0 ? "+" : ""}${kib(change)}`;
    const line = `[chunk-budget] ${result.status === "pass" ? "PASS" : "FAIL"} ${result.label}: ${kib(result.bytes)} / ${kib(result.maxBytes)} (${changeLabel} from baseline) — ${result.fileName}`;
    if (result.status === "pass") {
      console.log(line);
    } else {
      failed = true;
      console.error(line);
    }
  }

  if (failed) {
    throw new Error("Client chunk budget exceeded or artifact could not be resolved.");
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyClientChunkBudgets().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
