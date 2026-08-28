import { app, dialog } from "electron";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { readAudioMetadataDuration } from "./audio-metadata.mjs";
import {
  findPreferredWhisperExecutable,
  resolveActiveAudioModelTier,
  whisperProgressFromOutput,
  whisperRuntimePaths,
} from "./audio-whisper-runtime.mjs";
import { extractZipArchive } from "./zip-extract.mjs";

const MAX_AUDIO_DURATION_MS = 60 * 60 * 1000;
const MAX_AUDIO_BYTES = 1024 * 1024 * 1024;
const DEFAULT_CHUNK_MS = 60 * 1000;
const LEGACY_CHUNK_MS = 5 * 60 * 1000;
const AUDIO_EXTENSIONS = new Set([".aac", ".flac", ".m4a", ".mp3", ".ogg", ".wav", ".webm"]);
const RAAVI_AUDIO_DOWNLOAD_BASE_URL = String(
  process.env.RAAVI_AUDIO_DOWNLOAD_BASE_URL ?? "",
).replace(/\/+$/u, "");
function audioDownloadUrl(fileName, upstream) {
  return RAAVI_AUDIO_DOWNLOAD_BASE_URL
    ? `${RAAVI_AUDIO_DOWNLOAD_BASE_URL}/${fileName}`
    : upstream;
}
const ENGINE = {
  version: "b4938",
  url: audioDownloadUrl(
    "whisper-bin-x64.zip",
    "https://github.com/ggerganov/whisper.cpp/releases/download/b4938/whisper-bin-x64.zip",
  ),
  sha256: "c2a4b60edb11f7e11a9191ffb50929535527d4d91c9903dbe3e554583bbbc63d",
  sizeBytes: 8_361_840,
};
const FFMPEG = {
  url: audioDownloadUrl(
    "ffmpeg-win32-x64.gz",
    "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-win32-x64.gz",
  ),
  sha256: "8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77",
  sizeBytes: 29_581_307,
};
const MODEL_TIERS = {
  light: {
    label: "سبک",
    suitableFor: "سیستم ضعیف و فایل‌های واضح",
    detail: "دانلود کمتر و سرعت بیشتر، دقت پایین‌تر",
    fileName: "ggml-base-q5_1.bin",
    sizeBytes: 59_707_625,
    url: audioDownloadUrl(
      "ggml-base-q5_1.bin",
      "https://dl2.gptt.ir/downloads/raavi/audio/v1/models/ggml-base-q5_1.bin",
    ),
    sha256: "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898",
  },
  balanced: {
    label: "متعادل",
    suitableFor: "سیستم معمولی و بیشتر گفت‌وگوها",
    detail: "تعادل سرعت، حافظه و دقت",
    fileName: "ggml-small-q5_1.bin",
    sizeBytes: 190_085_487,
    url: audioDownloadUrl(
      "ggml-small-q5_1.bin",
      "https://dl2.gptt.ir/downloads/raavi/audio/v1/models/ggml-small-q5_1.bin",
    ),
    sha256: "ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb",
  },
  accurate: {
    label: "دقیق",
    suitableFor: "سیستم قوی و صدای دشوار",
    detail: "دقت بیشتر، دانلود و زمان پردازش بیشتر",
    fileName: "ggml-medium-q5_0.bin",
    sizeBytes: 539_212_467,
    url: audioDownloadUrl(
      "ggml-medium-q5_0.bin",
      "https://dl2.gptt.ir/downloads/raavi/audio/v1/models/ggml-medium-q5_0.bin",
    ),
    sha256: "19fea4b380c3a618ec4723c3eef2eb785ffba0d0538cf43f8f235e7b3b34220f",
  },
};

function normalized(value) {
  return path.resolve(String(value ?? "")).toLocaleLowerCase("en-US");
}

function safeAssetName(fileName) {
  const extension = path.extname(fileName).toLocaleLowerCase("en-US");
  const base = path.basename(fileName, extension)
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "-")
    .replace(/\s+/gu, "-")
    .slice(0, 80) || "audio";
  return `${base}-${randomUUID().slice(0, 8)}${extension}`;
}

function assetDirectory(documentPath) {
  const extension = path.extname(documentPath);
  const base = path.basename(documentPath, extension);
  return path.join(path.dirname(documentPath), `${base}.assets`);
}

function assetPath(documentPath, relativePath) {
  const root = path.resolve(assetDirectory(documentPath));
  const candidate = path.resolve(path.dirname(documentPath), decodeURI(String(relativePath ?? "")));
  const inside = path.relative(root, candidate);
  if (!inside || inside.startsWith("..") || path.isAbsolute(inside)) {
    throw new Error("مسیر فایل صوتی بیرون از پوشهٔ دارایی‌های سند است.");
  }
  return candidate;
}

