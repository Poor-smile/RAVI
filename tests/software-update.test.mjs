import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  compareVersions,
  createSoftwareUpdateController,
  updateSignaturePayload,
  validateUpdateManifest,
  MAX_UPDATE_MANIFEST_BYTES,
  MAX_UPDATE_ARTIFACT_BYTES,
} from "../desktop/software-update.mjs";

async function updateFixture(t, options = {}) {
  const bytes = Buffer.from("a signed installer payload");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const manifest = signedManifest(bytes, privateKey);
  manifest.mirrors = [{ id: "primary", baseUrl: "https://downloads.example" }];
  const directory = await mkdtemp(path.join(os.tmpdir(), "raavi-update-limits-"));
  const publicKeyPath = path.join(directory, "key.pem");
  await writeFile(publicKeyPath, publicKey.export({ type: "spki", format: "pem" }));
  const requests = [];
  const states = [];
  const controller = createSoftwareUpdateController({
    currentVersion: "2.1.0", userDataPath: directory, publicKeyPath,
    platform: "win32", arch: "x64",
    requestLimits: options.requestLimits,
    emit: (state) => { states.push(state); options.emit?.(state); },
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      if (url.endsWith("stable.json")) return options.manifestFetch
        ? options.manifestFetch(manifest, init) : new Response(JSON.stringify(manifest));
      return options.artifactFetch ? options.artifactFetch(bytes, init, url) : new Response(bytes);
    },
  });
  t.after(async () => { controller.dispose(); await rm(directory, { recursive: true, force: true }); });
  const finalPath = path.join(directory, "updates", path.basename(manifest.artifact.path));
  return { controller, manifest, bytes, requests, states, directory, finalPath, partialPath: `${finalPath}.part` };
}

const smallTimeouts = { headerTimeoutMs: 100, idleTimeoutMs: 100, manifestTimeoutMs: 250, downloadTimeoutMs: 350 };

async function waitUntil(predicate) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await predicate()) return;
    await delay(10);
  }
  assert.fail("condition did not become true");
}

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

test("installer launch failures stay inside the updater instead of crashing the main process", async () => {
  const bytes = Buffer.from("signed-raavi-windows-installer");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const manifest = signedMultiplatformManifest(
    { "win32-x64": bytes },
    privateKey,
  );
  const userDataPath = await mkdtemp(path.join(os.tmpdir(), "raavi-win-update-"));
  const publicKeyPath = path.join(userDataPath, "update-public-key.pem");
  await writeFile(
    publicKeyPath,
    publicKey.export({ type: "spki", format: "pem" }),
  );
  const states = [];
  const controller = createSoftwareUpdateController({
    currentVersion: "2.2.0",
    userDataPath,
    publicKeyPath,
    manifestUrl: "https://ravi.poorsmile.ir/updates/stable.json",
    platform: "win32",
    arch: "x64",
    fetchImpl: async (url) => {
      if (String(url).endsWith("stable.json")) {
        return new Response(JSON.stringify(manifest), { status: 200 });
      }
      if (String(url).startsWith("https://offline.example")) {
        throw new Error("offline");
      }
      return new Response(bytes, { status: 200 });
    },
    emit: (state) => states.push(state),
    launchInstaller: async () => {
      const error = new Error("spawn EACCES");
      error.code = "EACCES";
      throw error;
    },
  });
  assert.equal((await controller.check({ manual: true })).phase, "available");
  assert.equal((await controller.download()).phase, "ready");
  assert.deepEqual(await controller.install(), {
    started: false,
    error: "update_launch_failed",
  });
  const finalState = controller.getState();
  assert.equal(finalState.phase, "ready");
  assert.match(finalState.message, /Administrator/);
  assert.ok(states.some((state) => state.phase === "ready" && state.message));
  controller.dispose();
});

