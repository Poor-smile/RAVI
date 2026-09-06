import { createHash, verify as verifySignature } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { writeAll } from "./atomic-file.mjs";
import { responseLength, withUpdateResponse } from "./update-request.mjs";

export const DEFAULT_UPDATE_MANIFEST_URL =
  "https://ravi.poorsmile.ir/updates/stable.json";
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const MAX_UPDATE_MANIFEST_BYTES = 256 * 1024;
export const MAX_UPDATE_ARTIFACT_BYTES = 2 * 1024 * 1024 * 1024;
export const UPDATE_REQUEST_LIMITS = Object.freeze({
  headerTimeoutMs: 15_000,
  idleTimeoutMs: 30_000,
  manifestTimeoutMs: 30_000,
  downloadTimeoutMs: 30 * 60_000,
});

const UPDATE_PHASES = new Set([
  "idle",
  "checking",
  "up-to-date",
  "available",
  "downloading",
  "paused",
  "ready",
  "error",
]);

function publicState(state) {
  return JSON.parse(JSON.stringify(state));
}

function normalizedVersion(value) {
  const match = String(value ?? "").trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return null;
  return match.slice(1).map((part) => Number(part));
}

export function compareVersions(left, right) {
  const a = normalizedVersion(left);
  const b = normalizedVersion(right);
  if (!a || !b) throw new Error("update_invalid_version");
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

function requiredHttpsUrl(value, code) {
  const parsed = new URL(String(value ?? ""));
  if (parsed.protocol !== "https:") throw new Error(code);
  return parsed.toString();
}

function safeArtifactPath(value) {
  const candidate = String(value ?? "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\") || candidate.includes("..")) {
    throw new Error("update_invalid_artifact_path");
  }
  return candidate;
}

function validateMirrors(value) {
  if (Array.isArray(value) && value.length > 8) throw new Error("update_too_many_mirrors");
  const mirrors = Array.isArray(value)
    ? value.map((mirror, index) => ({
        id: String(mirror?.id ?? `mirror-${index + 1}`),
        baseUrl: requiredHttpsUrl(
          mirror?.baseUrl,
          "update_invalid_mirror_url",
        ).replace(/\/$/, ""),
      }))
    : [];
  if (!mirrors.length) throw new Error("update_missing_mirrors");
  return mirrors;
}

function validateArtifact(value, { platform, arch, fallbackMirrors }) {
  if (!value || typeof value !== "object") {
    throw new Error("update_invalid_artifact");
  }
  const size = Number(value.size);
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_UPDATE_ARTIFACT_BYTES) {
    throw new Error("update_invalid_size");
  }
  const sha512 = String(value.sha512 ?? "").toLowerCase();
  if (!/^[a-f0-9]{128}$/.test(sha512)) {
    throw new Error("update_invalid_sha512");
  }
  const signature = String(value.signature ?? "");
  if (!signature || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) {
    throw new Error("update_invalid_signature");
  }
  const artifactPath = safeArtifactPath(value.path);
  if (platform === "win32" && !artifactPath.toLowerCase().endsWith(".exe")) {
    throw new Error("update_invalid_windows_artifact");
  }
  if (platform === "darwin" && !artifactPath.toLowerCase().endsWith(".dmg")) {
    throw new Error("update_invalid_macos_artifact");
  }
  const mirrors = value.mirrors
    ? validateMirrors(value.mirrors)
    : fallbackMirrors;
  if (!mirrors.length) throw new Error("update_missing_mirrors");
  return {
    platform,
    arch,
    path: artifactPath,
    size,
    sha512,
    signature,
    mirrors,
  };
}

export function updateArtifactKey(platform, arch) {
  return `${String(platform)}-${String(arch)}`;
}