function referencedAudioPaths(markdown) {
  const sources = [];
  const pattern = /^\[[^\]\r\n]+\]\(\s*(?:<([^>]+)>|([^\s)]+))\s+["']raavi-audio["']\s*\)$/gmu;
  for (const match of String(markdown ?? "").matchAll(pattern)) {
    const source = String(match[1] ?? match[2] ?? "").trim();
    if (!source) continue;
    try {
      sources.push(decodeURI(source));
    } catch {
      sources.push(source);
    }
  }
  return [...new Set(sources)].slice(0, 128);
}

function spawnCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || `${path.basename(command)} با کد ${code} متوقف شد.`));
    });
  });
}

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

async function hashFile(filePath, algorithm) {
  const hash = createHash(algorithm);
  return new Promise((resolve, reject) => {
    const source = createReadStream(filePath);
    source.on("data", (chunk) => hash.update(chunk));
    source.once("error", reject);
    source.once("end", () => resolve(hash.digest("hex")));
  });
}

function ffmpegCandidates() {
  const installedCandidate = path.join(
    app.getPath("userData"),
    "audio-local",
    "tools",
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  );
  const moduleCandidate = path.resolve("node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  const packagedCandidate = path.join(process.resourcesPath || "", "app.asar.unpacked", "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  return [
    process.env.FFMPEG_BIN,
    installedCandidate,
    packagedCandidate,
    moduleCandidate,
    "ffmpeg",
  ].filter(Boolean);
}

async function resolveFfmpeg() {
  for (const candidate of ffmpegCandidates()) {
    if (candidate === "ffmpeg") {
      try { await spawnCommand(candidate, ["-version"]); return candidate; } catch { continue; }
    }
    try {
      const info = await stat(candidate);
      if (info.size > 1_000_000) return candidate;
    } catch { /* Try the next source. */ }
  }
  throw new Error("پیش‌نیاز محلی صوت نصب نشده است؛ مدل گفتار را دوباره نصب کنید.");
}

async function probeDuration(filePath) {
  try {
    return await readAudioMetadataDuration(filePath);
  } catch {
    // Some uncommon containers need ffmpeg's demuxer as a fallback.
  }

  let output = "";
  try {
    const ffmpeg = await resolveFfmpeg();
    const result = await spawnCommand(ffmpeg, ["-hide_banner", "-i", filePath, "-f", "null", "-"]);
    output = result.stderr;
  } catch (cause) {
    output = cause instanceof Error ? cause.message : String(cause);
  }
  const match = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/u);
  if (match) {
    return Math.round((Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000);
  }
  throw new Error("مدت یا سلامت فایل صوتی قابل تشخیص نیست.");
}

async function downloadTo(url, destination, { signal, onProgress, totalHint = 0 } = {}) {
  await mkdir(path.dirname(destination), { recursive: true });
  const partial = `${destination}.part`;
  let offset = 0;
  try { offset = (await stat(partial)).size; } catch { offset = 0; }
  const headers = offset ? { Range: `bytes=${offset}-` } : {};
  const response = await fetch(url, { headers, signal, redirect: "follow" });
  if (!response.ok && response.status !== 206) throw new Error(`دانلود با پاسخ ${response.status} متوقف شد.`);
  if (offset && response.status === 200) {
    await rm(partial, { force: true });
    offset = 0;
  }
  const remaining = Number(response.headers.get("content-length") ?? 0);
  const total = Math.max(totalHint, offset + remaining);
  let downloaded = offset;
  const reader = response.body?.getReader();
  if (!reader) throw new Error("جریان دانلود در دسترس نیست.");
  const target = createWriteStream(partial, { flags: offset ? "a" : "w" });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!target.write(Buffer.from(value))) await new Promise((resolve) => target.once("drain", resolve));
      downloaded += value.byteLength;
      onProgress?.(downloaded, total);
    }
  } finally {
    await new Promise((resolve) => target.end(resolve));
  }
  await rename(partial, destination);
  return { downloaded, total };
}

