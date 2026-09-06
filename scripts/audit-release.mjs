import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Start the audit with npm run audit:release.");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = path.resolve(root, process.env.RAAVI_AUDIT_DIR ?? `.artifacts/release-audit-${stamp}`);
await mkdir(output, { recursive: true });
const env = { ...process.env, RAAVI_AUDIT_DIR: output };
if (env.FORCE_COLOR !== undefined) delete env.NO_COLOR;
const results = [];

async function run(name, args, { requiresBuild = false, json = false } = {}) {
  if (requiresBuild && !results.some((result) => result.name === "build" && result.exitCode === 0)) {
    results.push({ name, status: "blocked", reason: "Production build did not pass." });
    return;
  }
  console.log(`[release-audit] ${name}`);
  const startedAt = new Date().toISOString();
  const logPath = path.join(output, `${name}.${json ? "json" : "log"}`);
  const log = createWriteStream(logPath);
  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.once("error", (error) => { log.write(error.message); resolve(1); });
    child.once("close", (code) => resolve(code ?? 1));
  });
  await new Promise((resolve) => log.end(resolve));
  results.push({ name, status: exitCode === 0 ? "passed" : "failed", exitCode, startedAt, finishedAt: new Date().toISOString(), logPath });
  await writeFile(path.join(output, "stages.json"), JSON.stringify(results, null, 2));
}

// Continue independent checks after a failure, so an audit reports all findings.
await run("dependency-lock", ["scripts/verify-dependency-lock.mjs"], { json: true });
await run("lint", [npmCli, "run", "lint"]);
await run("typecheck", [npmCli, "run", "typecheck"]);
await run("build", [npmCli, "run", "build"]);
await run("unit", ["scripts/run-unit-tests.mjs"], { requiresBuild: true });
await run("browser", ["node_modules/playwright/cli.js", "test", "--config", "tests/public-release.config.ts"], { requiresBuild: true });
await run("npm-audit", [npmCli, "audit", "--json"], { json: true });
if (process.platform === "win32") {
  await run("packaging", [npmCli, "run", "smoke:electron"], { requiresBuild: true });
} else {
  results.push({ name: "packaging", status: "blocked", reason: "Windows packaging must be checked on Windows." });
}
await writeFile(path.join(output, "stages.json"), JSON.stringify(results, null, 2));
console.log(`[release-audit] Evidence: ${output}`);
if (results.some((result) => result.status !== "passed")) process.exitCode = 1;
