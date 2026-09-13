import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { downloadCodexPackage, validateCodexArchiveEntries } from "../desktop/managed-codex.mjs";
import { createCodexConnector } from "../desktop/codex-connect.mjs";

const content = Buffer.from("verified package fixture");
const asset = { bytes: content.length, sha256: createHash("sha256").update(content).digest("hex"), urls: ["https://mirror.example/package"] };

test("managed download verifies content, retries a corrupt mirror and removes partial files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ravi-runtime-test-"));
  const file = path.join(root, "package.tar.gz");
  try {
    let calls = 0;
    const progress = [];
    await downloadCodexPackage({ ...asset, urls: [...asset.urls, "https://upstream.example/package"] }, file, value => progress.push(value), async () => new Response(++calls === 1 ? Buffer.alloc(content.length) : content));
    assert.equal(calls, 2);
    assert.deepEqual(await readFile(file), content);
    assert.equal(progress.at(-1).phase, "verifying");
    await assert.rejects(downloadCodexPackage(asset, file, undefined, async () => new Response(content.subarray(0, 3))), /CODEX_PACKAGE_MISMATCH/);
    await assert.rejects(access(file));
    await assert.rejects(downloadCodexPackage({ ...asset, urls: ["http://mirror.example/package"] }, file), /CODEX_INSECURE_DOWNLOAD/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("archive entries reject absolute paths and traversal", () => {
  validateCodexArchiveEntries("bin/\nbin/codex\ncodex-path/rg\n");
  for (const listing of ["../escape", "/absolute", "C:/escape", "bin/../../escape", "bin\\escape", ""]) {
    assert.throws(() => validateCodexArchiveEntries(listing), /CODEX_INVALID_ARCHIVE/);
  }
});

test("one connection action installs missing tools before login and coalesces repeated clicks", async () => {
  const calls = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const connector = createCodexConnector({
    readStatus: async () => ({ state: "cli_missing" }), resolveCommand: async () => null,
    install: async report => { calls.push("install"); report({ phase: "downloading", percent: 50 }); await gate; },
    login: async () => { calls.push("login"); return { started: true, state: "auth_waiting" }; },
    onProgress: () => {},
  });
  const first = connector.connect();
  assert.equal(connector.connect(), first);
  release();
  assert.equal((await first).started, true);
  assert.deepEqual(calls, ["install", "login"]);
});

test("connected accounts are preserved and failed installs can retry without starting login", async () => {
  let state = "connected", fail = true, logins = 0, installs = 0;
  const connector = createCodexConnector({
    readStatus: async () => ({ state }), resolveCommand: async () => null,
    install: async () => { installs++; if (fail) throw new Error("CODEX_PACKAGE_MISMATCH"); },
    login: async () => { logins++; return { started: true, state: "auth_waiting" }; }, onProgress: () => {},
  });
  assert.equal((await connector.connect()).state, "connected");
  assert.equal(installs, 0);
  state = "cli_missing";
  assert.equal((await connector.connect()).code, "CODEX_PACKAGE_MISMATCH");
  assert.equal(logins, 0);
  fail = false;
  assert.equal((await connector.connect()).started, true);
  assert.equal(logins, 1);
});
