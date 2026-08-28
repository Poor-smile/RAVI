import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import os from "node:os";
import path from "node:path";
import {
  createGoogleDriveBackupProvider,
  googleDriveBackupInternals,
} from "../desktop/google-drive-backup.mjs";

test("Google Drive multipart upload preserves exact metadata and bytes", () => {
  const value = googleDriveBackupInternals.multipartBody(
    { name: "note.json" },
    Buffer.from("payload"),
    "application/json",
  );
  const body = value.body.toString("utf8");
  assert.match(body, /"name":"note\.json"/u);
  assert.match(body, /Content-Type: application\/json/u);
  assert.match(body, /payload/u);
  assert.match(body, new RegExp(`--${value.boundary}--$`, "u"));
});

test("Drive Vault keeps Markdown as the user-facing document format", () => {
  assert.equal(
    googleDriveBackupInternals.markdownBackupName("پروژه.markdown"),
    "پروژه.md",
  );
  assert.equal(
    googleDriveBackupInternals.markdownBackupName("بدون نام"),
    "بدون نام.md",
  );
});

test("OAuth callback tolerates a duplicate request after the listener starts closing", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-oauth-"));
  const tokenPath = path.join(temporary, "token");
  let duplicateResponse = Promise.resolve();
  const payload = Buffer.from(
    JSON.stringify({ email: "reader@example.com" }),
  ).toString("base64url");
  const provider = createGoogleDriveBackupProvider({
    clientId: "desktop.apps.googleusercontent.com",
    clientSecret: "desktop-client-secret",
    tokenPath,
    seal: async (value) => Buffer.from(value).toString("base64"),
    unseal: async (value) => Buffer.from(value, "base64").toString("utf8"),
    openExternal: async (authorizationUrl) => {
      const authorization = new URL(authorizationUrl);
      const callback = new URL(authorization.searchParams.get("redirect_uri"));
      callback.searchParams.set("state", authorization.searchParams.get("state"));
      callback.searchParams.set("code", "authorization-code");

      const socket = await new Promise((resolve, reject) => {
        const pending = createConnection(
          { host: callback.hostname, port: Number(callback.port) },
          () => resolve(pending),
        );
        pending.once("error", reject);
      });
      duplicateResponse = new Promise((resolve, reject) => {
        let response = "";
        socket.setEncoding("utf8");
        socket.on("data", (chunk) => {
          response += chunk;
        });
        socket.once("end", () => {
          try {
            assert.match(response, /200 OK/u);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        socket.once("error", reject);
        setTimeout(() => {
          socket.end(
            `GET ${callback.pathname}${callback.search} HTTP/1.1\r\nHost: ${callback.host}\r\nConnection: close\r\n\r\n`,
          );
        }, 50);
      });

      const response = await fetch(callback);
      assert.equal(response.status, 200);
    },
    fetchImpl: async (url, options) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        const body = new URLSearchParams(options.body);
        assert.equal(body.get("client_secret"), "desktop-client-secret");
        return new Response(
          JSON.stringify({
            access_token: "access-token",
            refresh_token: "refresh-token",
            id_token: `header.${payload}.signature`,
            expires_in: 3600,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          storageQuota: { limit: "16106127360", usage: "1", usageInDriveTrash: "0" },
          user: { emailAddress: "reader@example.com", displayName: "Reader" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  try {
    const connection = await provider.connect({ timeoutMs: 2_000 });
    assert.equal(connection.state, "connected");
    await duplicateResponse;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("provider reads Drive quota without imposing a Raavi storage cap", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-drive-"));
  const tokenPath = path.join(temporary, "token");
  const future = Date.now() + 3_600_000;
  await writeFile(
    tokenPath,
    Buffer.from(JSON.stringify({ accessToken: "token", refreshToken: "refresh", expiresAt: future })).toString("base64"),
    "utf8",
  );
  const requests = [];
  const provider = createGoogleDriveBackupProvider({
    clientId: "client-id",
    tokenPath,
    openExternal: async () => {},
    seal: async (value) => Buffer.from(value).toString("base64"),
    unseal: async (value) => Buffer.from(value, "base64").toString("utf8"),
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return new Response(
        JSON.stringify({
          storageQuota: { limit: "16106127360", usage: "3221225472", usageInDriveTrash: "100" },
          user: { emailAddress: "reader@example.com", displayName: "Reader" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });
  try {
    const quota = await provider.getQuota();
    assert.deepEqual(quota, {
      limitBytes: 16_106_127_360,
      usageBytes: 3_221_225_472,
      trashBytes: 100,
      accountEmail: "reader@example.com",
      accountName: "Reader",
    });
    assert.match(requests[0].url, /\/drive\/v3\/about\?/u);
    assert.equal(requests[0].options.headers.authorization, "Bearer token");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("Google Drive lists and downloads a complete Raavi Vault backup", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-drive-restore-"));
  const tokenPath = path.join(temporary, "token");
  const documentId = "0123456789abcdef0123456789abcdef";
  await writeFile(
    tokenPath,
    Buffer.from(
      JSON.stringify({
        accessToken: "token",
        refreshToken: "refresh",
        expiresAt: Date.now() + 3_600_000,
      }),
    ).toString("base64"),
    "utf8",
  );
  const metadata = {
    format: "raavi-vault-metadata",
    version: 1,
    documentId,
    backedUpAt: "2026-08-26T10:00:00.000Z",
    fileName: "پروژه.md",
    annotations: [{ id: "note-1", kind: "comment" }],
    versions: [{ number: 1, content: "# قدیمی" }],
    assets: [
      {
        id: "image-1",
        name: "cover.webp",
        mimeType: "image/webp",
        remoteId: "asset-file",
      },
    ],
    audio: [],
    attachments: [],
    categories: { textAndStructure: true, optimizedImages: true },
  };
  const provider = createGoogleDriveBackupProvider({
    clientId: "client-id",
    tokenPath,
    openExternal: async () => {},
    seal: async (value) => Buffer.from(value).toString("base64"),
    unseal: async (value) => Buffer.from(value, "base64").toString("utf8"),
    fetchImpl: async (url) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.searchParams.get("alt") === "media") {
        const fileId = requestUrl.pathname.split("/").at(-1);
        if (fileId === "metadata-file") {
          return new Response(JSON.stringify(metadata), { status: 200 });
        }
        if (fileId === "document-file") {
          return new Response("# متن نهایی", { status: 200 });
        }
        if (fileId === "asset-file") {
          return new Response(Buffer.from("image-bytes"), { status: 200 });
        }
      }
      const query = requestUrl.searchParams.get("q") ?? "";
      const files = query.includes("value='root'")
        ? [{ id: "root", name: "Raavi" }]
        : query.includes("value='vault'")
          ? [{ id: "vault", name: "Vault" }]
          : query.includes("value='assets'")
            ? [{ id: "assets", name: "Assets" }]
            : query.includes("value='metadata'") && query.includes("'root' in parents")
              ? [{ id: "metadata", name: "Metadata" }]
              : query.includes("value='metadata'")
                ? [
                    {
                      id: "metadata-file",
                      name: `${documentId}.json`,
                      modifiedTime: "2026-08-26T10:00:00.000Z",
                    },
                  ]
                : query.includes("value='document'")
                  ? [{ id: "document-file", name: "پروژه.md" }]
                  : [];
      return new Response(JSON.stringify({ files }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  try {
    const list = await provider.listBackups();
    assert.equal(list.length, 1);
    assert.equal(list[0].fileName, "پروژه.md");
    assert.equal(list[0].assetCount, 1);
    const restored = await provider.downloadBackup(documentId);
    assert.equal(restored.content, "# متن نهایی");
    assert.equal(
      Buffer.from(restored.assets[0].data, "base64").toString("utf8"),
      "image-bytes",
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
