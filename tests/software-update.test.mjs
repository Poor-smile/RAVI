import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  compareVersions,
  createSoftwareUpdateController,
  updateSignaturePayload,
  validateUpdateManifest,
} from "../desktop/software-update.mjs";

function signedManifest(bytes, privateKey) {
  const manifest = {
    schema: 1,
    channel: "stable",
    version: "2.2.0",
    publishedAt: "2026-08-27T12:00:00.000Z",
    notesUrl: "https://ravi.poorsmile.ir/updates/releases/2.2.0.json",
    artifact: {
      path: "/raavi/stable/2.2.0/Raavi-Setup-2.2.0-x64.exe",
      size: bytes.length,
      sha512: createHash("sha512").update(bytes).digest("hex"),
      signature: "pending",
    },
    mirrors: [
      { id: "offline", baseUrl: "https://offline.example" },
      { id: "primary", baseUrl: "https://downloads.example" },
    ],
  };
  manifest.artifact.signature = sign(
    null,
    updateSignaturePayload(manifest),
    privateKey,
  ).toString("base64");
  return manifest;
}

test("semantic version comparison is numeric", () => {
  assert.equal(compareVersions("2.2.0", "2.1.13"), 1);
  assert.equal(compareVersions("2.2.0", "2.2.0"), 0);
  assert.equal(compareVersions("2.1.9", "2.2.0"), -1);
});

test("manifest rejects insecure mirrors and path traversal", () => {
  assert.throws(
    () =>
      validateUpdateManifest({
        version: "2.2.0",
        artifact: {
          path: "/../bad.exe",
          size: 10,
          sha512: "a".repeat(128),
          signature: "c2ln",
        },
        mirrors: [{ id: "bad", baseUrl: "http://example.com" }],
      }, { platform: "win32", arch: "x64" }),
    /update_invalid/,
  );
});

function signedMultiplatformManifest(bytesByKey, privateKey) {
  const mirrors = [
    { id: "offline", baseUrl: "https://offline.example" },
    { id: "primary", baseUrl: "https://downloads.example" },
  ];
  const manifest = {
    schema: 2,
    channel: "stable",
    version: "2.3.0",
    publishedAt: "2026-08-28T12:00:00.000Z",
    notesUrl: "https://ravi.poorsmile.ir/updates/releases/2.3.0.json",
    artifacts: {},
    mirrors,
  };
  for (const [key, bytes] of Object.entries(bytesByKey)) {
    const [platform, arch] = key.split("-");
    const extension = platform === "darwin" ? "dmg" : "exe";
    const artifact = {
      platform,
      arch,
      path: `/raavi/stable/2.3.0/Raavi-2.3.0-${key}.${extension}`,
      size: bytes.length,
      sha512: createHash("sha512").update(bytes).digest("hex"),
      signature: "pending",
    };
    artifact.signature = sign(
      null,
      updateSignaturePayload({ schema: 2, version: manifest.version, artifact }),
      privateKey,
    ).toString("base64");
    manifest.artifacts[key] = artifact;
  }
  return manifest;
}

test("schema 2 selects the native macOS architecture and binds it to the signature", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const manifest = signedMultiplatformManifest(
    {
      "win32-x64": Buffer.from("windows"),
      "darwin-arm64": Buffer.from("apple-silicon"),
      "darwin-x64": Buffer.from("intel-mac"),
    },
    privateKey,
  );
  const selected = validateUpdateManifest(manifest, {
    platform: "darwin",
    arch: "arm64",
  });
  assert.equal(selected.artifact.platform, "darwin");
  assert.equal(selected.artifact.arch, "arm64");
  assert.match(selected.artifact.path, /darwin-arm64\.dmg$/);
  assert.throws(
    () => validateUpdateManifest(manifest, { platform: "darwin", arch: "universal" }),
    /update_unsupported_platform/,
  );
});

test("download falls back to the next mirror and verifies the signed file", async () => {
  const bytes = Buffer.from("signed-raavi-installer");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const manifest = signedManifest(bytes, privateKey);
  const userDataPath = await mkdtemp(path.join(os.tmpdir(), "raavi-update-"));
  const publicKeyPath = path.join(userDataPath, "update-public-key.pem");
  await writeFile(
    publicKeyPath,
    publicKey.export({ type: "spki", format: "pem" }),
  );
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(String(url));
    if (String(url).endsWith("stable.json")) {
      return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (String(url).startsWith("https://offline.example")) {
      throw new Error("offline");
    }
    return new Response(bytes, { status: 200 });
  };
  const states = [];
  const controller = createSoftwareUpdateController({
    currentVersion: "2.1.13",
    userDataPath,
    publicKeyPath,
    manifestUrl: "https://ravi.poorsmile.ir/updates/stable.json",
    fetchImpl,
    emit: (state) => states.push(state),
    platform: "win32",
    arch: "x64",
  });
  const available = await controller.check({ manual: true });
  assert.equal(available.phase, "available");
  const ready = await controller.download();
  assert.equal(ready.phase, "ready");
  assert.equal(ready.progress, 1);
  assert.ok(requested.some((url) => url.startsWith("https://offline.example")));
  assert.ok(requested.some((url) => url.startsWith("https://downloads.example")));
  assert.ok(states.some((state) => state.phase === "downloading"));
  controller.dispose();
});

test("macOS downloads, verifies, and opens the native DMG through the updater", async () => {
  const bytes = Buffer.from("signed-raavi-macos-dmg");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const manifest = signedMultiplatformManifest(
    { "darwin-arm64": bytes },
    privateKey,
  );
  const userDataPath = await mkdtemp(path.join(os.tmpdir(), "raavi-mac-update-"));
  const publicKeyPath = path.join(userDataPath, "update-public-key.pem");
  await writeFile(
    publicKeyPath,
    publicKey.export({ type: "spki", format: "pem" }),
  );
  const launched = [];
  const controller = createSoftwareUpdateController({
    currentVersion: "2.2.0",
    userDataPath,
    publicKeyPath,
    manifestUrl: "https://ravi.poorsmile.ir/updates/stable.json",
    platform: "darwin",
    arch: "arm64",
    fetchImpl: async (url) => {
      if (String(url).endsWith("stable.json")) {
        return new Response(JSON.stringify(manifest), { status: 200 });
      }
      if (String(url).startsWith("https://offline.example")) {
        throw new Error("offline");
      }
      return new Response(bytes, { status: 200 });
    },
    launchInstaller: async (filePath) => launched.push(filePath),
  });
  assert.equal((await controller.check({ manual: true })).phase, "available");
  const ready = await controller.download();
  assert.equal(ready.phase, "ready");
  assert.equal(ready.platform, "darwin");
  assert.equal(ready.arch, "arm64");
  assert.match(ready.installerPath, /\.dmg$/);
  assert.deepEqual(await controller.install(), { started: true });
  assert.deepEqual(launched, [ready.installerPath]);
  controller.dispose();
});
