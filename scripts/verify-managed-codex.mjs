import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { installManagedCodex } from "../desktop/managed-codex.mjs";
import { MANAGED_CODEX_VERSION } from "../desktop/managed-codex-manifest.mjs";

// Only download into an isolated temporary folder; never log in or change an account.
const temporary = path.resolve(tmpdir());
const root = await mkdtemp(path.join(temporary, "raavi-managed-verification-"));
try {
  const executable = await installManagedCodex(root);
  const env = { ...process.env, PATH: process.platform === "win32"
    ? path.join(process.env.SystemRoot || "C:\\Windows", "System32")
    : "/usr/bin:/bin" };
  const { stdout } = await promisify(execFile)(executable, ["--version"], { env, windowsHide: true, timeout: 30_000 });
  if (stdout.trim() !== `codex-cli ${MANAGED_CODEX_VERSION}`) throw new Error("Managed Codex version mismatch.");
  if (await installManagedCodex(root) !== executable) throw new Error("Managed Codex reuse failed.");
  console.log(JSON.stringify({ platform: process.platform, arch: process.arch, version: stdout.trim(), install: "passed", reuse: "passed", systemNodeNpm: "not required" }));
} finally {
  if (!root.startsWith(temporary + path.sep)) throw new Error("Invalid verification directory.");
  await rm(root, { recursive: true, force: true });
}
