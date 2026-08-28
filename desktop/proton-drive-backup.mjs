import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PROTON_DRIVE_CLI_VERSION = "0.8.0";
const PROTON_DRIVE_CLI_SHA512 =
  "03ce039618212c4cb9f175e3d53889657484cee9bfb0b1a24ad3f5b5e703ccf5784119acfa44c65bdda2af2b273c11b91075424ac169824b28edac49399b5a9a";
const MAX_COMMAND_OUTPUT_BYTES = 1024 * 1024;
const PROTON_READ_TIMEOUT_MS = 120_000;

function providerError(code, message, details = "") {
  return Object.assign(new Error(message), { code, details });
}

function protonLoginUrl(value) {
  const match = String(value || "").match(
    /https:\/\/account\.proton\.me\/[^\s"'<>]+/iu,
  );
  if (!match) return "";
  try {
    const url = new URL(match[0]);
    return url.protocol === "https:" &&
      url.hostname === "account.proton.me" &&
      url.pathname === "/desktop/login"
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function safeName(value, fallback = "file") {
  return (
    String(value || fallback)
      .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "-")
      .trim()
      .slice(0, 180) || fallback
  );
}

function extensionForMimeType(mimeType) {
  const known = new Map([
    ["image/avif", "avif"],
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["audio/aac", "aac"],
    ["audio/flac", "flac"],
    ["audio/mpeg", "mp3"],
    ["audio/ogg", "opus"],
    ["audio/opus", "opus"],
    ["audio/wav", "wav"],
    ["application/pdf", "pdf"],
  ]);
  return known.get(String(mimeType || "").toLowerCase()) || "bin";
}

async function sha512(filePath) {
  const hash = createHash("sha512");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function pathCandidates({ downloadsPath, explicitCliPath, env = process.env }) {
  const candidates = [];
  if (explicitCliPath) candidates.push(path.resolve(explicitCliPath));
  if (env.RAAVI_PROTON_DRIVE_CLI_PATH) {
    candidates.push(path.resolve(env.RAAVI_PROTON_DRIVE_CLI_PATH));
  }
  if (downloadsPath) candidates.push(path.join(downloadsPath, "proton-drive.exe"));
  if (env.LOCALAPPDATA) {
    candidates.push(
      path.join(env.LOCALAPPDATA, "Programs", "Proton Drive CLI", "proton-drive.exe"),
      path.join(env.LOCALAPPDATA, "Programs", "Proton Drive", "proton-drive.exe"),
    );
  }
  if (env.ProgramFiles) {
    candidates.push(
      path.join(env.ProgramFiles, "Proton Drive CLI", "proton-drive.exe"),
      path.join(env.ProgramFiles, "Proton Drive", "proton-drive.exe"),
    );
  }
  for (const directory of String(env.PATH || "").split(path.delimiter)) {
    if (directory.trim()) candidates.push(path.join(directory, "proton-drive.exe"));
  }
  return [...new Set(candidates.map((candidate) => path.resolve(candidate)))];
}

function defaultRunCommand(
  executable,
  args,
  { timeoutMs = 60_000, startupTimeoutMs = 0, onOutput = () => {} } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PROTON_DRIVE_LOG_LEVEL: "ERROR",
      },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let startupTimeout = null;
    const append = (current, chunk) =>
      `${current}${String(chunk)}`.slice(-MAX_COMMAND_OUTPUT_BYTES);
    const receiveOutput = (chunk) => {
      if (startupTimeout) {
        clearTimeout(startupTimeout);
        startupTimeout = null;
      }
      try {
        onOutput(String(chunk));
      } catch {
        // Output observation must never interrupt the Proton CLI process.
      }
    };
    child.stdout?.on("data", (chunk) => {
      stdout = append(stdout, chunk);
      receiveOutput(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr = append(stderr, chunk);
      receiveOutput(chunk);
    });
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(
        providerError(
          "proton-cli-timeout",
          "مهلت عملیات Proton Drive تمام شد؛ دوباره تلاش کنید.",
        ),
      );
    }, timeoutMs);
    timeout.unref?.();
    if (startupTimeoutMs > 0) {
      startupTimeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        clearTimeout(timeout);
        reject(
          providerError(
            "proton-cli-busy",
            "یک اجرای دیگر Proton Drive CLI باز مانده است؛ آن را ببندید و دوباره تلاش کنید.",
          ),
        );
      }, startupTimeoutMs);
      startupTimeout.unref?.();
    }
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (startupTimeout) clearTimeout(startupTimeout);
      reject(error);
    });
    child.once("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (startupTimeout) clearTimeout(startupTimeout);
      resolve({ exitCode: Number(exitCode ?? 1), stdout, stderr });
    });
  });
}

