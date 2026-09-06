import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
const mismatches = [];
const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (lock.lockfileVersion !== 3) mismatches.push({ error: "Expected npm lockfileVersion 3" });
for (const field of ["name", "version", "dependencies", "devDependencies", "optionalDependencies", "engines"]) {
  const stable = (value) => JSON.stringify(value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
  if (stable(manifest[field]) !== stable(lock.packages?.[""]?.[field])) {
    mismatches.push({ field, error: "package.json differs from the lockfile root" });
  }
}
for (const conflicting of ["pnpm-lock.yaml", "pnpm-workspace.yaml", "yarn.lock", "bun.lock", "bun.lockb", "node_modules/.modules.yaml"]) {
  try {
    await readFile(path.join(root, conflicting));
    mismatches.push({ location: conflicting, error: "Only npm and package-lock.json are supported" });
  } catch (error) {
    if (error.code !== "ENOENT") mismatches.push({ location: conflicting, error: error.code ?? error.message });
  }
}
for (const [location, expected] of Object.entries(lock.packages ?? {})) {
  if (!location || !expected.version) continue;
  try {
    const installed = JSON.parse(await readFile(path.join(root, location, "package.json"), "utf8"));
    if (installed.version !== expected.version) {
      mismatches.push({ location, locked: expected.version, installed: installed.version });
    }
  } catch (error) {
    // Optional dependencies can legitimately target a different OS or CPU.
    if (error.code === "ENOENT" && expected.optional) continue;
    mismatches.push({ location, locked: expected.version, error: error.code ?? error.message });
  }
}
console.log(JSON.stringify({ consistent: mismatches.length === 0, mismatches }, null, 2));
if (mismatches.length) process.exitCode = 1;
