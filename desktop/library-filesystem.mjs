import {
  access,
  lstat,
  mkdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const RESERVED_NAMES = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const INVALID_NAME = /[<>:"/\\|?*\u0000-\u001f]/u;

function operationError(code, message) {
  return Object.assign(new Error(message), { code });
}

export function validateLibraryName(name, { kind, markdownOnly = true }) {
  const normalized = String(name ?? "").normalize("NFC").trim();
  if (!normalized || normalized === "." || normalized === "..") {
    throw operationError("invalid-name", "Library entry name is empty.");
  }
  if (
    INVALID_NAME.test(normalized) ||
    normalized.endsWith(".") ||
    normalized.endsWith(" ") ||
    RESERVED_NAMES.test(normalized)
  ) {
    throw operationError("invalid-name", "Library entry name is invalid.");
  }
  if (
    kind === "file" &&
    markdownOnly &&
    !/\.(?:md|markdown)$/iu.test(normalized)
  ) {
    throw operationError("invalid-name", "New files must be Markdown files.");
  }
  return normalized;
}

export function safeLibraryPath(rootPath, relativePath, { allowRoot = false } = {}) {
  const root = path.resolve(String(rootPath));
  const raw = String(relativePath ?? "").normalize("NFC");
  if (path.isAbsolute(raw) || /^[a-z]:/iu.test(raw)) {
    throw operationError("unsafe-path", "Absolute paths are not allowed.");
  }
  const parts = raw.replace(/\\/gu, "/").split("/").filter(Boolean);
  if (!parts.length && !allowRoot) {
    throw operationError("unsafe-path", "The library root cannot be changed.");
  }
  if (
    parts.some(
      (part) =>
        part === "." ||
        part === ".." ||
        INVALID_NAME.test(part) ||
        part.endsWith(".") ||
        part.endsWith(" "),
    )
  ) {
    throw operationError("unsafe-path", "The requested path is unsafe.");
  }
  const target = path.resolve(root, ...parts);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw operationError("unsafe-path", "The requested path leaves the library.");
  }
  return target;
}

async function assertRealPathInside(rootPath, targetPath, { parent = false } = {}) {
  const realRoot = await realpath(rootPath);
  const candidate = await realpath(parent ? path.dirname(targetPath) : targetPath);
  const relative = path.relative(realRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw operationError("unsafe-path", "A symbolic link leaves the library.");
  }
}

async function assertMissing(targetPath) {
  try {
    await access(targetPath);
    throw operationError("already-exists", "The destination already exists.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function relativeLibraryPath(rootPath, targetPath) {
  return path.relative(rootPath, targetPath).split(path.sep).join("/");
}

export async function performLibraryMutation({
  rootPath,
  request,
  trashRoot,
}) {
  const resolvedRoot = path.resolve(rootPath);
  const rootStats = await stat(resolvedRoot);
  if (!rootStats.isDirectory()) throw operationError("missing", "Library root is missing.");

  if (request.kind === "create-file" || request.kind === "create-folder") {
    const parentPath = safeLibraryPath(resolvedRoot, request.parentPath, {
      allowRoot: true,
    });
    await assertRealPathInside(resolvedRoot, parentPath);
    const entryKind = request.kind === "create-file" ? "file" : "folder";
    const name = validateLibraryName(request.name, { kind: entryKind });
    const destination = safeLibraryPath(
      resolvedRoot,
      path.join(request.parentPath || "", name),
    );
    await assertMissing(destination);
    if (request.kind === "create-file") {
      await writeFile(destination, String(request.content ?? ""), {
        encoding: "utf8",
        flag: "wx",
      });
    } else {
      await mkdir(destination);
    }
    return {
      result: {
        kind: request.kind,
        rootId: request.rootId,
        nextPath: relativeLibraryPath(resolvedRoot, destination),
      },
    };
  }

  const source = safeLibraryPath(resolvedRoot, request.sourcePath);
  await assertRealPathInside(resolvedRoot, source);
  const sourceStats = await lstat(source);
  if (
    (request.entryKind === "folder" && !sourceStats.isDirectory()) ||
    (request.entryKind === "file" && !sourceStats.isFile())
  ) {
    throw operationError("missing", "The source changed before the operation.");
  }

  if (request.kind === "delete") {
    const token = randomUUID();
    const tokenRoot = path.join(trashRoot, token);
    await mkdir(tokenRoot, { recursive: true });
    const trashPath = path.join(tokenRoot, path.basename(source));
    await rename(source, trashPath);
    return {
      result: {
        kind: "delete",
        rootId: request.rootId,
        previousPath: request.sourcePath,
        undoToken: token,
      },
      undoRecord: {
        token,
        rootPath: resolvedRoot,
        originalPath: source,
        trashPath,
        tokenRoot,
      },
    };
  }

  const destination =
    request.kind === "rename"
      ? safeLibraryPath(
          resolvedRoot,
          path.join(
            path.dirname(request.sourcePath),
            (() => {
              const name = validateLibraryName(request.name, {
                kind: request.entryKind,
                markdownOnly: false,
              });
              if (request.entryKind === "file") {
                const validExtension = /\.ravi$/iu.test(path.basename(source))
                  ? /\.ravi$/iu.test(name)
                  : /\.(?:md|markdown)$/iu.test(name);
                if (!validExtension) {
                  throw operationError(
                    "invalid-name",
                    "The renamed document must keep a supported extension.",
                  );
                }
              }
              return name;
            })(),
          ),
        )
      : safeLibraryPath(
          resolvedRoot,
          path.join(request.destinationFolder, path.basename(source)),
        );
  await assertRealPathInside(resolvedRoot, destination, { parent: true });
  if (
    request.entryKind === "folder" &&
    (destination === source || destination.startsWith(`${source}${path.sep}`))
  ) {
    throw operationError(
      "unsafe-path",
      "A folder cannot be moved inside itself.",
    );
  }
  await assertMissing(destination);
  await rename(source, destination);
  return {
    result: {
      kind: request.kind,
      rootId: request.rootId,
      previousPath: request.sourcePath,
      nextPath: relativeLibraryPath(resolvedRoot, destination),
    },
  };
}

export async function undoLibraryDelete(record) {
  await assertMissing(record.originalPath);
  await assertRealPathInside(record.rootPath, record.originalPath, {
    parent: true,
  });
  await rename(record.trashPath, record.originalPath);
  await rm(record.tokenRoot, { recursive: true, force: true });
  return {
    kind: "undo",
    previousPath: relativeLibraryPath(record.rootPath, record.trashPath),
    nextPath: relativeLibraryPath(record.rootPath, record.originalPath),
  };
}