function commandError(result, fallbackCode = "proton-cli") {
  const detail = `${result?.stderr || ""}\n${result?.stdout || ""}`.trim();
  const lower = detail.toLowerCase();
  if (lower.includes("need to login") || lower.includes("login first")) {
    return providerError(
      "reauth",
      "برای ادامه دوباره وارد حساب Proton شوید.",
      detail,
    );
  }
  if (lower.includes("cancel")) {
    return providerError(
      "proton-auth-cancelled",
      "ورود به Proton کامل نشد.",
      detail,
    );
  }
  if (
    lower.includes("unable to connect") ||
    lower.includes("access the url") ||
    lower.includes("network") ||
    lower.includes("timed out")
  ) {
    return providerError(
      "proton-network",
      "شبکهٔ فعلی به سرورهای Proton دسترسی ندارد؛ اتصال اینترنت یا مسیر شبکه را بررسی کنید.",
      detail,
    );
  }
  return providerError(
    fallbackCode,
    "ارتباط با Proton Drive کامل نشد؛ فایل‌های محلی محفوظ‌اند.",
    detail,
  );
}

function documentDirectoryName(documentId) {
  const normalized = String(documentId || "").toLowerCase();
  if (/^[a-f0-9]{16,64}$/u.test(normalized)) return normalized;
  return createHash("sha256").update(normalized || "document").digest("hex").slice(0, 32);
}

async function writeAssetDirectory(directory, assets, kind) {
  const manifest = [];
  for (const asset of Array.isArray(assets) ? assets : []) {
    if (!asset || typeof asset.data !== "string" || !asset.data) continue;
    const bytes = Buffer.from(asset.data, "base64");
    const hash = createHash("sha256").update(bytes).digest("hex");
    const originalExtension = path.extname(String(asset.name || "")).slice(1);
    const extension = safeName(
      originalExtension || extensionForMimeType(asset.mimeType),
      "bin",
    );
    const fileName = `${hash}.${extension}`;
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, fileName), bytes);
    manifest.push({
      id: asset.id,
      name: asset.name,
      mimeType: asset.mimeType,
      ...(typeof asset.sourcePath === "string" && asset.sourcePath
        ? { sourcePath: asset.sourcePath }
        : {}),
      width: asset.width,
      height: asset.height,
      sha256: hash,
      size: bytes.byteLength,
      file: `${kind}/${fileName}`,
    });
  }
  return manifest;
}

