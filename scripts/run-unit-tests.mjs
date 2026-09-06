import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const files = (await readdir(path.join(root, "tests")))
  .filter((name) => /\.test\.(?:ts|mjs)$/.test(name))
  .sort()
  .map((name) => path.join(root, "tests", name));
if (!files.length) throw new Error("No unit tests found.");
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=4", ...files], {
  cwd: root, stdio: "inherit", env: process.env,
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
