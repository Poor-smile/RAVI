import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("dependency gate rejects manifest drift, mixed managers and wrong installed versions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "raavi-lock-contract-"));
  try {
    await mkdir(path.join(root, "scripts"));
    await mkdir(path.join(root, "node_modules/example"), { recursive: true });
    await copyFile(new URL("../scripts/verify-dependency-lock.mjs", import.meta.url), path.join(root, "scripts/verify-dependency-lock.mjs"));
    const manifest = { name: "example", version: "1.0.0", dependencies: { example: "1.0.0" } };
    await writeFile(path.join(root, "package.json"), JSON.stringify(manifest));
    await writeFile(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": manifest, "node_modules/example": { version: "1.0.0" }, "node_modules/other-os": { version: "1.0.0", optional: true } } }));
    const installedPath = path.join(root, "node_modules/example/package.json");
    await writeFile(installedPath, JSON.stringify({ version: "1.0.0" }));
    const run = () => spawnSync(process.execPath, [path.join(root, "scripts/verify-dependency-lock.mjs")], { encoding: "utf8", windowsHide: true });
    assert.equal(run().status, 0);
    await writeFile(path.join(root, "package.json"), JSON.stringify({ ...manifest, version: "1.0.1" }));
    assert.equal(run().status, 1);
    await writeFile(path.join(root, "package.json"), JSON.stringify(manifest));
    await writeFile(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: 9");
    assert.equal(run().status, 1);
    await rm(path.join(root, "pnpm-lock.yaml"));
    await writeFile(installedPath, JSON.stringify({ version: "1.0.1" }));
    assert.equal(run().status, 1);
    await rm(installedPath);
    assert.equal(run().status, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
