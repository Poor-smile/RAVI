import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API_URL = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3";
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/drive.file",
];

function providerError(code, message) {
  return Object.assign(new Error(message), { code });
}

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/gu, "")
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_");
}

function pkcePair() {
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function escapeDriveQuery(value) {
  return String(value).replace(/\\/gu, "\\\\").replace(/'/gu, "\\'");
}

function multipartBody(metadata, bytes, mimeType) {
  const boundary = `raavi-${randomBytes(12).toString("hex")}`;
  const before = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    "utf8",
  );
  const after = Buffer.from(`\r\n--${boundary}--`, "utf8");
  return {
    boundary,
    body: Buffer.concat([before, Buffer.from(bytes), after]),
  };
}

function decodeJwtEmail(idToken) {
  try {
    const payload = String(idToken).split(".")[1];
    if (!payload) return "";
    const normalized = payload.replace(/-/gu, "+").replace(/_/gu, "/");
    const value = JSON.parse(Buffer.from(normalized, "base64").toString("utf8"));
    return typeof value.email === "string" ? value.email : "";
  } catch {
    return "";
  }
}

function markdownBackupName(fileName) {
  const base = path
    .basename(String(fileName || "document"))
    .replace(/\.(?:md|markdown)$/iu, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "-")
    .trim()
    .slice(0, 180) || "document";
  return `${base}.md`;
}

export function createGoogleDriveBackupProvider({
  clientId,
  clientSecret = "",
  tokenPath,
  openExternal,
  seal,
  unseal,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
}) {
  let tokenCache = null;
  let foldersPromise = null;

  async function readTokens() {
    if (tokenCache) return tokenCache;
    try {
      const encrypted = await readFile(tokenPath, "utf8");
      tokenCache = JSON.parse(await unseal(encrypted));
      return tokenCache;
    } catch {
      return null;
    }
  }

  async function writeTokens(tokens) {
    await mkdir(path.dirname(tokenPath), { recursive: true });
    tokenCache = tokens;
    await writeFile(tokenPath, await seal(JSON.stringify(tokens)), "utf8");
  }

  async function exchangeToken(body) {
    const response = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
    if (!response.ok) {
      throw providerError("oauth-token", `Google OAuth token exchange failed (${response.status}).`);
    }
    return response.json();
  }

  async function accessToken({ forceRefresh = false } = {}) {
    const tokens = await readTokens();
    if (!tokens) throw providerError("reauth", "Google Drive is not connected.");
    if (!forceRefresh && tokens.accessToken && Number(tokens.expiresAt) - now() > 60_000) {
      return tokens.accessToken;
    }
    if (!tokens.refreshToken) throw providerError("reauth", "Google Drive permission must be renewed.");
    const refreshed = await exchangeToken({
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    });
    const next = {
      ...tokens,
      accessToken: refreshed.access_token,
      expiresAt: now() + Number(refreshed.expires_in || 3_600) * 1_000,
      ...(refreshed.refresh_token ? { refreshToken: refreshed.refresh_token } : {}),
      ...(refreshed.id_token ? { idToken: refreshed.id_token } : {}),
    };
    await writeTokens(next);
    return next.accessToken;
  }

  async function driveRequest(url, options = {}, retried = false) {
    const token = await accessToken({ forceRefresh: retried });
    const response = await fetchImpl(url, {
      ...options,
      headers: {
        authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });
    if (response.status === 401 && !retried) return driveRequest(url, options, true);
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw providerError(
        response.status === 401 || response.status === 403 ? "reauth" : "drive-api",
        `Google Drive request failed (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`,
      );
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async function driveDownload(url, retried = false) {
    const token = await accessToken({ forceRefresh: retried });
    const response = await fetchImpl(url, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (response.status === 401 && !retried) return driveDownload(url, true);
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw providerError(
        response.status === 401 || response.status === 403 ? "reauth" : "drive-api",
        `Google Drive download failed (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`,
      );
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async function findFile(query) {
    const params = new URLSearchParams({
      q: `${query} and trashed = false`,
      spaces: "drive",
      pageSize: "10",
      fields: "files(id,name,mimeType,appProperties)",
    });
    const value = await driveRequest(`${DRIVE_API_URL}/files?${params}`);
    return value.files?.[0] ?? null;
  }

  async function listFiles(query) {
    const files = [];
    let pageToken = "";
    do {
      const params = new URLSearchParams({
        q: `${query} and trashed = false`,
        spaces: "drive",
        pageSize: "1000",
        fields: "nextPageToken,files(id,name,mimeType,modifiedTime,size,appProperties)",
        ...(pageToken ? { pageToken } : {}),
      });
      const value = await driveRequest(`${DRIVE_API_URL}/files?${params}`);
      files.push(...(Array.isArray(value?.files) ? value.files : []));
      pageToken = typeof value?.nextPageToken === "string" ? value.nextPageToken : "";
    } while (pageToken);
    return files;
  }

  async function downloadFileBytes(fileId) {
    return driveDownload(
      `${DRIVE_API_URL}/files/${encodeURIComponent(fileId)}?alt=media`,
    );
  }

  async function readBackupMetadata(file) {
    const bytes = await downloadFileBytes(file.id);
    let value;
    try {
      value = JSON.parse(bytes.toString("utf8"));
    } catch {
      throw providerError("backup-invalid", "اطلاعات یکی از بکاپ‌های Google Drive معتبر نیست.");
    }
    if (
      !value ||
      value.format !== "raavi-vault-metadata" ||
      typeof value.documentId !== "string" ||
      !value.documentId
    ) {
      throw providerError("backup-invalid", "ساختار یکی از بکاپ‌های Google Drive پشتیبانی نمی‌شود.");
    }
    return { ...value, metadataRemoteId: file.id };
  }

  async function createFolder(name, parentId, kind) {
    return driveRequest(`${DRIVE_API_URL}/files?fields=id,name`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        ...(parentId ? { parents: [parentId] } : {}),
        appProperties: { raaviKind: kind },
      }),
    });
  }

  async function ensureFolders() {
    if (!foldersPromise) {
      foldersPromise = (async () => {
        const root =
          (await findFile("mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='raaviKind' and value='root' }")) ??
          (await createFolder("Raavi", "", "root"));
        const vault =
          (await findFile(`'${escapeDriveQuery(root.id)}' in parents and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='raaviKind' and value='vault' }`)) ??
          (await createFolder("Vault", root.id, "vault"));
        const assets =
          (await findFile(`'${escapeDriveQuery(root.id)}' in parents and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='raaviKind' and value='assets' }`)) ??
          (await createFolder("Assets", root.id, "assets"));
        const metadata =
          (await findFile(`'${escapeDriveQuery(root.id)}' in parents and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='raaviKind' and value='metadata' }`)) ??
          (await createFolder("Metadata", root.id, "metadata"));
        return {
          rootId: root.id,
          vaultId: vault.id,
          assetsId: assets.id,
          metadataId: metadata.id,
        };
      })().catch((error) => {
        foldersPromise = null;
        throw error;
      });
    }
    return foldersPromise;
  }

  async function uploadMultipart({ fileId, metadata, bytes, mimeType }) {
    const multipart = multipartBody(metadata, bytes, mimeType);
    const endpoint = fileId
      ? `${DRIVE_UPLOAD_URL}/files/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id,name`
      : `${DRIVE_UPLOAD_URL}/files?uploadType=multipart&fields=id,name`;
    return driveRequest(endpoint, {
      method: fileId ? "PATCH" : "POST",
      headers: { "content-type": `multipart/related; boundary=${multipart.boundary}` },
      body: multipart.body,
    });
  }

  async function uploadAsset(asset, assetsFolderId, kind = "asset") {
    if (!asset || typeof asset.data !== "string" || !asset.data) return null;
    const bytes = Buffer.from(asset.data, "base64");
    const hash = createHash("sha256").update(bytes).digest("hex");
    const existing = await findFile(
      `'${escapeDriveQuery(assetsFolderId)}' in parents and appProperties has { key='raaviAssetSha256' and value='${hash}' }`,
    );
    const metadata = {
      name: `${hash}.${String(asset.mimeType || "application/octet-stream").split("/")[1] || "bin"}`,
      ...(existing ? {} : { parents: [assetsFolderId] }),
      appProperties: { raaviAssetSha256: hash, raaviKind: kind },
    };
    const remote = existing ?? (await uploadMultipart({ metadata, bytes, mimeType: asset.mimeType || "application/octet-stream" }));
    return {
      id: asset.id,
      name: asset.name,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      sha256: hash,
      size: bytes.byteLength,
      remoteId: remote.id,
    };
  }

  async function pruneDocumentRevisions(fileId, keepHistory) {
    const params = new URLSearchParams({
      pageSize: "200",
      fields: "revisions(id,modifiedTime,keepForever)",
    });
    const value = await driveRequest(
      `${DRIVE_API_URL}/files/${encodeURIComponent(fileId)}/revisions?${params}`,
    );
    const revisions = Array.isArray(value?.revisions) ? value.revisions : [];
    const current = revisions.at(-1);
    const cutoff = now() - 30 * 24 * 60 * 60 * 1_000;
    const protectedRevisions = revisions.filter(
      (revision) => revision === current || revision.keepForever === true,
    );
    const protectedIds = new Set(
      protectedRevisions.map((revision) => revision.id),
    );
    const recentRevisions = keepHistory
      ? revisions
          .filter(
            (revision) =>
              !protectedIds.has(revision.id) &&
              Date.parse(revision.modifiedTime || "") >= cutoff,
          )
          .slice(-50)
      : [];
    const retainedIds = new Set(
      [...protectedRevisions, ...recentRevisions].map((revision) => revision.id),
    );
    if (current?.id) retainedIds.add(current.id);
    for (const revision of revisions) {
      if (!revision?.id || retainedIds.has(revision.id)) continue;
      await driveRequest(
        `${DRIVE_API_URL}/files/${encodeURIComponent(fileId)}/revisions/${encodeURIComponent(revision.id)}`,
        { method: "DELETE" },
      );
    }
  }

  async function uploadDocument({ documentId, payload }) {
    const folders = await ensureFolders();
    const assetManifest = [];
    for (const asset of payload.assets ?? []) {
      const uploaded = await uploadAsset(asset, folders.assetsId);
      if (uploaded) assetManifest.push(uploaded);
    }
    const audioManifest = [];
    for (const asset of payload.audioAssets ?? []) {
      const uploaded = await uploadAsset(asset, folders.assetsId, "audio");
      if (uploaded) audioManifest.push({ ...uploaded, sourcePath: asset.sourcePath });
    }
    const attachmentManifest = [];
    for (const asset of payload.attachments ?? []) {
      const uploaded = await uploadAsset(asset, folders.assetsId, "attachment");
      if (uploaded) attachmentManifest.push(uploaded);
    }

    let documentRemote = null;
    if (payload.backupCategories?.textAndStructure !== false) {
      const existingDocument = await findFile(
        `'${escapeDriveQuery(folders.vaultId)}' in parents and appProperties has { key='raaviDocumentId' and value='${escapeDriveQuery(documentId)}' } and appProperties has { key='raaviKind' and value='document' }`,
      );
      const documentMetadata = {
        name: markdownBackupName(payload.fileName),
        ...(existingDocument ? {} : { parents: [folders.vaultId] }),
        appProperties: { raaviDocumentId: documentId, raaviKind: "document" },
      };
      documentRemote = await uploadMultipart({
        fileId: existingDocument?.id,
        metadata: documentMetadata,
        bytes: Buffer.from(String(payload.content ?? ""), "utf8"),
        mimeType: "text/markdown; charset=utf-8",
      });
      await pruneDocumentRevisions(
        documentRemote.id,
        payload.backupCategories?.versionHistory !== false,
      ).catch(() => {});
    }

    const existingMetadata = await findFile(
      `'${escapeDriveQuery(folders.metadataId)}' in parents and appProperties has { key='raaviDocumentId' and value='${escapeDriveQuery(documentId)}' } and appProperties has { key='raaviKind' and value='metadata' }`,
    );
    const backupMetadata = {
      format: "raavi-vault-metadata",
      version: 1,
      documentId,
      backedUpAt: new Date(now()).toISOString(),
      fileName: markdownBackupName(payload.fileName),
      annotations: payload.annotations ?? [],
      versions: payload.versions ?? [],
      assets: assetManifest,
      audio: audioManifest,
      attachments: attachmentManifest,
      categories: payload.backupCategories ?? {},
    };
    const metadata = {
      name: `${documentId}.json`,
      ...(existingMetadata ? {} : { parents: [folders.metadataId] }),
      appProperties: { raaviDocumentId: documentId, raaviKind: "metadata" },
    };
    const metadataRemote = await uploadMultipart({
      fileId: existingMetadata?.id,
      metadata,
      bytes: Buffer.from(JSON.stringify(backupMetadata), "utf8"),
      mimeType: "application/json",
    });
    return {
      remoteId: documentRemote?.id ?? metadataRemote.id,
      metadataRemoteId: metadataRemote.id,
      assetManifest,
      audioManifest,
      attachmentManifest,
    };
  }

  async function listBackups() {
    const folders = await ensureFolders();
    const metadataFiles = await listFiles(
      `'${escapeDriveQuery(folders.metadataId)}' in parents and appProperties has { key='raaviKind' and value='metadata' }`,
    );
    const backups = [];
    for (const file of metadataFiles) {
      try {
        const metadata = await readBackupMetadata(file);
        backups.push({
          providerId: "google-drive",
          documentId: metadata.documentId,
          fileName: markdownBackupName(metadata.fileName),
          backedUpAt: metadata.backedUpAt || file.modifiedTime || "",
          versionCount: Array.isArray(metadata.versions) ? metadata.versions.length : 0,
          assetCount: Array.isArray(metadata.assets) ? metadata.assets.length : 0,
          audioCount: Array.isArray(metadata.audio) ? metadata.audio.length : 0,
          attachmentCount: Array.isArray(metadata.attachments) ? metadata.attachments.length : 0,
          categories: metadata.categories ?? {},
        });
      } catch (error) {
        if (error?.code === "reauth") throw error;
      }
    }
    return backups.sort(
      (left, right) =>
        Date.parse(right.backedUpAt || "") - Date.parse(left.backedUpAt || ""),
    );
  }

  async function downloadBackup(documentId) {
    const normalizedDocumentId = String(documentId || "");
    if (!/^[a-f0-9]{16,64}$/iu.test(normalizedDocumentId)) {
      throw providerError("backup-invalid", "شناسهٔ بکاپ Google Drive معتبر نیست.");
    }
    const folders = await ensureFolders();
    const metadataFile = await findFile(
      `'${escapeDriveQuery(folders.metadataId)}' in parents and appProperties has { key='raaviDocumentId' and value='${escapeDriveQuery(normalizedDocumentId)}' } and appProperties has { key='raaviKind' and value='metadata' }`,
    );
    if (!metadataFile) {
      throw providerError("backup-missing", "اطلاعات این بکاپ در Google Drive پیدا نشد.");
    }
    const metadata = await readBackupMetadata(metadataFile);
    const documentFile = await findFile(
      `'${escapeDriveQuery(folders.vaultId)}' in parents and appProperties has { key='raaviDocumentId' and value='${escapeDriveQuery(normalizedDocumentId)}' } and appProperties has { key='raaviKind' and value='document' }`,
    );
    const content = documentFile
      ? (await downloadFileBytes(documentFile.id)).toString("utf8")
      : "";

    const hydrateAssets = async (items) => {
      const hydrated = [];
      for (const item of Array.isArray(items) ? items : []) {
        if (!item?.remoteId) continue;
        const bytes = await downloadFileBytes(item.remoteId);
        hydrated.push({ ...item, data: bytes.toString("base64") });
      }
      return hydrated;
    };

    return {
      providerId: "google-drive",
      documentId: normalizedDocumentId,
      metadata,
      content,
      assets: await hydrateAssets(metadata.assets),
      audio: await hydrateAssets(metadata.audio),
      attachments: await hydrateAssets(metadata.attachments),
    };
  }

  async function getQuota() {
    const value = await driveRequest(`${DRIVE_API_URL}/about?fields=storageQuota,user(emailAddress,displayName)`);
    return {
      limitBytes: Number(value.storageQuota?.limit) || 0,
      usageBytes: Number(value.storageQuota?.usage) || 0,
      trashBytes: Number(value.storageQuota?.usageInDriveTrash) || 0,
      accountEmail: value.user?.emailAddress ?? "",
      accountName: value.user?.displayName ?? "",
    };
  }

  async function connectionInfo() {
    const tokens = await readTokens();
    return tokens
      ? { state: "connected", accountEmail: tokens.accountEmail || decodeJwtEmail(tokens.idToken) }
      : { state: "disconnected", accountEmail: "" };
  }

  async function connect({ timeoutMs = 5 * 60_000 } = {}) {
    if (!clientId) {
      throw providerError("oauth-client-missing", "Google OAuth client ID is not configured for this Raavi build.");
    }
    if (!clientSecret) {
      throw providerError("oauth-client-secret-missing", "Google OAuth desktop client secret is not configured for this Raavi build.");
    }
    const { verifier, challenge } = pkcePair();
    const csrfState = base64Url(randomBytes(24));
    let timeout = null;
    let server = null;
    let redirectUri = "";
    try {
      const authorization = await new Promise((resolve, reject) => {
        let settled = false;
        const settleResolve = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        const settleReject = (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        };
        server = createServer((request, response) => {
          try {
            const url = new URL(request.url || "/", "http://127.0.0.1");
            if (url.pathname !== "/oauth/google/callback") {
              response.writeHead(404).end();
              return;
            }
            if (url.searchParams.get("state") !== csrfState) {
              response.writeHead(400, { "content-type": "text/plain; charset=utf-8" }).end("Raavi OAuth state mismatch.");
              settleReject(providerError("oauth-state", "Google sign-in state did not match."));
              return;
            }
            const code = url.searchParams.get("code");
            const error = url.searchParams.get("error");
            if (!code || error) {
              response.writeHead(400, { "content-type": "text/plain; charset=utf-8" }).end("Google sign-in was not completed. You can close this page.");
              settleReject(providerError("oauth-cancelled", "Google sign-in was cancelled."));
              return;
            }
            response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end("<!doctype html><meta charset=utf-8><title>Raavi</title><p dir=rtl>اتصال Google Drive انجام شد. می‌توانید این صفحه را ببندید و به راوی برگردید.</p>");
            settleResolve({ code, redirectUri });
          } catch (error) {
            if (!response.headersSent) {
              response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
            }
            response.end("Raavi could not complete Google sign-in. You can close this page.");
            settleReject(error);
          }
        });
        server.on("error", settleReject);
        server.listen(0, "127.0.0.1", async () => {
          const address = server.address();
          if (!address || typeof address === "string") {
            settleReject(providerError("oauth-listener", "Raavi could not start the Google sign-in callback."));
            return;
          }
          redirectUri = `http://127.0.0.1:${address.port}/oauth/google/callback`;
          const url = new URL(GOOGLE_AUTHORIZE_URL);
          url.search = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: GOOGLE_SCOPES.join(" "),
            code_challenge: challenge,
            code_challenge_method: "S256",
            access_type: "offline",
            include_granted_scopes: "true",
            prompt: "consent",
            state: csrfState,
          }).toString();
          try {
            await openExternal(url.href);
          } catch (error) {
            settleReject(error);
          }
        });
        timeout = setTimeout(() => settleReject(providerError("oauth-timeout", "Google sign-in timed out.")), timeoutMs);
        timeout.unref?.();
      });
      const token = await exchangeToken({
        client_id: clientId,
        client_secret: clientSecret,
        code: authorization.code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: authorization.redirectUri,
      });
      const tokens = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        idToken: token.id_token,
        expiresAt: now() + Number(token.expires_in || 3_600) * 1_000,
        accountEmail: decodeJwtEmail(token.id_token),
      };
      await writeTokens(tokens);
      const quota = await getQuota();
      tokens.accountEmail = quota.accountEmail || tokens.accountEmail;
      await writeTokens(tokens);
      return { state: "connected", accountEmail: tokens.accountEmail, quota };
    } finally {
      if (timeout) clearTimeout(timeout);
      server?.close();
    }
  }

  async function disconnect() {
    tokenCache = null;
    foldersPromise = null;
    await rm(tokenPath, { force: true });
    return { state: "disconnected", accountEmail: "" };
  }

  return {
    connect,
    disconnect,
    connectionInfo,
    getQuota,
    uploadDocument,
    listBackups,
    downloadBackup,
  };
}

export const googleDriveBackupInternals = {
  multipartBody,
  escapeDriveQuery,
  markdownBackupName,
};