function parseWhisperJson(value, offsetMs) {
  const rows = Array.isArray(value?.transcription)
    ? value.transcription
    : Array.isArray(value?.segments)
      ? value.segments
      : [];
  return rows.map((row) => {
    const hasMillisecondOffsets = Boolean(row.offsets || row.timestamps);
    const offsets = row.offsets ?? row.timestamps ?? {};
    const start = Number(offsets.from ?? offsets.start ?? row.start ?? 0);
    const end = Number(offsets.to ?? offsets.end ?? row.end ?? start);
    const multiplier = hasMillisecondOffsets ? 1 : 1000;
    const probabilities = Array.isArray(row.tokens)
      ? row.tokens.map((token) => Number(token.p ?? token.probability)).filter(Number.isFinite)
      : [];
    const confidence = probabilities.length
      ? probabilities.reduce((sum, item) => sum + item, 0) / probabilities.length
      : 0.72;
    return {
      id: randomUUID(),
      startMs:
        (hasMillisecondOffsets ? 0 : offsetMs) +
        Math.max(0, Math.round(start * multiplier)),
      endMs:
        (hasMillisecondOffsets ? 0 : offsetMs) +
        Math.max(0, Math.round(end * multiplier)),
      text: String(row.text ?? row.content ?? "").trim(),
      confidence,
      uncertain: confidence < 0.48 || /\[(?:inaudible|BLANK_AUDIO|نامفهوم)\]/iu.test(String(row.text ?? "")),
    };
  }).filter((row) => row.text);
}

