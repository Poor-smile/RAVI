import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../dist/server/index.js";

const desktopDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientDirectory = path.resolve(desktopDirectory, "..", "dist", "client");
const MAX_LIBRARY_FILES = 20_000;
const MAX_MARKDOWN_SIZE = 2 * 1024 * 1024;
const MAX_RAVI_SIZE = 64 * 1024 * 1024;
const MAX_RAVI_IMAGE_ASSETS = 8;
const MAX_RAVI_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_RAVI_IMAGE_TOTAL_BYTES = 40 * 1024 * 1024;
const RAVI_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function normalizeAssetPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl).pathname);
  const relativePath = path.normalize(pathname).replace(/^[/\\]+/, "");
  const filePath = path.resolve(clientDirectory, relativePath);
  const relativeToClient = path.relative(clientDirectory, filePath);

  if (
    relativeToClient.startsWith("..") ||
    path.isAbsolute(relativeToClient)
  ) {
    return null;
  }

  return filePath;
}

async function fetchAsset(input) {
  const requestUrl =
    typeof input === "string" || input instanceof URL ? input.toString() : input.url;
  const filePath = normalizeAssetPath(requestUrl);
  if (!filePath) return new Response("Forbidden", { status: 403 });

  try {
    const file = await readFile(filePath);
    return new Response(file, {
      headers: {
        "Content-Type":
          CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) ??
          "application/octet-stream",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

async function requestBody(request) {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function handleRequest(nodeRequest) {
  const host = nodeRequest.headers.host ?? "127.0.0.1";
  const request = new Request(`http://${host}${nodeRequest.url ?? "/"}`, {
    method: nodeRequest.method,
    headers: nodeRequest.headers,
    body: await requestBody(nodeRequest),
    duplex: "half",
  });

  if (request.method === "GET" || request.method === "HEAD") {
    const assetResponse = await fetchAsset(request);
    if (assetResponse.status !== 404) return assetResponse;
  }

  return worker.fetch(
    request,
    { ASSETS: { fetch: fetchAsset } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

export async function createRaaviServer(options = {}) {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  const server = createServer(async (request, response) => {
    try {
      const workerResponse = await handleRequest(request);
      response.statusCode = workerResponse.status;
      for (const [name, value] of workerResponse.headers) {
        response.setHeader(name, value);
      }
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        response.setHeader(name, value);
      }

      if (request.method === "HEAD") {
        response.end();
        return;
      }

      response.end(Buffer.from(await workerResponse.arrayBuffer()));
    } catch (error) {
      console.error("Raavi desktop server error", error);
      response.statusCode = 500;
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.end("Raavi could not start.");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Raavi could not bind its local server.");
  }

  return {
    origin: `http://${host}:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function isMarkdownFile(fileName) {
  return /\.(?:md|markdown)$/i.test(fileName);
}

function isRaaviFile(fileName) {
  return /\.ravi$/i.test(fileName);
}

function isLibraryDocumentFile(fileName) {
  return isMarkdownFile(fileName) || isRaaviFile(fileName);
}

export function markdownPathFromArguments(argumentsList, workingDirectory) {
  const documentArgument = argumentsList.find(
    (argument) =>
      typeof argument === "string" &&
      !argument.startsWith("--") &&
      (isMarkdownFile(argument) || isRaaviFile(argument)),
  );

  return documentArgument
    ? path.resolve(workingDirectory ?? process.cwd(), documentArgument)
    : null;
}

function sanitizeRaaviAnnotations(value) {
  if (!Array.isArray(value)) return [];
  const kinds = new Set(["highlight", "comment", "margin"]);

  return value.flatMap((annotation, index) => {
    if (
      !annotation ||
      typeof annotation !== "object" ||
      !kinds.has(annotation.kind) ||
      !Number.isSafeInteger(annotation.start) ||
      !Number.isSafeInteger(annotation.end) ||
      annotation.start < 0 ||
      annotation.end <= annotation.start ||
      typeof annotation.quote !== "string" ||
      !annotation.quote
    ) {
      return [];
    }

    return [
      {
        id:
          typeof annotation.id === "string" && annotation.id
            ? annotation.id.slice(0, 120)
            : `ravi-imported-${Date.now()}-${index}`,
        kind: annotation.kind,
        start: annotation.start,
        end: annotation.end,
        quote: annotation.quote.slice(0, 5_000),
        prefix:
          typeof annotation.prefix === "string"
            ? annotation.prefix.slice(0, 160)
            : "",
        suffix:
          typeof annotation.suffix === "string"
            ? annotation.suffix.slice(0, 160)
            : "",
        body:
          typeof annotation.body === "string"
            ? annotation.body.slice(0, 20_000)
            : "",
        createdAt:
          typeof annotation.createdAt === "string"
            ? annotation.createdAt.slice(0, 64)
            : new Date().toISOString(),
      },
    ];
  });
}

function decodedBase64Length(value) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

function sanitizeRaaviAssets(value) {
  if (!Array.isArray(value)) return [];

  let totalBytes = 0;
  const knownIds = new Set();
  const assets = [];
  for (const asset of value.slice(0, MAX_RAVI_IMAGE_ASSETS)) {
    if (!asset || typeof asset !== "object") continue;
    const id = typeof asset.id === "string" ? asset.id.slice(0, 120) : "";
    const name = typeof asset.name === "string" ? asset.name.slice(0, 240) : "";
    const mimeType =
      typeof asset.mimeType === "string" ? asset.mimeType.toLowerCase() : "";
    const data = typeof asset.data === "string" ? asset.data : "";
    const assetBytes = decodedBase64Length(data);

    if (
      !/^[a-z0-9][a-z0-9-]{0,119}$/iu.test(id) ||
      !name ||
      !RAVI_IMAGE_TYPES.has(mimeType) ||
      !data ||
      data.length > Math.ceil((MAX_RAVI_IMAGE_BYTES * 4) / 3) + 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/u.test(data) ||
      assetBytes > MAX_RAVI_IMAGE_BYTES ||
      totalBytes + assetBytes > MAX_RAVI_IMAGE_TOTAL_BYTES ||
      knownIds.has(id)
    ) {
      continue;
    }

    knownIds.add(id);
    totalBytes += assetBytes;
    assets.push({ id, name, mimeType, data });
  }
  return assets;
}

function sanitizeRaaviVersions(value) {
  if (!Array.isArray(value)) return [];

  return value.slice(-30).flatMap((version) => {
    if (
      !version ||
      typeof version !== "object" ||
      !Number.isSafeInteger(version.number) ||
      version.number < 1 ||
      typeof version.content !== "string"
    ) {
      return [];
    }

    return [
      {
        number: version.number,
        savedAt:
          typeof version.savedAt === "string"
            ? version.savedAt.slice(0, 64)
            : new Date().toISOString(),
        content: version.content,
        annotations: sanitizeRaaviAnnotations(version.annotations),
      },
    ];
  });
}

export async function readDocumentPath(filePath) {
  const resolvedFile = path.resolve(filePath);
  const details = await stat(resolvedFile);
  if (!details.isFile()) throw new Error("Selected path is not a file.");

  if (isMarkdownFile(resolvedFile)) {
    return {
      name: path.basename(resolvedFile),
      path: resolvedFile,
      documentType: "markdown",
      content: await readMarkdownPath(resolvedFile),
      annotations: [],
      revision: 1,
      versions: [],
    };
  }

  if (!isRaaviFile(resolvedFile) || details.size > MAX_RAVI_SIZE) {
    throw new Error("Raavi document is too large or unsupported.");
  }

  const rawValue = await readFile(resolvedFile, "utf8");
  const value = JSON.parse(rawValue);
  if (
    !value ||
    value.format !== "ravi" ||
    value.version !== 1 ||
    !value.document ||
    typeof value.document.markdown !== "string"
  ) {
    throw new Error("Raavi document is invalid or unsupported.");
  }

  const fallbackName = `${path.basename(resolvedFile, ".ravi")}.md`;
  return {
    name:
      typeof value.document.name === "string" && value.document.name.trim()
        ? value.document.name.slice(0, 240)
        : fallbackName,
    path: resolvedFile,
    documentType: "ravi",
    content: value.document.markdown,
    annotations: sanitizeRaaviAnnotations(value.annotations),
    revision:
      Number.isSafeInteger(value.document.revision) &&
      value.document.revision > 0
        ? value.document.revision
        : 1,
    versions: sanitizeRaaviVersions(value.versions),
    assets: sanitizeRaaviAssets(value.assets),
  };
}

export async function scanMarkdownFolder(rootPath) {
  const resolvedRoot = path.resolve(rootPath);
  const rootStats = await stat(resolvedRoot);
  if (!rootStats.isDirectory()) throw new Error("Selected path is not a folder.");

  const files = [];

  async function visit(directoryPath) {
    let entries;
    try {
      entries = await readdir(directoryPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= MAX_LIBRARY_FILES) return;
      const absolutePath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      if (!entry.isFile() || !isLibraryDocumentFile(entry.name)) continue;

      try {
        const details = await stat(absolutePath);
        const relativePath = path
          .relative(resolvedRoot, absolutePath)
          .split(path.sep)
          .join("/");
        files.push({
          id: `${relativePath}:${details.mtimeMs}:${details.size}`,
          name: entry.name,
          path: relativePath,
          nativePath: absolutePath,
          size: details.size,
          lastModified: details.mtimeMs,
          documentType: isRaaviFile(entry.name) ? "ravi" : "markdown",
        });
      } catch {
        // A file can disappear while a directory is being scanned.
      }
    }
  }

  await visit(resolvedRoot);
  files.sort((a, b) => a.path.localeCompare(b.path, "fa"));

  return {
    rootName: path.basename(resolvedRoot),
    rootPath: resolvedRoot,
    files,
    truncated: files.length >= MAX_LIBRARY_FILES,
  };
}

export async function readMarkdownPath(filePath) {
  const resolvedFile = path.resolve(filePath);
  const details = await stat(resolvedFile);
  if (
    !isMarkdownFile(resolvedFile) ||
    !details.isFile() ||
    details.size > MAX_MARKDOWN_SIZE
  ) {
    throw new Error("Markdown file is too large.");
  }

  return readFile(resolvedFile, "utf8");
}

export async function readMarkdownFile(filePath, allowedRoots) {
  const resolvedFile = path.resolve(filePath);
  const insideAllowedRoot = [...allowedRoots].some((rootPath) => {
    const relativePath = path.relative(rootPath, resolvedFile);
    return (
      relativePath &&
      !relativePath.startsWith("..") &&
      !path.isAbsolute(relativePath)
    );
  });

  if (!insideAllowedRoot) {
    throw new Error("File access is outside the selected library.");
  }

  return readMarkdownPath(resolvedFile);
}

export async function readLibraryDocument(filePath, allowedRoots) {
  const resolvedFile = path.resolve(filePath);
  const insideAllowedRoot = [...allowedRoots].some((rootPath) => {
    const relativePath = path.relative(rootPath, resolvedFile);
    return (
      relativePath &&
      !relativePath.startsWith("..") &&
      !path.isAbsolute(relativePath)
    );
  });

  if (!insideAllowedRoot) {
    throw new Error("File access is outside the selected library.");
  }

  return readDocumentPath(resolvedFile);
}