test("manifest size, artifact size, mirror count, and signatures are bounded before downloading", async (t) => {
  const fixture = await updateFixture(t);
  const { manifest, controller, requests } = fixture;
  for (const size of [MAX_UPDATE_ARTIFACT_BYTES + 1, Infinity, 0]) {
    assert.throws(() => validateUpdateManifest({ ...manifest, artifact: { ...manifest.artifact, size } }, { platform: "win32", arch: "x64" }), /update_invalid_size/);
  }
  assert.throws(() => validateUpdateManifest({ ...manifest, mirrors: Array(9).fill(manifest.mirrors[0]) }, { platform: "win32", arch: "x64" }), /update_too_many_mirrors/);
  manifest.artifact.signature = Buffer.alloc(64).toString("base64");
  assert.equal((await controller.download()).phase, "error");
  assert.equal(requests.length, 1);
});

for (const withLength of [false, true]) {
  test(`oversized manifest is rejected ${withLength ? "from headers" : "while streaming"} and its body is cancelled`, async (t) => {
    let cancelled = false;
    const { controller, requests } = await updateFixture(t, { manifestFetch: () => new Response(new ReadableStream({
      start(stream) { stream.enqueue(Buffer.alloc(MAX_UPDATE_MANIFEST_BYTES + 1)); },
      cancel() { cancelled = true; },
    }), { headers: withLength ? { "content-length": String(MAX_UPDATE_MANIFEST_BYTES + 1) } : {} }) });
    assert.equal((await controller.check()).phase, "error");
    assert.equal(cancelled, true);
    assert.equal(requests.length, 1);
  });
}

for (const kind of ["manifest headers", "manifest body", "artifact headers", "artifact body"]) {
  test(`${kind} cannot hang the updater`, async (t) => {
    let signal;
    let cancelled = false;
    const hang = (_bytes, init) => {
      signal = init.signal;
      return kind.endsWith("headers") ? new Promise(() => {}) : new Response(new ReadableStream({ cancel() { cancelled = true; } }));
    };
    const { controller, directory } = await updateFixture(t, {
      requestLimits: smallTimeouts,
      ...(kind.startsWith("manifest") ? { manifestFetch: hang } : { artifactFetch: hang }),
    });
    const state = kind.startsWith("manifest") ? await controller.check() : await controller.download();
    assert.equal(state.phase, "error");
    assert.match(state.message, /مهلت/);
    assert.equal(signal.aborted, true);
    if (kind.endsWith("body")) assert.equal(cancelled, true);
    assert.deepEqual(await readdir(path.join(directory, "updates")).catch(() => []), []);
  });
}

test("a slow trickle reaches the total deadline even when individual reads do not time out", async (t) => {
  let cancelled = false;
  const { controller } = await updateFixture(t, {
    requestLimits: { ...smallTimeouts, idleTimeoutMs: 150, downloadTimeoutMs: 120 },
    artifactFetch: () => new Response(new ReadableStream({
      async pull(stream) { await delay(25); if (!cancelled) stream.enqueue(Buffer.from("a")); },
      cancel() { cancelled = true; },
    })),
  });
  const state = await controller.download();
  assert.equal(state.phase, "error");
  assert.match(state.message, /مهلت/);
  assert.equal(cancelled, true);
});

test("oversized stream is stopped before the extra bytes reach disk", async (t) => {
  let cancelled = false;
  let maximumOnDisk = 0;
  let partialPath;
  const fixture = await updateFixture(t, { artifactFetch: (bytes) => new Response(new ReadableStream({
    start(stream) { stream.enqueue(bytes.subarray(0, 3)); stream.enqueue(Buffer.alloc(bytes.length * 4)); },
    async cancel() {
      maximumOnDisk = await stat(partialPath).then((value) => value.size).catch(() => 0);
      cancelled = true;
    },
  })) });
  partialPath = fixture.partialPath;
  assert.equal((await fixture.controller.download()).phase, "error");
  await waitUntil(() => cancelled);
  assert.ok(maximumOnDisk <= 3);
  assert.ok(fixture.states.every((state) => state.downloadedBytes <= fixture.bytes.length));
  await assert.rejects(stat(partialPath), { code: "ENOENT" });
  await assert.rejects(stat(fixture.finalPath), { code: "ENOENT" });
});