export function validateUpdateManifest(
  value,
  { platform = process.platform, arch = process.arch } = {},
) {
  if (!value || typeof value !== "object") {
    throw new Error("update_invalid_manifest");
  }
  const version = String(value.version ?? "");
  if (!normalizedVersion(version)) throw new Error("update_invalid_version");
  const schema = Number(value.schema) || 1;
  const fallbackMirrors = value.mirrors
    ? validateMirrors(value.mirrors)
    : [];
  const artifactKey = updateArtifactKey(platform, arch);
  let rawArtifact = value.artifacts?.[artifactKey];
  if (!rawArtifact) {
    if (schema >= 2 || platform !== "win32" || arch !== "x64") {
      throw new Error("update_unsupported_platform");
    }
    rawArtifact = value.artifact;
  }
  const artifact = validateArtifact(rawArtifact, {
    platform,
    arch,
    fallbackMirrors,
  });
  const notesUrl = value.notesUrl
    ? requiredHttpsUrl(value.notesUrl, "update_invalid_notes_url")
    : "";
  return {
    schema,
    channel: String(value.channel || "stable"),
    version,
    publishedAt: String(value.publishedAt || ""),
    notesUrl,
    artifact,
    mirrors: artifact.mirrors,
  };
}

export function updateSignaturePayload(manifest) {
  if (Number(manifest.schema) >= 2) {
    return Buffer.from(
      `${manifest.version}\n${manifest.artifact.platform}\n${manifest.artifact.arch}\n${manifest.artifact.path}\n${manifest.artifact.size}\n${manifest.artifact.sha512}`,
      "utf8",
    );
  }
  return Buffer.from(
    `${manifest.version}\n${manifest.artifact.path}\n${manifest.artifact.size}\n${manifest.artifact.sha512}`,
    "utf8",
  );
}

