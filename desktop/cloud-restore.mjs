import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ANNOTATION_BLOCK_PATTERN =
  /(?:\r?\n){0,2}<!--\s*raavi:annotations:v1\s*\r?\n([\s\S]*?)\r?\n-->\s*$/u;

function safeName(value, fallback = "document") {
  return (
    String(value || fallback)
      .normalize("NFKC")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "-")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 180) || fallback
  );
}

function markdownName(value) {
  const base = safeName(path.basename(String(value || "document.md")), "document.md")
    .replace(/\.(?:md|markdown)$/iu, "")
    .trim();
  return `${base || "document"}.md`;
}

function mediaName(value, fallback = "file.bin") {
  return safeName(value, fallback).replace(/\s+/gu, "-");
}

function decodeAssetData(asset) {
  if (!asset || typeof asset.data !== "string" || !asset.data) return null;
  if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(asset.data)) return null;
  return Buffer.from(asset.data, "base64");
}

function stripAnnotationBlock(markdown) {
  return String(markdown || "")
    .replace(ANNOTATION_BLOCK_PATTERN, "")
    .replace(/\s+$/u, "");
}

function writeAnnotations(markdown, annotations) {
  const content = stripAnnotationBlock(markdown);
  const items = Array.isArray(annotations) ? annotations : [];
  if (!items.length) return content;
  const payload = {
    version: 1,
    comments: items.filter((item) => item?.kind === "comment"),
    highlights: items.filter((item) => item?.kind === "highlight"),
  };
  return `${content}\n\n<!-- raavi:annotations:v1\n${JSON.stringify(payload)}\n-->\n`;
}

async function availablePath(candidate, kind = "file") {
  const parsed = path.parse(candidate);
  for (let index = 1; index <= 10_000; index += 1) {
    const next =
      index === 1
        ? candidate
        : kind === "directory"
          ? path.join(parsed.dir, `${parsed.base} (${index.toLocaleString("en-US")})`)
          : path.join(
              parsed.dir,
              `${parsed.name} (${index.toLocaleString("en-US")})${parsed.ext}`,
            );
    try {
      await access(next);
    } catch {
      return next;
    }
  }
  throw new Error("RESTORE_DESTINATION_EXHAUSTED");
}

function restoreFolderName(now) {
  const stamp = new Date(now)
    .toISOString()
    .replace(/[:T]/gu, "-")
    .slice(0, 16);
  return `Raavi Restore ${stamp}`;
}

function posixRelative(value) {
  return String(value).split(path.sep).join("/");
}

function replaceLiteral(source, value, replacement) {
  if (!value) return source;
  return source.split(value).join(replacement);
}

async function writeMediaFiles({
  restoreRoot,
  documentBase,
  assets,
  audio,
  attachments,
}) {
  const mediaRoot = `${documentBase}-files`;
  const imageReferences = new Map();
  const pathReferences = new Map();
  const written = [];

  const writeItems = async (items, directoryName, kind) => {
    for (const [index, asset] of (Array.isArray(items) ? items : []).entries()) {
      const bytes = decodeAssetData(asset);
      if (!bytes) continue;
      const identity = safeName(asset.id || `${kind}-${index + 1}`, `${kind}-${index + 1}`);
      const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 10);
      const fileName = `${identity.slice(0, 36)}-${hash}-${mediaName(asset.name, `${kind}.bin`)}`;
      const relativePath = path.join(mediaRoot, directoryName, fileName);
      const absolutePath = path.join(restoreRoot, relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, bytes);
      const markdownPath = posixRelative(relativePath);
      written.push(absolutePath);
      if (kind === "image" && asset.id) {
        imageReferences.set(String(asset.id), markdownPath);
      }
      if (typeof asset.sourcePath === "string" && asset.sourcePath) {
        pathReferences.set(asset.sourcePath, markdownPath);
        pathReferences.set(asset.sourcePath.replace(/\\/gu, "/"), markdownPath);
      }
    }
  };

  await writeItems(assets, "Images", "image");
  await writeItems(audio, "Audio", "audio");
  await writeItems(attachments, "Attachments", "attachment");
  return { imageReferences, pathReferences, written };
}

function remapMarkdown(markdown, references) {
  let next = String(markdown || "");
  next = next.replace(
    /raavi-image:\/\/([a-z0-9][a-z0-9-]{0,119})/giu,
    (source, id) => references.imageReferences.get(id) ?? source,
  );
  for (const [sourcePath, replacement] of references.pathReferences) {
    next = replaceLiteral(next, sourcePath, replacement);
  }
  return next;
}

export async function restoreCloudBackupSet({
  documentIds,
  parentDirectory,
  downloadBackup,
  saveHistory = async () => {},
  now = () => Date.now(),
}) {
  if (!Array.isArray(documentIds) || !documentIds.length) {
    throw new Error("RESTORE_SELECTION_EMPTY");
  }
  const resolvedParent = path.resolve(String(parentDirectory || ""));
  const restoreRoot = await availablePath(
    path.join(resolvedParent, restoreFolderName(now())),
    "directory",
  );
  await mkdir(restoreRoot, { recursive: true });

  const restored = [];
  const failed = [];
  for (const documentId of [...new Set(documentIds)].slice(0, 1_000)) {
    try {
      const backup = await downloadBackup(documentId);
      const metadata = backup?.metadata ?? {};
      const requestedName = markdownName(metadata.fileName || `${documentId}.md`);
      const destination = await availablePath(path.join(restoreRoot, requestedName));
      const documentBase = path.basename(destination, path.extname(destination));
      const references = await writeMediaFiles({
        restoreRoot,
        documentBase,
        assets: backup.assets,
        audio: backup.audio,
        attachments: backup.attachments,
      });
      const content = remapMarkdown(backup.content, references);
      const finalMarkdown = writeAnnotations(content, metadata.annotations);
      await writeFile(destination, finalMarkdown, "utf8");

      const versions = (Array.isArray(metadata.versions) ? metadata.versions : [])
        .filter(
          (version) =>
            version &&
            Number.isSafeInteger(version.number) &&
            version.number > 0 &&
            typeof version.content === "string",
        )
        .slice(-50)
        .map((version) => ({
          ...version,
          content: remapMarkdown(version.content, references),
          annotations: Array.isArray(version.annotations) ? version.annotations : [],
        }));
      const revision = Math.max(1, ...versions.map((version) => version.number));
      await saveHistory(destination, revision, versions);
      restored.push({
        documentId,
        fileName: path.basename(destination),
        filePath: destination,
        mediaCount: references.written.length,
        versionCount: versions.length,
      });
    } catch (error) {
      failed.push({
        documentId,
        message: error instanceof Error ? error.message : "RESTORE_FAILED",
      });
    }
  }

  if (!restored.length && failed.length) {
    const error = new Error("هیچ‌یک از بکاپ‌های انتخاب‌شده بازیابی نشد.");
    error.code = "restore-failed";
    error.failures = failed;
    throw error;
  }
  return { restoreRoot, restored, failed };
}

export const cloudRestoreInternals = {
  markdownName,
  remapMarkdown,
  restoreFolderName,
  stripAnnotationBlock,
  writeAnnotations,
};