test("truncated stream is removed and never becomes installable", async (t) => {
  const { controller, partialPath } = await updateFixture(t, { artifactFetch: (bytes) => new Response(bytes.subarray(0, 3)) });
  assert.equal((await controller.download()).phase, "error");
  await assert.rejects(stat(partialPath), { code: "ENOENT" });
  await assert.rejects(controller.install(), /update_not_ready/);
});

for (const badHeaders of [
  { "content-range": "bytes 0-25/26" },
  { "content-range": "bytes 3-24/26" },
  { "content-range": "bytes 3-25/999" },
  {},
  { "content-range": "bytes 3-25/26", "content-length": "999" },
  { "content-range": "bytes 3-25/26", "content-length": "nonsense" },
  { "content-range": "bytes 3-25/26", "content-encoding": "gzip" },
]) {
  test(`invalid resumed response is rejected: ${JSON.stringify(badHeaders)}`, async (t) => {
    const { controller, bytes, partialPath, finalPath } = await updateFixture(t, {
      artifactFetch: (body) => new Response(body.subarray(3), { status: 206, headers: badHeaders }),
    });
    assert.equal(bytes.length, 26);
    await controller.check();
    await writeFile(partialPath, bytes.subarray(0, 3));
    assert.equal((await controller.resume()).phase, "error");
    await assert.rejects(stat(partialPath), { code: "ENOENT" });
    await assert.rejects(stat(finalPath), { code: "ENOENT" });
  });
}

for (const status of [200, 206]) {
  test(`resume with HTTP ${status} produces exactly one verified installer`, async (t) => {
    const { controller, bytes, partialPath, finalPath } = await updateFixture(t, {
      artifactFetch: (body, init) => {
        assert.equal(init.headers.Range, "bytes=3-");
        return new Response(status === 206 ? body.subarray(3) : body, {
          status, headers: status === 206 ? { "content-range": `bytes 3-${body.length - 1}/${body.length}`, "content-length": String(body.length - 3) } : { "content-length": String(body.length) },
        });
      },
    });
    await controller.check();
    await writeFile(partialPath, bytes.subarray(0, 3));
    assert.equal((await controller.resume()).phase, "ready");
    assert.deepEqual(await readFile(finalPath), bytes);
    await assert.rejects(stat(partialPath), { code: "ENOENT" });
  });
}

test("a complete partial file is verified without another request", async (t) => {
  const { controller, bytes, partialPath, requests } = await updateFixture(t);
  await controller.check();
  await writeFile(partialPath, bytes);
  assert.equal((await controller.resume()).phase, "ready");
  assert.equal(requests.length, 1);
});

test("pause preserves a valid prefix, check cannot change it, and resume validates the range", async (t) => {
  let requests = 0;
  const fixture = await updateFixture(t, { artifactFetch: (bytes, init) => {
    requests += 1;
    if (requests === 1) return new Response(new ReadableStream({ start(stream) { stream.enqueue(bytes.subarray(0, 3)); } }));
    assert.equal(init.headers.Range, "bytes=3-");
    return new Response(bytes.subarray(3), { status: 206, headers: { "content-range": `bytes 3-${bytes.length - 1}/${bytes.length}` } });
  } });
  await fixture.controller.check();
  const downloading = fixture.controller.download();
  assert.equal(fixture.controller.download(), downloading);
  await waitUntil(() => fixture.controller.getState().downloadedBytes === 3);
  assert.equal((await fixture.controller.pause()).phase, "paused");
  await downloading;
  assert.deepEqual(await readFile(fixture.partialPath), fixture.bytes.subarray(0, 3));
  assert.equal((await fixture.controller.check()).phase, "paused");
  assert.equal((await fixture.controller.resume()).phase, "ready");
  assert.deepEqual(await readFile(fixture.finalPath), fixture.bytes);
});