async function sha512File(filePath) {
  const hash = createHash("sha512");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

export async function verifyDownloadedUpdate({ filePath, manifest, publicKey }) {
  const fileStat = await stat(filePath);
  if (fileStat.size !== manifest.artifact.size) {
    throw new Error("update_size_mismatch");
  }
  const digest = await sha512File(filePath);
  if (digest !== manifest.artifact.sha512) {
    throw new Error("update_checksum_mismatch");
  }
  verifyManifestSignature(manifest, publicKey);
  return true;
}

function verifyManifestSignature(manifest, publicKey) {
  const verified = verifySignature(
    null,
    updateSignaturePayload(manifest),
    publicKey,
    Buffer.from(manifest.artifact.signature, "base64"),
  );
  if (!verified) throw new Error("update_signature_mismatch");
}

function friendlyError(error) {
  const code = String(error?.message ?? error ?? "update_failed");
  if (code.includes("timeout")) return "مهلت دریافت به‌روزرسانی تمام شد. دوباره تلاش کنید.";
  if (code.includes("signature") || code.includes("checksum") || code.includes("size_mismatch")) {
    return "فایل دریافت‌شده معتبر نبود؛ مسیر جایگزین امتحان می‌شود.";
  }
  if (code === "update_no_newer_version") return "نسخهٔ تازه‌تری پیدا نشد.";
  if (code === "update_unsupported_platform") {
    return "برای معماری این دستگاه هنوز بستهٔ بروزرسانی منتشر نشده است.";
  }
  return "در حال حاضر مسیر دانلود در دسترس نیست.";
}

function friendlyInstallError(error) {
  const code = String(error?.message ?? error ?? "update_launch_failed").toLowerCase();
  if (code.includes("eacces") || code.includes("elevation") || code.includes("access")) {
    return "Windows اجازهٔ اجرای نصب‌کننده را نداد. دوباره تلاش کنید و درخواست دسترسی مدیر سیستم (Administrator) را تأیید کنید.";
  }
  return "نصب‌کننده باز نشد. دوباره تلاش کنید یا فایل نصب را مستقیم دریافت کنید.";
}

async function launchDetached(command, args, options) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

export function createSoftwareUpdateController({
  currentVersion,
  userDataPath,
  publicKeyPath,
  manifestUrl = DEFAULT_UPDATE_MANIFEST_URL,
  fetchImpl = globalThis.fetch,
  emit = () => {},
  launchInstaller,
  checkIntervalMs = UPDATE_CHECK_INTERVAL_MS,
  platform = process.platform,
  arch = process.arch,
  requestLimits = {},
}) {
  if (typeof fetchImpl !== "function") throw new Error("update_fetch_unavailable");
  const limits = { ...UPDATE_REQUEST_LIMITS, ...requestLimits };
  for (const value of Object.values(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647) throw new Error("update_invalid_request_limit");
  }
  const downloadsDirectory = path.join(userDataPath, "updates");
  let manifest = null;
  let checkTimer = null;
  let abortController = null;
  let pauseRequested = false;
  let cancelRequested = false;
  let activeDownload = null;
  let activeCheck = null;
  let checkController = null;
  let disposed = false;
  let state = {
    phase: "idle",
    currentVersion,
    platform,
    arch,
    version: "",
    notesUrl: "",
    downloadedBytes: 0,
    totalBytes: 0,
    progress: 0,
    checkedAt: "",
    message: "",
    installerPath: "",
  };

  const setState = (patch) => {
    if (disposed) return publicState(state);
    state = { ...state, ...patch };
    if (!UPDATE_PHASES.has(state.phase)) state.phase = "error";
    emit(publicState(state));
    return publicState(state);
  };

  const artifactFileName = () =>
    path.basename(manifest?.artifact?.path || `Raavi-Setup-${currentVersion}-x64.exe`);
  const finalPath = () => path.join(downloadsDirectory, artifactFileName());
  const partialPath = () => `${finalPath()}.part`;

  async function runCheck({ manual = false } = {}) {
    checkController = new AbortController();
    setState({ phase: "checking", message: "" });
    try {
      const value = await withUpdateResponse(manifestUrl, {
        fetchImpl,
        signal: checkController.signal,
        ...limits,
        totalTimeoutMs: limits.manifestTimeoutMs,
        headers: { Accept: "application/json", "Accept-Encoding": "identity" },
      }, async (response, chunks) => {
        if (response.status !== 200) throw new Error(`update_manifest_http_${response.status}`);
        if (responseLength(response) > MAX_UPDATE_MANIFEST_BYTES) throw new Error("update_manifest_too_large");
        const parts = [];
        let size = 0;
        for await (const chunk of chunks()) {
          size += chunk.length;
          if (size > MAX_UPDATE_MANIFEST_BYTES) throw new Error("update_manifest_too_large");
          parts.push(chunk);
        }
        return JSON.parse(Buffer.concat(parts).toString("utf8"));
      });
      const checkedManifest = validateUpdateManifest(value, {
        platform,
        arch,
      });
      verifyManifestSignature(checkedManifest, await readFile(publicKeyPath));
      if (disposed) return publicState(state);
      manifest = checkedManifest;
      const checkedAt = new Date().toISOString();
      if (compareVersions(manifest.version, currentVersion) <= 0) {
        return setState({
          phase: "up-to-date",
          version: manifest.version,
          notesUrl: manifest.notesUrl,
          checkedAt,
          downloadedBytes: 0,
          totalBytes: 0,
          progress: 0,
          message: manual ? "نسخهٔ نصب‌شده به‌روز است." : "",
          installerPath: "",
        });
      }
      await mkdir(downloadsDirectory, { recursive: true });
      try {
        await access(finalPath());
        const publicKey = await readFile(publicKeyPath);
        await verifyDownloadedUpdate({
          filePath: finalPath(),
          manifest,
          publicKey,
        });
        return setState({
          phase: "ready",
          version: manifest.version,
          notesUrl: manifest.notesUrl,
          checkedAt,
          downloadedBytes: manifest.artifact.size,
          totalBytes: manifest.artifact.size,
          progress: 1,
          message: "دانلود و اعتبارسنجی با موفقیت کامل شد.",
          installerPath: finalPath(),
        });
      } catch {
        await rm(finalPath(), { force: true }).catch(() => {});
      }
      return setState({
        phase: "available",
        version: manifest.version,
        notesUrl: manifest.notesUrl,
        checkedAt,
        downloadedBytes: 0,
        totalBytes: manifest.artifact.size,
        progress: 0,
        message: "",
        installerPath: "",
      });
    } catch (error) {
      manifest = null;
      return setState({
        phase: "error",
        installerPath: "",
        checkedAt: new Date().toISOString(),
        message: friendlyError(error),
      });
    }
  }

  function check(options) {
    if (disposed || activeDownload || state.phase === "paused") return Promise.resolve(publicState(state));
    if (activeCheck) return activeCheck;
    activeCheck = runCheck(options).finally(() => {
      activeCheck = null;
      checkController = null;
    });
    return activeCheck;
  }

  async function downloadFromMirror(mirror, remainingMs) {
    await mkdir(downloadsDirectory, { recursive: true });
    let downloadedBytes = 0;
    try {
      downloadedBytes = (await stat(partialPath())).size;
    } catch {
      downloadedBytes = 0;
    }
    if (downloadedBytes > manifest.artifact.size) {
      await rm(partialPath(), { force: true });
      downloadedBytes = 0;
    }
    if (pauseRequested || cancelRequested || disposed) return false;
    if (downloadedBytes === manifest.artifact.size) return true;
    abortController = new AbortController();
    const url = new URL(manifest.artifact.path, `${mirror.baseUrl}/`).toString();
    return withUpdateResponse(url, {
      fetchImpl,
      ...limits,
      totalTimeoutMs: remainingMs,
      headers: { "Accept-Encoding": "identity", ...(downloadedBytes ? { Range: `bytes=${downloadedBytes}-` } : {}) },
      signal: abortController.signal,
    }, async (response, chunks, signal) => {
      if (response.status !== 200 && response.status !== 206) {
        throw new Error(`update_artifact_http_${response.status}`);
      }
      if (response.headers.get("content-encoding") && response.headers.get("content-encoding") !== "identity") {
        throw new Error("update_invalid_content_encoding");
      }
      if (response.status === 206) {
        const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("content-range") ?? "");
        if (!range || Number(range[1]) !== downloadedBytes || Number(range[2]) !== manifest.artifact.size - 1 || Number(range[3]) !== manifest.artifact.size) {
          throw new Error("update_invalid_content_range");
        }
      } else {
        if (response.headers.has("content-range")) throw new Error("update_invalid_content_range");
        downloadedBytes = 0;
      }
      const length = responseLength(response);
      if (length !== null && length !== manifest.artifact.size - downloadedBytes) throw new Error("update_size_mismatch");
      signal.throwIfAborted();
      const file = await open(partialPath(), downloadedBytes ? "a" : "w");
      try {
        for await (const buffer of chunks()) {
          signal.throwIfAborted();
          // Reject before disk I/O; never write even part of an oversized chunk.
          if (buffer.length > manifest.artifact.size - downloadedBytes) throw new Error("update_size_mismatch");
          await writeAll(file, buffer);
          downloadedBytes += buffer.length;
          setState({
            phase: "downloading",
            downloadedBytes,
            totalBytes: manifest.artifact.size,
            progress: Math.min(1, downloadedBytes / manifest.artifact.size),
            message: "می‌توانید هم‌زمان به کارتان ادامه دهید.",
          });
        }
        signal.throwIfAborted();
        if (downloadedBytes !== manifest.artifact.size) throw new Error("update_incomplete_download");
        await file.sync();
      } finally {
        await file.close();
      }
      return !pauseRequested && !cancelRequested && !disposed;
    });
  }

  async function runDownload() {
    if (activeCheck) await activeCheck;
    if (!manifest || compareVersions(manifest.version, currentVersion) <= 0) {
      // This is already single-flight under activeDownload.
      await runCheck({ manual: true });
    }
    if (disposed || pauseRequested || cancelRequested) return publicState(state);
    if (!manifest || compareVersions(manifest.version, currentVersion) <= 0) {
      return state.phase === "error" ? publicState(state) : setState({ phase: "error", message: friendlyError(new Error("update_no_newer_version")) });
    }
    setState({
      phase: "downloading",
      version: manifest.version,
      notesUrl: manifest.notesUrl,
      totalBytes: manifest.artifact.size,
      message: "می‌توانید هم‌زمان به کارتان ادامه دهید.",
    });
    let lastError = null;
    const deadline = Date.now() + limits.downloadTimeoutMs;
    for (const mirror of manifest.mirrors) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        lastError = new Error("update_total_timeout");
        break;
      }
      try {
        const complete = await downloadFromMirror(mirror, remainingMs);
        if (!complete) break;
        const publicKey = await readFile(publicKeyPath);
        await verifyDownloadedUpdate({
          filePath: partialPath(),
          manifest,
          publicKey,
        });
        if (pauseRequested || cancelRequested || disposed) break;
        await rename(partialPath(), finalPath());
        return setState({
          phase: "ready",
          downloadedBytes: manifest.artifact.size,
          totalBytes: manifest.artifact.size,
          progress: 1,
          message: "دانلود و اعتبارسنجی با موفقیت کامل شد.",
          installerPath: finalPath(),
        });
      } catch (error) {
        if (pauseRequested || cancelRequested || disposed) break;
        lastError = error;
        await rm(partialPath(), { force: true }).catch(() => {});
      }
    }
    if (disposed) return publicState(state);
    if (cancelRequested) {
      await rm(partialPath(), { force: true }).catch(() => {});
      return setState({
        phase: "available",
        downloadedBytes: 0,
        progress: 0,
        message: "",
      });
    }
    if (pauseRequested) {
      const downloadedBytes = await stat(partialPath())
        .then((entry) => entry.size)
        .catch(() => 0);
      return setState({
        phase: "paused",
        downloadedBytes,
        progress: Math.min(1, downloadedBytes / manifest.artifact.size),
        message: "دانلود مکث شده است.",
      });
    }
    return setState({
      phase: "error",
      downloadedBytes: 0,
      progress: 0,
      installerPath: "",
      message: friendlyError(lastError),
    });
  }

  function download() {
    if (disposed) return Promise.resolve(publicState(state));
    if (activeDownload) return activeDownload;
    pauseRequested = false;
    cancelRequested = false;
    activeDownload = runDownload().finally(() => {
      activeDownload = null;
      abortController = null;
    });
    return activeDownload;
  }

  async function pause() {
    if (state.phase !== "downloading") return publicState(state);
    pauseRequested = true;
    abortController?.abort();
    await activeDownload?.catch(() => {});
    return publicState(state);
  }

  async function cancel() {
    if (!activeDownload && state.phase !== "paused") {
      return publicState(state);
    }
    cancelRequested = true;
    pauseRequested = false;
    abortController?.abort();
    checkController?.abort();
    await activeDownload?.catch(() => {});
    await rm(partialPath(), { force: true }).catch(() => {});
    return setState({
      phase: "available",
      downloadedBytes: 0,
      progress: 0,
      message: "",
    });
  }

  async function install() {
    if (state.phase !== "ready" || !state.installerPath) {
      throw new Error("update_not_ready");
    }
    try {
      if (launchInstaller) {
        await launchInstaller(state.installerPath);
      } else if (platform === "darwin") {
        await launchDetached("/usr/bin/open", [state.installerPath], {
          detached: true,
          stdio: "ignore",
        });
      } else {
        await launchDetached(state.installerPath, [], {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        });
      }
    } catch (error) {
      setState({
        phase: "ready",
        message: friendlyInstallError(error),
      });
      return { started: false, error: "update_launch_failed" };
    }
    setState({ message: "" });
    return { started: true };
  }

  function start() {
    if (disposed || checkTimer) return;
    void check();
    checkTimer = setInterval(() => void check(), checkIntervalMs);
    checkTimer.unref?.();
  }

  function dispose() {
    disposed = true;
    if (checkTimer) clearInterval(checkTimer);
    checkTimer = null;
    pauseRequested = true;
    abortController?.abort();
    checkController?.abort();
  }

  return {
    getState: () => publicState(state),
    check,
    download,
    pause,
    resume: download,
    cancel,
    install,
    getDirectDownloadUrl() {
      if (!manifest) return "";
      return new URL(
        manifest.artifact.path,
        `${manifest.mirrors[0].baseUrl}/`,
      ).toString();
    },
    start,
    dispose,
  };
}