export function createProtonDriveBackupProvider({
  userDataPath,
  downloadsPath = path.join(os.homedir(), "Downloads"),
  cliPath = "",
  runCommand = defaultRunCommand,
  verifyCli = async (candidate) =>
    (await sha512(candidate).catch(() => "")) === PROTON_DRIVE_CLI_SHA512,
  openExternal = async () => {},
  now = () => Date.now(),
  env = process.env,
} = {}) {
  const stagingRoot = path.join(userDataPath, "proton-drive-staging");
  let cliPromise = null;
  let remoteFoldersPromise = null;

  async function locateCli({ required = true } = {}) {
    if (!cliPromise) {
      cliPromise = (async () => {
        const candidates = pathCandidates({
          downloadsPath,
          explicitCliPath: cliPath,
          env,
        });
        let invalidCandidate = "";
        for (const candidate of candidates) {
          if (!(await isFile(candidate))) continue;
          if (await verifyCli(candidate)) return candidate;
          invalidCandidate ||= candidate;
        }
        if (invalidCandidate) {
          throw providerError(
            "proton-cli-checksum",
            `فایل Proton Drive CLI معتبر نیست یا نسخهٔ پشتیبانی‌شدهٔ ${PROTON_DRIVE_CLI_VERSION} نیست.`,
          );
        }
        return "";
      })().catch((error) => {
        cliPromise = null;
        throw error;
      });
    }
    const executable = await cliPromise;
    if (!executable && required) {
      throw providerError(
        "proton-cli-missing",
        "ابتدا فایل رسمی proton-drive.exe را دانلود کنید و در پوشهٔ Downloads بگذارید.",
      );
    }
    return executable;
  }

  async function execute(args, options = {}) {
    const executable = await locateCli();
    const result = await runCommand(executable, args, options);
    if (result.exitCode !== 0) throw commandError(result, options.errorCode);
    return result;
  }

  async function pathExists(remotePath) {
    const executable = await locateCli();
    const result = await runCommand(
      executable,
      ["filesystem", "list", remotePath, "--json"],
      { timeoutMs: PROTON_READ_TIMEOUT_MS },
    );
    return result.exitCode === 0;
  }

  async function ensureRemoteFolder(parentPath, name) {
    const remotePath = `${parentPath}/${name}`;
    if (await pathExists(remotePath)) return;
    const executable = await locateCli();
    const created = await runCommand(
      executable,
      ["filesystem", "create-folder", parentPath, name, "--json"],
      { timeoutMs: 60_000 },
    );
    if (created.exitCode !== 0 && !(await pathExists(remotePath))) {
      throw commandError(created, "proton-folder");
    }
  }

  async function ensureRemoteFolders() {
    if (!remoteFoldersPromise) {
      remoteFoldersPromise = (async () => {
        await ensureRemoteFolder("/my-files", "Raavi");
        await ensureRemoteFolder("/my-files/Raavi", "Vault");
      })().catch((error) => {
        remoteFoldersPromise = null;
        throw error;
      });
    }
    return remoteFoldersPromise;
  }

  async function connectionInfo() {
    let executable = "";
    try {
      executable = await locateCli({ required: false });
    } catch (error) {
      return {
        state: "error",
        accountEmail: "",
        error: error instanceof Error ? error.message : "Proton Drive CLI در دسترس نیست.",
      };
    }
    if (!executable) return { state: "disconnected", accountEmail: "" };
    const result = await runCommand(
      executable,
      ["filesystem", "list", "/my-files", "--json"],
      { timeoutMs: PROTON_READ_TIMEOUT_MS },
    );
    return result.exitCode === 0
      ? { state: "connected", accountEmail: "" }
      : { state: "disconnected", accountEmail: "" };
  }

  async function connect({ timeoutMs = 10 * 60_000 } = {}) {
    const executable = await locateCli();
    const existingSession = await runCommand(
      executable,
      ["filesystem", "list", "/my-files", "--json"],
      { timeoutMs: 90_000 },
    );
    if (existingSession.exitCode === 0) {
      return { state: "connected", accountEmail: "", quota: null };
    }
    const existingSessionMessage =
      `${existingSession.stderr || ""}\n${existingSession.stdout || ""}`.toLowerCase();
    if (
      !existingSessionMessage.includes("need to login") &&
      !existingSessionMessage.includes("login first")
    ) {
      throw commandError(existingSession, "proton-auth");
    }
    let authOutput = "";
    let openedLoginUrl = "";
    await execute(["auth", "login"], {
      timeoutMs,
      errorCode: "proton-auth",
      onOutput(chunk) {
        authOutput = `${authOutput}${chunk}`.slice(-32_768);
        if (openedLoginUrl) return;
        const loginUrl = protonLoginUrl(authOutput);
        if (!loginUrl) return;
        openedLoginUrl = loginUrl;
        void Promise.resolve(openExternal(loginUrl)).catch(() => {});
      },
    });
    const verified = await execute(
      ["filesystem", "list", "/my-files", "--json"],
      { timeoutMs: PROTON_READ_TIMEOUT_MS, errorCode: "proton-auth" },
    );
    if (verified.exitCode !== 0) throw commandError(verified, "proton-auth");
    remoteFoldersPromise = null;
    return { state: "connected", accountEmail: "", quota: null };
  }

  async function disconnect() {
    const executable = await locateCli({ required: false });
    if (executable) {
      const result = await runCommand(executable, ["auth", "logout"], {
        timeoutMs: 60_000,
      });
      if (result.exitCode !== 0) throw commandError(result, "proton-logout");
    }
    remoteFoldersPromise = null;
    return { state: "disconnected", accountEmail: "" };
  }

  async function getQuota() {
    return null;
  }

  function parseListOutput(value) {
    try {
      const parsed = JSON.parse(String(value || "[]"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      throw providerError("backup-invalid", "فهرست بکاپ‌های Proton Drive معتبر نیست.");
    }
  }

  function remoteEntryName(entry) {
    return entry?.name?.ok && typeof entry.name.value === "string"
      ? entry.name.value
      : typeof entry?.name === "string"
        ? entry.name
        : "";
  }

  async function downloadRemotePath(remotePath, localFolder) {
    await mkdir(localFolder, { recursive: true });
    await execute(
      [
        "filesystem",
        "download",
        "--file-conflict-strategy",
        "remove",
        "--folder-conflict-strategy",
        "remove",
        remotePath,
        localFolder,
        "--json",
      ],
      { timeoutMs: 30 * 60_000, errorCode: "proton-download" },
    );
  }

  async function findDownloadedFile(rootPath, fileName, depth = 3) {
    if (depth < 0) return "";
    const entries = await readdir(rootPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isFile() && entry.name === fileName) {
        return path.join(rootPath, entry.name);
      }
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const found = await findDownloadedFile(
        path.join(rootPath, entry.name),
        fileName,
        depth - 1,
      );
      if (found) return found;
    }
    return "";
  }

  async function readMetadataFile(filePath) {
    let metadata;
    try {
      metadata = JSON.parse(await readFile(filePath, "utf8"));
    } catch {
      throw providerError("backup-invalid", "اطلاعات یکی از بکاپ‌های Proton Drive معتبر نیست.");
    }
    if (
      !metadata ||
      metadata.format !== "raavi-vault-metadata" ||
      typeof metadata.documentId !== "string" ||
      !metadata.documentId
    ) {
      throw providerError("backup-invalid", "ساختار یکی از بکاپ‌های Proton Drive پشتیبانی نمی‌شود.");
    }
    return metadata;
  }

  async function listBackups() {
    const vaultPath = "/my-files/Raavi/Vault";
    if (!(await pathExists(vaultPath))) return [];
    const listed = await execute(
      ["filesystem", "list", vaultPath, "--json"],
      { timeoutMs: PROTON_READ_TIMEOUT_MS, errorCode: "proton-list" },
    );
    const backups = [];
    for (const entry of parseListOutput(listed.stdout)) {
      const documentId = remoteEntryName(entry);
      if (entry?.type !== "folder" || !/^[a-f0-9]{16,64}$/iu.test(documentId)) {
        continue;
      }
      const indexRoot = path.join(stagingRoot, "restore-index", documentId);
      await rm(indexRoot, { recursive: true, force: true });
      try {
        await downloadRemotePath(
          `${vaultPath}/${documentId}/raavi-metadata.json`,
          indexRoot,
        );
        const metadataPath = await findDownloadedFile(
          indexRoot,
          "raavi-metadata.json",
        );
        if (!metadataPath) continue;
        const metadata = await readMetadataFile(metadataPath);
        backups.push({
          providerId: "proton-drive",
          documentId: metadata.documentId,
          fileName: safeName(metadata.fileName || "document.md"),
          backedUpAt:
            metadata.backedUpAt || entry.modificationTime || entry.creationTime || "",
          versionCount: Array.isArray(metadata.versions) ? metadata.versions.length : 0,
          assetCount: Array.isArray(metadata.assets) ? metadata.assets.length : 0,
          audioCount: Array.isArray(metadata.audio) ? metadata.audio.length : 0,
          attachmentCount: Array.isArray(metadata.attachments) ? metadata.attachments.length : 0,
          categories: metadata.categories ?? {},
        });
      } catch (error) {
        if (error?.code === "reauth" || error?.code === "proton-auth") throw error;
      } finally {
        await rm(indexRoot, { recursive: true, force: true }).catch(() => {});
      }
    }
    return backups.sort(
      (left, right) =>
        Date.parse(right.backedUpAt || "") - Date.parse(left.backedUpAt || ""),
    );
  }

  async function downloadBackup(documentId) {
    const normalizedDocumentId = String(documentId || "").toLowerCase();
    if (!/^[a-f0-9]{16,64}$/u.test(normalizedDocumentId)) {
      throw providerError("backup-invalid", "شناسهٔ بکاپ Proton Drive معتبر نیست.");
    }
    const downloadRoot = path.join(stagingRoot, "restore-download", normalizedDocumentId);
    await rm(downloadRoot, { recursive: true, force: true });
    try {
      await downloadRemotePath(
        `/my-files/Raavi/Vault/${normalizedDocumentId}`,
        downloadRoot,
      );
      const metadataPath = await findDownloadedFile(
        downloadRoot,
        "raavi-metadata.json",
      );
      if (!metadataPath) {
        throw providerError("backup-missing", "اطلاعات این بکاپ در Proton Drive پیدا نشد.");
      }
      const metadata = await readMetadataFile(metadataPath);
      const documentRoot = path.dirname(metadataPath);
      const documentEntries = await readdir(documentRoot, { withFileTypes: true });
      const markdownFile = documentEntries.find(
        (entry) => entry.isFile() && /\.(?:md|markdown)$/iu.test(entry.name),
      );
      const content = markdownFile
        ? await readFile(path.join(documentRoot, markdownFile.name), "utf8")
        : "";

      const hydrateAssets = async (items) => {
        const hydrated = [];
        for (const item of Array.isArray(items) ? items : []) {
          if (typeof item?.file !== "string" || !item.file) continue;
          const candidate = path.resolve(documentRoot, item.file);
          const relative = path.relative(documentRoot, candidate);
          if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
            continue;
          }
          const bytes = await readFile(candidate).catch(() => null);
          if (!bytes) continue;
          hydrated.push({ ...item, data: bytes.toString("base64") });
        }
        return hydrated;
      };

      return {
        providerId: "proton-drive",
        documentId: normalizedDocumentId,
        metadata,
        content,
        assets: await hydrateAssets(metadata.assets),
        audio: await hydrateAssets(metadata.audio),
        attachments: await hydrateAssets(metadata.attachments),
      };
    } finally {
      await rm(downloadRoot, { recursive: true, force: true }).catch(() => {});
    }
  }

  async function uploadDocument({ documentId, payload }) {
    await ensureRemoteFolders();
    const directoryName = documentDirectoryName(documentId);
    const documentRoot = path.join(stagingRoot, directoryName);
    await rm(documentRoot, { recursive: true, force: true });
    await mkdir(documentRoot, { recursive: true });
    try {
      if (payload.backupCategories?.textAndStructure !== false) {
        const markdownName = safeName(
          String(payload.fileName || "document.md").replace(/\.markdown$/iu, ".md"),
          "document.md",
        );
        await writeFile(
          path.join(documentRoot, markdownName.endsWith(".md") ? markdownName : `${markdownName}.md`),
          String(payload.content ?? ""),
          "utf8",
        );
      }
      const assets = await writeAssetDirectory(
        path.join(documentRoot, "Assets"),
        payload.assets,
        "Assets",
      );
      const audio = await writeAssetDirectory(
        path.join(documentRoot, "Audio"),
        payload.audioAssets,
        "Audio",
      );
      const attachments = await writeAssetDirectory(
        path.join(documentRoot, "Attachments"),
        payload.attachments,
        "Attachments",
      );
      const metadata = {
        format: "raavi-vault-metadata",
        version: 1,
        provider: "proton-drive",
        documentId,
        backedUpAt: new Date(now()).toISOString(),
        fileName: safeName(payload.fileName || "document.md"),
        annotations: payload.annotations ?? [],
        versions: payload.versions ?? [],
        assets,
        audio,
        attachments,
        categories: payload.backupCategories ?? {},
      };
      await writeFile(
        path.join(documentRoot, "raavi-metadata.json"),
        JSON.stringify(metadata, null, 2),
        "utf8",
      );
      await execute(
        [
          "filesystem",
          "upload",
          "--file-conflict-strategy",
          "replace",
          "--folder-conflict-strategy",
          "replace",
          "--skip-thumbnails",
          documentRoot,
          "/my-files/Raavi/Vault",
          "--json",
        ],
        { timeoutMs: 30 * 60_000, errorCode: "proton-upload" },
      );
      const remotePath = `/my-files/Raavi/Vault/${directoryName}`;
      if (!(await pathExists(remotePath))) {
        throw providerError(
          "proton-upload-verify",
          "Proton Drive دریافت نسخهٔ تازه را تأیید نکرد؛ فایل محلی در صف باقی ماند.",
        );
      }
      return { remoteId: remotePath };
    } finally {
      await rm(documentRoot, { recursive: true, force: true }).catch(() => {});
    }
  }

  return {
    connect,
    disconnect,
    connectionInfo,
    getQuota,
    uploadDocument,
    listBackups,
    downloadBackup,
    locateCli,
  };
}

export const protonDriveBackupInternals = {
  PROTON_DRIVE_CLI_VERSION,
  PROTON_DRIVE_CLI_SHA512,
  documentDirectoryName,
  extensionForMimeType,
  pathCandidates,
  protonLoginUrl,
  safeName,
};
