import { createHash, randomUUID } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { MANAGED_CODEX_PACKAGES, MANAGED_CODEX_VERSION } from "./managed-codex-manifest.mjs";

export function managedCodexPath(root = process.env.RAAVI_CODEX_MANAGED_ROOT, platform = process.platform, arch = process.arch) {
  if (!root || !MANAGED_CODEX_PACKAGES[`${platform}-${arch}`]) return null;
  return path.join(root, `${MANAGED_CODEX_VERSION}-${platform}-${arch}`, "bin", platform === "win32" ? "codex.exe" : "codex");
}

function runTar(args) {
  return new Promise((resolve, reject) => {
    const command = process.platform === "win32" ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe") : "/usr/bin/tar";
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("CODEX_EXTRACT_TIMEOUT")); }, 120_000);
    child.stdout.on("data", chunk => { output += chunk; if (output.length > 1_000_000) { child.kill(); reject(new Error("CODEX_INVALID_ARCHIVE")); } });
    child.once("error", () => { clearTimeout(timer); reject(new Error("CODEX_EXTRACT_FAILED")); });
    child.once("close", code => { clearTimeout(timer); if (code === 0) resolve(output); else reject(new Error("CODEX_EXTRACT_FAILED")); });
  });
}

export function validateCodexArchiveEntries(listing) {
  const entries = listing.split(/\r?\n/u).filter(Boolean);
  if (!entries.length || entries.some(entry => entry.startsWith("/") || entry.includes("\\") || entry.includes(":") || entry.split("/").includes(".."))) {
    throw new Error("CODEX_INVALID_ARCHIVE");
  }
}

export async function downloadCodexPackage(asset, destination, onProgress = () => {}, fetchImpl = fetch) {
  let lastError;
  for (const url of asset.urls) {
    if (new URL(url).protocol !== "https:") throw new Error("CODEX_INSECURE_DOWNLOAD");
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 10 * 60_000);
    try {
      const response = await fetchImpl(url, { signal: abort.signal, redirect: "follow" });
      if (!response.ok || !response.body) throw new Error("CODEX_DOWNLOAD_FAILED");
      if (response.url && new URL(response.url).protocol !== "https:") throw new Error("CODEX_INSECURE_DOWNLOAD");
      const hash = createHash("sha256");
      let bytes = 0, lastPercent = -1;
      const verify = new Transform({ transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > asset.bytes) return callback(new Error("CODEX_PACKAGE_MISMATCH"));
        hash.update(chunk);
        const percent = Math.floor(bytes * 100 / asset.bytes);
        if (percent !== lastPercent) { lastPercent = percent; onProgress({ phase: "downloading", percent }); }
        callback(null, chunk);
      } });
      await pipeline(Readable.fromWeb(response.body), verify, createWriteStream(destination), { signal: abort.signal });
      onProgress({ phase: "verifying" });
      if (bytes !== asset.bytes || hash.digest("hex") !== asset.sha256) throw new Error("CODEX_PACKAGE_MISMATCH");
      return;
    } catch (error) { lastError = error; await rm(destination, { force: true }); }
    finally { clearTimeout(timer); }
  }
  throw lastError ?? new Error("CODEX_DOWNLOAD_FAILED");
}

export async function installManagedCodex(root, onProgress = () => {}) {
  const key = `${process.platform}-${process.arch}`;
  const asset = MANAGED_CODEX_PACKAGES[key];
  if (!asset || !root) throw new Error("CODEX_UNSUPPORTED_PLATFORM");
  const base = path.resolve(root);
  const destination = path.join(base, `${MANAGED_CODEX_VERSION}-${key}`);
  const executable = managedCodexPath(base);
  const receipt = path.join(destination, "raavi-package.json");
  if (existsSync(executable)) {
    const installed = await readFile(receipt, "utf8").then(JSON.parse).catch(() => null);
    if (installed?.sha256 === asset.sha256) return executable;
    throw new Error("CODEX_INSTALL_CONFLICT");
  }
  await mkdir(base, { recursive: true });
  const stage = path.join(base, `.install-${randomUUID()}`);
  if (!stage.startsWith(base + path.sep)) throw new Error("CODEX_INVALID_INSTALL_PATH");
  await mkdir(stage);
  try {
    const archive = path.join(stage, "package.tar.gz");
    await downloadCodexPackage(asset, archive, onProgress);
    onProgress({ phase: "installing" });
    validateCodexArchiveEntries(await runTar(["-tzf", archive]));
    const unpacked = path.join(stage, "unpacked");
    await mkdir(unpacked);
    await runTar(["-xzf", archive, "-C", unpacked]);
    const binary = path.join(unpacked, "bin", process.platform === "win32" ? "codex.exe" : "codex");
    if (!existsSync(binary)) throw new Error("CODEX_INVALID_ARCHIVE");
    if (process.platform !== "win32") await chmod(binary, 0o755);
    await writeFile(path.join(unpacked, "raavi-package.json"), JSON.stringify({ version: MANAGED_CODEX_VERSION, sha256: asset.sha256 }));
    await rename(unpacked, destination);
    return executable;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