export function createAudioLocalController({ emit, ensureDocumentAccess, getOwner }) {
  const dataRoot = path.join(app.getPath("userData"), "audio-local");
  const toolRoot = path.join(dataRoot, "tools", ENGINE.version);
  const modelRoot = path.join(dataRoot, "models");
  const workRoot = path.join(dataRoot, "jobs");
  const statePath = path.join(dataRoot, "state.json");
  const jobsPath = path.join(dataRoot, "jobs.json");
  const backupAudioRoot = path.join(dataRoot, "backup-opus");
  const protocolTokens = new Map();
  const protocolTokensByPath = new Map();
  const jobs = new Map();
  const processes = new Map();
  let loaded = false;
  let modelState = { activeTier: null };
  let installController = null;
  let installTier = null;
  let installComponent = null;
  let installState = "idle";
  let installProgress = { downloadedBytes: 0, totalBytes: 0, progress: 0, error: "" };
  let lastProgressNoticeAt = 0;

  async function load() {
    if (loaded) return;
    loaded = true;
    await mkdir(dataRoot, { recursive: true });
    try { modelState = JSON.parse(await readFile(statePath, "utf8")); } catch { modelState = { activeTier: null }; }
    try {
      const stored = JSON.parse(await readFile(jobsPath, "utf8"));
      for (const job of Array.isArray(stored) ? stored : []) {
        if (["queued", "preparing", "transcribing"].includes(job.phase)) job.phase = "paused";
        job.prepared = Boolean(job.prepared || job.currentChunk > 0);
        // Jobs created before v2.1 used five-minute chunks. Preserve their
        // offsets when resuming, while new jobs use smaller one-minute chunks.
        job.chunkMs = Number(job.chunkMs) > 0 ? Number(job.chunkMs) : LEGACY_CHUNK_MS;
        jobs.set(job.id, job);
      }
    } catch { /* First run. */ }
  }

  async function persistState() {
    await mkdir(dataRoot, { recursive: true });
    await writeFile(statePath, JSON.stringify(modelState, null, 2), "utf8");
  }
  async function persistJobs() {
    await mkdir(dataRoot, { recursive: true });
    await writeFile(jobsPath, JSON.stringify([...jobs.values()], null, 2), "utf8");
  }

  function recommendedTier() {
    const memory = os.totalmem();
    const cores = os.cpus().length;
    if (memory < 8 * 1024 ** 3 || cores < 4) return "light";
    if (memory < 24 * 1024 ** 3 || cores < 10) return "balanced";
    return "accurate";
  }

  async function publicModelState() {
    await load();
    const recommended = recommendedTier();
    const tiers = await Promise.all(Object.entries(MODEL_TIERS).map(async ([id, tier]) => ({
      id,
      label: tier.label,
      suitableFor: tier.suitableFor,
      detail: tier.detail,
      sizeBytes: tier.sizeBytes,
      installed: await exists(path.join(modelRoot, tier.fileName)),
      recommended: id === recommended,
    })));
    const activeModelReady = tiers.some(
      (tier) => tier.id === modelState.activeTier && tier.installed,
    );
    const runtimeReady =
      (await exists(path.join(dataRoot, "tools", "ffmpeg.exe"))) &&
      Boolean(
        await findPreferredWhisperExecutable(toolRoot),
      );
    const resolvedActiveTier = resolveActiveAudioModelTier({
      activeTier: activeModelReady ? modelState.activeTier : null,
      runtimeReady,
      tiers,
    });
    if (resolvedActiveTier && modelState.activeTier !== resolvedActiveTier) {
      modelState.activeTier = resolvedActiveTier;
      await persistState();
    }
    return {
      supported: process.platform === "win32",
      activeTier: resolvedActiveTier,
      installState,
      installTier,
      installComponent,
      progress: installProgress.progress,
      downloadedBytes: installProgress.downloadedBytes,
      totalBytes: installProgress.totalBytes,
      error: installProgress.error,
      tiers,
    };
  }

  async function notifyModel() { emit({ type: "model", state: await publicModelState() }); }
  function emitJobProgress(job) {
    job.updatedAt = new Date().toISOString();
    emit({ type: "transcription", job: { ...job, segments: [...job.segments] } });
  }
  async function notifyJob(job) {
    job.updatedAt = new Date().toISOString();
    await persistJobs();
    emit({ type: "transcription", job: { ...job, segments: [...job.segments] } });
  }

  async function beginInstallStage(component, totalBytes) {
    installComponent = component;
    installState = "downloading";
    installProgress = {
      downloadedBytes: 0,
      totalBytes,
      progress: 0,
      error: "",
    };
    lastProgressNoticeAt = 0;
    await notifyModel();
  }

  function reportInstallProgress(downloadedBytes, totalBytes) {
    installProgress = {
      ...installProgress,
      downloadedBytes,
      totalBytes,
      progress: totalBytes ? Math.min(1, downloadedBytes / totalBytes) : 0,
    };
    const now = Date.now();
    if (downloadedBytes >= totalBytes || now - lastProgressNoticeAt >= 150) {
      lastProgressNoticeAt = now;
      void notifyModel();
    }
  }

  async function chooseAudioAsset(_event, documentPath) {
    await ensureDocumentAccess(documentPath);
    const result = await dialog.showOpenDialog(getOwner(), {
      title: "افزودن فایل صوتی",
      buttonLabel: "افزودن صوت",
      properties: ["openFile"],
      filters: [
        { name: "فایل صوتی", extensions: ["mp3", "wav", "m4a", "aac", "flac", "ogg", "webm"] },
        { name: "همهٔ فایل‌ها", extensions: ["*"] },
      ],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const selected = path.resolve(result.filePaths[0]);
    const extension = path.extname(selected).toLocaleLowerCase("en-US");
    if (!AUDIO_EXTENSIONS.has(extension)) throw new Error("فرمت این فایل صوتی پشتیبانی نمی‌شود.");
    const info = await stat(selected);
    if (!info.isFile() || info.size <= 0 || info.size > MAX_AUDIO_BYTES) throw new Error("حجم یا ساختار فایل صوتی معتبر نیست.");
    const durationMs = await probeDuration(selected);
    if (durationMs > MAX_AUDIO_DURATION_MS) throw new Error("فایل صوتی بیشتر از ۶۰ دقیقه است.");
    const root = assetDirectory(documentPath);
    await mkdir(root, { recursive: true });
    const fileName = safeAssetName(path.basename(selected));
    const target = path.join(root, fileName);
    await copyFile(selected, target);
    const relativePath = `./${path.basename(root)}/${fileName}`;
    const resolved = await resolveAudioAsset(null, documentPath, relativePath);
    return {
      fileName: path.basename(selected),
      relativePath,
      sourceUrl: resolved.source,
      mimeType: `audio/${extension.slice(1)}`,
      size: info.size,
      durationMs,
    };
  }

  async function removeAudioAsset(_event, documentPath, relativePath) {
    await ensureDocumentAccess(documentPath);
    const target = assetPath(documentPath, relativePath);
    await rm(target, { force: true });
    const token = protocolTokensByPath.get(normalized(target));
    if (token) {
      protocolTokens.delete(token);
      protocolTokensByPath.delete(normalized(target));
    }
    return { removed: true };
  }

  async function resolveAudioAsset(_event, documentPath, relativePath) {
    await ensureDocumentAccess(documentPath);
    const target = assetPath(documentPath, relativePath);
    const info = await stat(target);
    if (!info.isFile()) throw new Error("فایل صوتی کنار سند پیدا نشد.");
    const targetKey = normalized(target);
    const token = protocolTokensByPath.get(targetKey) ?? randomUUID();
    protocolTokens.set(token, target);
    protocolTokensByPath.set(targetKey, token);
    return { status: "ready", source: `raavi-audio://asset/${token}` };
  }

  function resolveProtocol(urlValue) {
    const url = new URL(urlValue);
    const token = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
    return protocolTokens.get(token) ?? "";
  }

  async function extractEngine(zipPath) {
    await rm(toolRoot, { recursive: true, force: true });
    await mkdir(toolRoot, { recursive: true });
    await extractZipArchive(zipPath, toolRoot);
  }

  async function runInstall(tierId) {
    const tier = MODEL_TIERS[tierId];
    const downloadRoot = path.join(dataRoot, "downloads");
    const engineZip = path.join(downloadRoot, `whisper-${ENGINE.version}.zip`);
    const ffmpegArchive = path.join(downloadRoot, "ffmpeg-win32-x64.gz");
    const ffmpegPath = path.join(dataRoot, "tools", "ffmpeg.exe");
    const modelPath = path.join(modelRoot, tier.fileName);
    installController = new AbortController();
    try {
      if (!(await exists(ffmpegPath))) {
        await beginInstallStage("ffmpeg", FFMPEG.sizeBytes);
        await downloadTo(FFMPEG.url, ffmpegArchive, {
          signal: installController.signal,
          totalHint: FFMPEG.sizeBytes,
          onProgress: reportInstallProgress,
        });
        installState = "verifying";
        await notifyModel();
        if ((await hashFile(ffmpegArchive, "sha256")) !== FFMPEG.sha256) {
          await rm(ffmpegArchive, { force: true });
          throw new Error("Checksum پیش‌نیاز صوت معتبر نیست.");
        }
        installState = "installing";
        await notifyModel();
        await mkdir(path.dirname(ffmpegPath), { recursive: true });
        await pipeline(
          createReadStream(ffmpegArchive),
          createGunzip(),
          createWriteStream(ffmpegPath),
        );
      }
      if (!(await findPreferredWhisperExecutable(toolRoot))) {
        const reusableEngineArchive =
          (await exists(engineZip)) &&
          (await hashFile(engineZip, "sha256")) === ENGINE.sha256;
        if (!reusableEngineArchive) {
          await rm(engineZip, { force: true });
          await beginInstallStage("engine", ENGINE.sizeBytes);
          await downloadTo(ENGINE.url, engineZip, {
            signal: installController.signal,
            totalHint: ENGINE.sizeBytes,
            onProgress: reportInstallProgress,
          });
        }
        installComponent = "engine";
        installState = "verifying"; await notifyModel();
        if ((await hashFile(engineZip, "sha256")) !== ENGINE.sha256) throw new Error("Checksum ابزار تبدیل گفتار معتبر نیست.");
        installState = "installing"; await notifyModel();
        await extractEngine(engineZip);
      }
      await mkdir(modelRoot, { recursive: true });
      if (!(await exists(modelPath))) {
        await beginInstallStage("model", tier.sizeBytes);
        await downloadTo(tier.url, modelPath, {
          signal: installController.signal,
          totalHint: tier.sizeBytes,
          onProgress: reportInstallProgress,
        });
      }
      installComponent = "model";
      installState = "verifying"; await notifyModel();
      if ((await hashFile(modelPath, "sha256")) !== tier.sha256) {
        await rm(modelPath, { force: true });
        throw new Error("Checksum مدل گفتار معتبر نیست؛ بسته حذف شد.");
      }
      installState = "installing"; await notifyModel();
      modelState.activeTier = tierId;
      await persistState();
      installState = "idle";
      installTier = null;
      installComponent = null;
      installProgress = { downloadedBytes: tier.sizeBytes, totalBytes: tier.sizeBytes, progress: 1, error: "" };
      await notifyModel();
    } catch (cause) {
      if (cause?.name === "AbortError") {
        installState = "paused";
      } else {
        installState = "error";
        installProgress.error = cause instanceof Error ? cause.message : "نصب مدل کامل نشد.";
      }
      await notifyModel();
    } finally {
      installController = null;
    }
  }

  async function installAudioModel(_event, tierId) {
    await load();
    if (process.platform !== "win32") {
      throw new Error("نصب خودکار مدل گفتار در این نسخه برای Windows آماده است.");
    }
    if (!MODEL_TIERS[tierId]) throw new Error("سطح مدل ناشناخته است.");
    const existing = path.join(modelRoot, MODEL_TIERS[tierId].fileName);
    const installedFfmpeg = path.join(dataRoot, "tools", "ffmpeg.exe");
    const installedWhisper = await findPreferredWhisperExecutable(toolRoot);
    const existingModelValid =
      (await exists(existing)) &&
      (await hashFile(existing, "sha256")) === MODEL_TIERS[tierId].sha256;
    if ((await exists(existing)) && !existingModelValid) {
      await rm(existing, { force: true });
    }
    if (
      existingModelValid &&
      (await exists(installedFfmpeg)) &&
      installedWhisper
    ) {
      modelState.activeTier = tierId;
      await persistState();
      installState = "idle";
      installTier = null;
      installComponent = null;
      installProgress = {
        downloadedBytes: MODEL_TIERS[tierId].sizeBytes,
        totalBytes: MODEL_TIERS[tierId].sizeBytes,
        progress: 1,
        error: "",
      };
      await notifyModel();
      return publicModelState();
    }
    if (installController) throw new Error("دانلود مدل دیگری در حال انجام است.");
    installTier = tierId;
    void runInstall(tierId);
    return publicModelState();
  }

  async function pauseAudioModelInstall() {
    installController?.abort();
    installState = "paused";
    await notifyModel();
    return publicModelState();
  }
  async function resumeAudioModelInstall() {
    if (!installTier) throw new Error("دانلود متوقف‌شده‌ای وجود ندارد.");
    void runInstall(installTier);
    return publicModelState();
  }
  async function deleteAudioModel(_event, tierId) {
    if (!MODEL_TIERS[tierId]) throw new Error("سطح مدل ناشناخته است.");
    await rm(path.join(modelRoot, MODEL_TIERS[tierId].fileName), { force: true });
    if (modelState.activeTier === tierId) modelState.activeTier = null;
    await persistState();
    await notifyModel();
    return publicModelState();
  }

  async function processJob(job) {
    const tier = MODEL_TIERS[job.tier];
    const source = assetPath(job.documentPath, job.relativePath);
    const ffmpeg = await resolveFfmpeg();
    const whisper = await findPreferredWhisperExecutable(toolRoot);
    const model = path.join(modelRoot, tier.fileName);
    if (!whisper || !(await exists(model))) throw new Error("مدل گفتار کامل نصب نشده است.");
    const jobRoot = path.join(workRoot, job.id);
    const wavPath = path.join(jobRoot, "source.wav");
    await mkdir(jobRoot, { recursive: true });
    if (!job.prepared || !(await exists(wavPath))) {
      await rm(wavPath, { force: true }).catch(() => {});
      job.phase = "preparing";
      await notifyJob(job);
      const child = spawn(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", source, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavPath], { windowsHide: true });
      processes.set(job.id, child);
      await new Promise((resolve, reject) => {
        let stderr = "";
        child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
        child.once("error", reject);
        child.once("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || "آماده‌سازی صوت کامل نشد.")));
      });
      processes.delete(job.id);
      if (job.phase === "paused" || job.phase === "cancelled") return;
      job.prepared = true;
      await notifyJob(job);
    }
    const startedAt = Date.now();
    const initialProgress = Math.max(
      Number(job.progress) || 0,
      job.currentChunk / Math.max(1, job.totalChunks),
    );
    let lastLiveProgressAt = 0;
    job.phase = "transcribing";
    for (let chunkIndex = job.currentChunk; chunkIndex < job.totalChunks; chunkIndex += 1) {
      if (job.phase === "paused" || job.phase === "cancelled") break;
      job.currentChunk = chunkIndex;
      const chunkMs = Number(job.chunkMs) > 0 ? Number(job.chunkMs) : LEGACY_CHUNK_MS;
      const outputBase = path.join(jobRoot, `chunk-${chunkIndex}`);
      const offset = chunkIndex * chunkMs;
      const duration = Math.min(chunkMs, job.durationMs - offset);
      await notifyJob(job);
      // whisper.cpp on Windows still narrows Unicode arguments in a few file
      // loaders. Keep its working directory at the audio data root and pass
      // ASCII-only relative paths (models/jobs use stable English names).
      const runtimePaths = whisperRuntimePaths(dataRoot, {
        modelPath: model,
        outputBase,
        wavPath,
      });
      const child = spawn(whisper, ["-m", runtimePaths.modelPath, "-f", runtimePaths.wavPath, "-l", "auto", "-ojf", "-of", runtimePaths.outputBase, "-ot", String(offset), "-d", String(duration), "-t", String(Math.max(1, Math.min(8, os.cpus().length - 1))), "-ng", "-pp"], {
        cwd: dataRoot,
        windowsHide: true,
      });
      processes.set(job.id, child);
      await new Promise((resolve, reject) => {
        let stdout = "";
        let stderr = "";
        const capture = (target) => (chunk) => {
          const text = chunk.toString();
          if (target === "stdout") stdout += text;
          else stderr += text;
          const withinChunk = whisperProgressFromOutput(text);
          if (withinChunk === null) return;
          const nextProgress = Math.min(
            1,
            (chunkIndex + withinChunk) / Math.max(1, job.totalChunks),
          );
          if (nextProgress > job.progress) job.progress = nextProgress;
          const elapsedSeconds = Math.max(0.1, (Date.now() - startedAt) / 1000);
          const advanced = job.progress - initialProgress;
          if (advanced > 0) {
            job.etaSeconds = Math.max(
              0,
              Math.round((elapsedSeconds / advanced) * (1 - job.progress)),
            );
          }
          const now = Date.now();
          if (withinChunk >= 1 || now - lastLiveProgressAt >= 250) {
            lastLiveProgressAt = now;
            emitJobProgress(job);
          }
        };
        child.stdout.on("data", capture("stdout"));
        child.stderr.on("data", capture("stderr"));
        child.once("error", reject);
        child.once("close", (code) => {
          if (job.phase === "paused" || job.phase === "cancelled") resolve();
          else if (code === 0) resolve();
          else reject(new Error([stderr, stdout].map((value) => value.trim()).filter(Boolean).join("\n") || "پردازش یک قطعه کامل نشد."));
        });
      });
      processes.delete(job.id);
      if (job.phase === "paused" || job.phase === "cancelled") break;
      const parsed = JSON.parse(await readFile(`${outputBase}.json`, "utf8"));
      const segmentRows = parseWhisperJson(parsed, offset);
      job.segments = [...job.segments.filter((segment) => segment.startMs < offset || segment.startMs >= offset + duration), ...segmentRows].sort((a, b) => a.startMs - b.startMs);
      job.currentChunk = chunkIndex + 1;
      job.progress = job.currentChunk / job.totalChunks;
      const elapsed = Math.max(0.1, (Date.now() - startedAt) / 1000);
      const advanced = job.progress - initialProgress;
      job.etaSeconds = advanced > 0
        ? Math.max(0, Math.round((elapsed / advanced) * (1 - job.progress)))
        : null;
      await notifyJob(job);
    }
    if (job.phase === "cancelled" || job.phase === "paused") return;
    job.phase = "complete";
    job.progress = 1;
    job.etaSeconds = 0;
    await notifyJob(job);
  }

  async function runJob(job) {
    try { await processJob(job); }
    catch (cause) {
      if (job.phase === "paused" || job.phase === "cancelled") return;
      job.phase = "error";
      job.error = cause instanceof Error ? cause.message : "تبدیل گفتار کامل نشد.";
      await notifyJob(job);
    }
  }

  async function startAudioTranscription(_event, payload) {
    await load();
    await ensureDocumentAccess(payload.documentPath);
    const source = assetPath(payload.documentPath, payload.relativePath);
    const durationMs = payload.durationMs > 0 ? payload.durationMs : await probeDuration(source);
    if (durationMs > MAX_AUDIO_DURATION_MS) throw new Error("فایل صوتی بیشتر از ۶۰ دقیقه است.");
    if (!MODEL_TIERS[payload.tier] || !(await exists(path.join(modelRoot, MODEL_TIERS[payload.tier].fileName)))) throw new Error("مدل گفتار انتخاب‌شده نصب نیست.");
    const job = {
      id: randomUUID(),
      documentPath: path.resolve(payload.documentPath),
      relativePath: payload.relativePath,
      fileName: payload.fileName,
      durationMs,
      tier: payload.tier,
      phase: "queued",
      progress: 0,
      currentChunk: 0,
      chunkMs: DEFAULT_CHUNK_MS,
      totalChunks: Math.max(1, Math.ceil(durationMs / DEFAULT_CHUNK_MS)),
      etaSeconds: null,
      segments: [],
      error: "",
      prepared: false,
      updatedAt: new Date().toISOString(),
    };
    jobs.set(job.id, job);
    await notifyJob(job);
    void runJob(job);
    return { ...job };
  }
  async function pauseAudioTranscription(_event, jobId) {
    const job = jobs.get(jobId);
    if (!job) throw new Error("پردازش صوت پیدا نشد.");
    const wasPreparing = job.phase === "preparing";
    job.phase = "paused";
    processes.get(jobId)?.kill();
    if (wasPreparing) {
      await rm(path.join(workRoot, job.id, "source.wav"), { force: true }).catch(() => {});
    }
    await notifyJob(job);
    return { ...job };
  }
  async function resumeAudioTranscription(_event, jobId) {
    const job = jobs.get(jobId);
    if (!job) throw new Error("پردازش صوت پیدا نشد.");
    if (job.phase === "complete") return { ...job };
    job.phase = "transcribing";
    job.error = "";
    await notifyJob(job);
    void runJob(job);
    return { ...job };
  }
  async function cancelAudioTranscription(_event, jobId) {
    const job = jobs.get(jobId);
    if (!job) throw new Error("پردازش صوت پیدا نشد.");
    job.phase = "cancelled";
    processes.get(jobId)?.kill();
    await notifyJob(job);
    return { ...job };
  }
  async function listAudioTranscriptionJobs(_event, documentPath) {
    await load();
    await ensureDocumentAccess(documentPath);
    const key = normalized(documentPath);
    return [...jobs.values()].filter((job) => normalized(job.documentPath) === key).map((job) => ({ ...job, segments: [...job.segments] }));
  }

  async function saveAudioTranscriptionResult(_event, jobId, result) {
    await load();
    const job = jobs.get(jobId);
    if (!job) throw new Error("پردازش صوت پیدا نشد.");
    if (job.phase !== "complete") {
      throw new Error("متن صوت هنوز برای بازسازی آماده نیست.");
    }
    const kind = String(result?.kind ?? "");
    const title = String(result?.title ?? "").trim().slice(0, 240);
    const markdown = String(result?.markdown ?? "").trim();
    const validKinds = new Set([
      "meeting", "interview", "lecture", "phone-call", "voice-note", "conversation", "general",
    ]);
    if (!validKinds.has(kind) || !title || !markdown || markdown.length > 1_200_000) {
      throw new Error("پیش‌نمایش بازسازی‌شده معتبر نیست.");
    }
    job.structured = { kind, title, markdown, kindLabel: String(result?.kindLabel ?? "") };
    job.cleanedAt = new Date().toISOString();
    await notifyJob(job);
    return { ...job, segments: [...job.segments], structured: { ...job.structured } };
  }

  async function prepareBackupAssets(snapshot) {
    const rawDocumentPath = String(snapshot?.activeDocumentPath ?? "").trim();
    if (!rawDocumentPath || !snapshot?.content) return [];
    const documentPath = path.resolve(rawDocumentPath);
    await ensureDocumentAccess(documentPath);
    const sources = referencedAudioPaths(snapshot.content);
    if (!sources.length) return [];
    const ffmpeg = await resolveFfmpeg();
    await mkdir(backupAudioRoot, { recursive: true });
    const prepared = [];
    for (const relativePath of sources) {
      const sourcePath = assetPath(documentPath, relativePath);
      const sourceInfo = await stat(sourcePath);
      if (!sourceInfo.isFile() || sourceInfo.size <= 0) continue;
      const sourceHash = await hashFile(sourcePath, "sha256");
      const targetPath = path.join(backupAudioRoot, `${sourceHash}.opus`);
      if (!(await exists(targetPath))) {
        const temporaryPath = `${targetPath}.tmp`;
        try {
          await spawnCommand(ffmpeg, [
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            sourcePath,
            "-vn",
            "-c:a",
            "libopus",
            "-b:a",
            "48k",
            "-vbr",
            "on",
            "-compression_level",
            "10",
            "-application",
            "audio",
            "-f",
            "ogg",
            temporaryPath,
          ]);
          await rename(temporaryPath, targetPath);
        } catch (error) {
          await rm(temporaryPath, { force: true });
          throw error;
        }
      }
      const bytes = await readFile(targetPath);
      prepared.push({
        id: `audio-${sourceHash}`,
        name: `${path.basename(sourcePath, path.extname(sourcePath))}.opus`,
        mimeType: "audio/ogg",
        data: bytes.toString("base64"),
        size: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        sourcePath: relativePath,
      });
    }
    return prepared;
  }

  return {
    chooseAudioAsset,
    removeAudioAsset,
    resolveAudioAsset,
    resolveProtocol,
    getAudioModelState: publicModelState,
    installAudioModel,
    pauseAudioModelInstall,
    resumeAudioModelInstall,
    deleteAudioModel,
    startAudioTranscription,
    pauseAudioTranscription,
    resumeAudioTranscription,
    cancelAudioTranscription,
    listAudioTranscriptionJobs,
    saveAudioTranscriptionResult,
    prepareBackupAssets,
    dispose() {
      installController?.abort();
      for (const child of processes.values()) child.kill();
      processes.clear();
      protocolTokens.clear();
      protocolTokensByPath.clear();
    },
  };
}
