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
      }),
    /update_invalid/,
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
