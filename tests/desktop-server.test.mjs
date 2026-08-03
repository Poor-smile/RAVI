import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createRaaviServer,
  markdownPathFromArguments,
  readDocumentPath,
  readLibraryDocument,
  readMarkdownFile,
  scanMarkdownFolder,
} from "../desktop/server.mjs";

test("desktop activation recognizes Markdown and Raavi file arguments", () => {
  assert.equal(
    markdownPathFromArguments(
      ["Raavi.exe", "--flag", "notes/example.md"],
      "C:\\library",
    ),
    path.resolve("C:\\library", "notes/example.md"),
  );
  assert.equal(
    markdownPathFromArguments(
      ["Raavi.exe", "--flag", "notes/review.ravi"],
      "C:\\library",
    ),
    path.resolve("C:\\library", "notes/review.ravi"),
  );
  assert.equal(markdownPathFromArguments(["Raavi.exe", "notes.txt"]), null);
});

test("desktop reads a shared Raavi document with annotations", async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), "raavi-document-"));
  const raviPath = path.join(rootPath, "review.ravi");
  const documentValue = {
    format: "ravi",
    version: 1,
    document: {
      name: "review.md",
      markdown: "# متن نمونه",
      revision: 3,
    },
    annotations: [
      {
        id: "note-1",
        kind: "comment",
        start: 0,
        end: 3,
        quote: "متن",
        prefix: "",
        suffix: " نمونه",
        body: "این بخش بازبینی شود.",
        createdAt: "2026-07-30T12:00:00.000Z",
      },
    ],
    versions: [
      {
        number: 3,
        savedAt: "2026-07-30T12:00:00.000Z",
        content: "# متن نمونه",
        annotations: [],
      },
    ],
    assets: [
      {
        id: "image-001",
        name: "review.png",
        mimeType: "image/png",
        data: "iVBORw0KGgo=",
      },
    ],
  };

  try {
    await writeFile(raviPath, JSON.stringify(documentValue), "utf8");
    const document = await readDocumentPath(raviPath);
    assert.equal(document.name, "review.md");
    assert.equal(document.content, "# متن نمونه");
    assert.equal(document.annotations.length, 1);
    assert.equal(document.annotations[0].kind, "comment");
    assert.equal(document.annotations[0].body, "این بخش بازبینی شود.");
    assert.equal(document.revision, 3);
    assert.equal(document.versions.length, 1);
    assert.equal(document.versions[0].number, 3);
    assert.deepEqual(document.assets, documentValue.assets);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test("desktop server renders the packaged app and its assets", async () => {
  const server = await createRaaviServer();

  try {
    const response = await fetch(server.origin);
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-security-policy") ?? "",
      /img-src 'self' data: blob: http: https:/,
    );
    assert.match(
      response.headers.get("content-security-policy") ?? "",
      /connect-src 'self' blob:;/,
    );
    const html = await response.text();
    assert.match(html, /راوی/);

    const assetPath = html.match(/(?:src|href)="([^"]+\.(?:js|css))"/)?.[1];
    assert.ok(assetPath, "expected a generated JS or CSS asset");
    const assetResponse = await fetch(new URL(assetPath, server.origin));
    assert.equal(assetResponse.status, 200);
    assert.match(
      assetResponse.headers.get("content-type") ?? "",
      /(?:javascript|css)/,
    );
  } finally {
    await server.close();
  }
});

test("desktop server can bind a requested local port", async () => {
  const server = await createRaaviServer({
    host: "127.0.0.1",
    port: 0,
  });

  try {
    assert.match(server.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
    const response = await fetch(`${server.origin}/fonts/IRANSansX-Regular.woff2`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /font\/woff2/);
  } finally {
    await server.close();
  }
});

test("desktop library scans recursively and limits reads to selected roots", async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), "raavi-library-"));
  const nestedPath = path.join(rootPath, "یادداشت‌ها");
  const markdownPath = path.join(nestedPath, "نمونه.md");
  const raviPath = path.join(nestedPath, "بازبینی.ravi");
  const ignoredPath = path.join(rootPath, "ignore.txt");

  try {
    await mkdir(nestedPath);
    await writeFile(markdownPath, "# نمونه", "utf8");
    await writeFile(
      raviPath,
      JSON.stringify({
        format: "ravi",
        version: 1,
        document: { name: "بازبینی.md", markdown: "# بازبینی", revision: 2 },
        annotations: [],
        versions: [],
      }),
      "utf8",
    );
    await writeFile(ignoredPath, "not markdown", "utf8");

    const scan = await scanMarkdownFolder(rootPath);
    assert.equal(scan.files.length, 2);
    assert.deepEqual(
      scan.files.map((file) => file.documentType).sort(),
      ["markdown", "ravi"],
    );
    assert.ok(
      scan.files.some((file) => file.path === "یادداشت‌ها/نمونه.md"),
    );
    assert.equal(
      await readMarkdownFile(markdownPath, new Set([path.resolve(rootPath)])),
      "# نمونه",
    );
    const raviDocument = await readLibraryDocument(
      raviPath,
      new Set([path.resolve(rootPath)]),
    );
    assert.equal(raviDocument.content, "# بازبینی");
    assert.equal(raviDocument.documentType, "ravi");
    await assert.rejects(() =>
      readMarkdownFile(ignoredPath, new Set([path.resolve(rootPath)])),
    );
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});