for (const point of ["headers", "body"]) {
  test(`cancel during ${point} stops work and removes the partial file`, async (t) => {
    let requested = false;
    let signal;
    const { controller, partialPath } = await updateFixture(t, { artifactFetch: (bytes, init) => {
      requested = true;
      signal = init.signal;
      return point === "headers" ? new Promise(() => {}) : new Response(new ReadableStream({ start(stream) { stream.enqueue(bytes.subarray(0, 3)); } }));
    } });
    await controller.check();
    const downloading = controller.download();
    await waitUntil(() => requested && (point === "headers" || controller.getState().downloadedBytes === 3));
    assert.equal((await controller.cancel()).phase, "available");
    await downloading;
    assert.equal(signal.aborted, true);
    await assert.rejects(stat(partialPath), { code: "ENOENT" });
  });
}

test("concurrent checks share a request; disposal aborts it without later state events", async (t) => {
  let requested = false;
  let signal;
  const { controller, requests, states } = await updateFixture(t, { manifestFetch: (_manifest, init) => {
    requested = true;
    signal = init.signal;
    return new Promise(() => {});
  } });
  const checking = controller.check();
  assert.equal(controller.check(), checking);
  await waitUntil(() => requested);
  const count = states.length;
  controller.dispose();
  await checking;
  assert.equal(signal.aborted, true);
  assert.equal(states.length, count);
  assert.equal(requests.length, 1);
});

test("HTTPS redirects are bounded and an HTTP downgrade is never requested", async (t) => {
  const { controller, requests } = await updateFixture(t, { artifactFetch: () => new Response(null, { status: 302, headers: { location: "http://unsafe.example/file.exe" } }) });
  assert.equal((await controller.download()).phase, "error");
  assert.equal(requests.length, 2);
  assert.ok(requests.every(({ url }) => url.startsWith("https://")));
});

for (const mode of ["oversized", "stalled headers"]) {
  test(`real fetch closes a local test connection for ${mode}`, async (t) => {
    let connectionClosed = false;
    let sentBytes = 0;
    const server = createServer((_request, response) => {
      let interval;
      response.once("close", () => { connectionClosed = true; clearInterval(interval); });
      if (mode === "stalled headers") return;
      response.writeHead(200);
      interval = setInterval(() => {
        response.write(Buffer.alloc(1024));
        sentBytes += 1024;
      }, 10);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    });
    const port = server.address().port;
    const { controller, partialPath } = await updateFixture(t, {
      requestLimits: { ...smallTimeouts, headerTimeoutMs: 250 },
      // The transport is redirected only inside this test; production accepts HTTPS.
      artifactFetch: (_bytes, init) => fetch(`http://127.0.0.1:${port}/installer`, init),
    });
    assert.equal((await controller.download()).phase, "error");
    await waitUntil(() => connectionClosed);
    assert.ok(sentBytes < 1024 * 1024);
    await assert.rejects(stat(partialPath), { code: "ENOENT" });
  });
}

test("fallback mirrors share one total download deadline", async (t) => {
  const fixture = await updateFixture(t, {
    requestLimits: { ...smallTimeouts, headerTimeoutMs: 150, downloadTimeoutMs: 190 },
    artifactFetch: () => new Promise(() => {}),
  });
  fixture.manifest.mirrors = Array.from({ length: 8 }, (_, index) => ({ id: `mirror-${index}`, baseUrl: `https://mirror-${index}.example` }));
  const result = await fixture.controller.download();
  assert.equal(result.phase, "error");
  assert.match(result.message, /مهلت/);
  const attempts = fixture.requests.filter(({ url }) => !url.endsWith("stable.json")).length;
  // A busy event loop may exhaust the total deadline on the first mirror.
  // A per-mirror reset would incorrectly attempt all eight mirrors.
  assert.ok(attempts >= 1 && attempts <= 2, `Unexpected mirror attempts: ${attempts}`);
});

test("empty chunks cannot keep the body reader alive indefinitely", async (t) => {
  let cancelled = false;
  const { controller } = await updateFixture(t, {
    requestLimits: smallTimeouts,
    artifactFetch: () => new Response(new ReadableStream({
      pull(stream) { stream.enqueue(new Uint8Array(0)); },
      cancel() { cancelled = true; },
    })),
  });
  const state = await controller.download();
  assert.equal(state.phase, "error");
  assert.match(state.message, /مهلت/);
  assert.equal(cancelled, true);
});
