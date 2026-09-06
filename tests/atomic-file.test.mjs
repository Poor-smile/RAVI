import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { fork, execFileSync } from "node:child_process";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createAtomicFileWriter, createFileTaskQueue } from "../desktop/atomic-file.mjs";

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "raavi-atomic-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const target = path.join(directory, "نوشته.md");
  await fs.writeFile(target, "نسخهٔ قبلی\n");
  return { directory, target };
}

function interceptHandle(handle, overrides) {
  return new Proxy(handle, {
    get(target, property) {
      if (property in overrides) return overrides[property];
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

test("atomic save replaces and creates complete UTF-8 files without temporary leftovers", async (t) => {
  const { directory, target } = await fixture(t);
  const write = createAtomicFileWriter();
  await write(target, "متن تازه 📝\n".repeat(10_000));
  assert.equal(await fs.readFile(target, "utf8"), "متن تازه 📝\n".repeat(10_000));
  const created = path.join(directory, "new.md");
  await write(created, "new");
  assert.equal(await fs.readFile(created, "utf8"), "new");
  await write(target, "");
  assert.equal((await fs.stat(target)).size, 0);
  assert.deepEqual((await fs.readdir(directory)).sort(), ["new.md", "نوشته.md"]);
});

for (const stage of ["open", "copy", "write", "sync", "close", "rename"]) {
  test(`failure during ${stage} preserves original, cleans temporary, and allows retry`, async (t) => {
    const { directory, target } = await fixture(t);
    const fail = () => { throw Object.assign(new Error(stage), { code: stage === "write" ? "ENOSPC" : "EACCES" }); };
    const faultyFs = {
      ...fs,
      copyFile: stage === "copy" ? fail : fs.copyFile,
      rename: stage === "rename" ? fail : fs.rename,
      open: async (file, ...args) => {
        if (stage === "open") fail();
        const handle = await fs.open(file, ...args);
        if (!file.endsWith(".tmp")) return handle;
        const overrides = {};
        if (stage === "write") overrides.write = async (...parameters) => { await handle.write(...parameters); fail(); };
        if (stage === "sync") overrides.sync = fail;
        if (stage === "close") overrides.close = async () => { await handle.close(); fail(); };
        return interceptHandle(handle, overrides);
      },
    };
    await assert.rejects(createAtomicFileWriter({ fs: faultyFs })(target, "new contents"), /./);
    assert.equal(await fs.readFile(target, "utf8"), "نسخهٔ قبلی\n");
    assert.deepEqual(await fs.readdir(directory), ["نوشته.md"]);
    await createAtomicFileWriter()(target, "retry");
    assert.equal(await fs.readFile(target, "utf8"), "retry");
  });
}

test("short writes are completed; a zero-byte write fails safely", async (t) => {
  const { target } = await fixture(t);
  let zero = false;
  const write = createAtomicFileWriter({ fs: {
    ...fs,
    open: async (...args) => {
      const file = await fs.open(...args);
      return interceptHandle(file, { write: (buffer, offset, length) => zero
        ? Promise.resolve({ bytesWritten: 0 }) : file.write(buffer, offset, Math.min(3, length)) });
    },
  } });
  await write(target, "متن فارسی".repeat(100));
  assert.equal(await fs.readFile(target, "utf8"), "متن فارسی".repeat(100));
  zero = true;
  await assert.rejects(write(target, "bad"), { code: "EIO" });
  assert.equal(await fs.readFile(target, "utf8"), "متن فارسی".repeat(100));
  zero = false;
  await write(target, "recovered queue");
});

test("concurrent saves through directory aliases retain submission order and snapshot buffers", async (t) => {
  const { directory, target } = await fixture(t);
  const alias = path.join(directory, "alias");
  const real = path.join(directory, "real");
  await fs.mkdir(real);
  await fs.symlink(real, alias, process.platform === "win32" ? "junction" : "dir");
  const write = createAtomicFileWriter();
  const pending = [];
  for (let index = 0; index < 40; index += 1) {
    pending.push(write(path.join(index % 2 ? alias : real, "shared.md"), `${index}`.repeat(10_000)));
  }
  const bytes = Buffer.from("snapshot");
  pending.push(write(target, bytes));
  bytes.fill(0);
  await Promise.all(pending);
  assert.equal(await fs.readFile(path.join(real, "shared.md"), "utf8"), "39".repeat(10_000));
  assert.equal(await fs.readFile(target, "utf8"), "snapshot");
});

test("different files can progress while one file is blocked", async (t) => {
  const { directory, target } = await fixture(t);
  const queue = createFileTaskQueue();
  let release;
  const blocked = queue(target, () => new Promise((resolve) => { release = resolve; }));
  const other = await queue(path.join(directory, "other.md"), () => "finished");
  assert.equal(other, "finished");
  release();
  await blocked;
});

test("save preserves a restrictive Windows DACL", { skip: process.platform !== "win32" }, async (t) => {
  const { target } = await fixture(t);
  const command = (script) => execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    env: { ...process.env, RAAVI_ACL_TEST_FILE: target }, encoding: "utf8", windowsHide: true,
  }).trim();
  command("$acl = [System.IO.File]::GetAccessControl($env:RAAVI_ACL_TEST_FILE); $acl.SetAccessRuleProtection($true, $true); [System.IO.File]::SetAccessControl($env:RAAVI_ACL_TEST_FILE, $acl)");
  const readAcl = "[System.IO.File]::GetAccessControl($env:RAAVI_ACL_TEST_FILE).GetSecurityDescriptorSddlForm([System.Security.AccessControl.AccessControlSections]::All)";
  const before = command(readAcl);
  await createAtomicFileWriter()(target, "saved with original ACL");
  // Windows recomputes the auto-inherited bookkeeping bit at creation; the
  // protected bit, owner/group, and every access rule must remain identical.
  const permissions = (value) => value.replace(/D:(P?)AI(?=\()/, "D:$1");
  assert.equal(permissions(command(readAcl)), permissions(before));
});

test("read-only targets are not replaced", async (t) => {
  const { target } = await fixture(t);
  await fs.chmod(target, 0o444);
  try {
    await assert.rejects(createAtomicFileWriter()(target, "bad"));
    assert.equal(await fs.readFile(target, "utf8"), "نسخهٔ قبلی\n");
  } finally {
    await fs.chmod(target, 0o666);
  }
});

test("Windows long paths and shell metacharacters are treated as file names", { skip: process.platform !== "win32" }, async (t) => {
  const { directory } = await fixture(t);
  const parent = path.join(directory, "a".repeat(100), "b".repeat(100));
  await fs.mkdir(parent, { recursive: true });
  const target = path.join(parent, "نوشته ' $() ` .md");
  await fs.writeFile(target, "before");
  await createAtomicFileWriter()(target, "after");
  assert.equal(await fs.readFile(target, "utf8"), "after");
});

for (const stage of ["before-rename", "after-rename"]) {
  test(`process termination ${stage} leaves a complete document recoverable on next save`, async (t) => {
    const { directory, target } = await fixture(t);
    const child = fork(new URL("./fixtures/atomic-save-child.mjs", import.meta.url), [target, stage], { stdio: ["ignore", "ignore", "pipe", "ipc"], windowsHide: true });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    await once(child, "message");
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
    assert.equal(await fs.readFile(target, "utf8"), stage === "before-rename" ? "نسخهٔ قبلی\n" : "complete replacement");
    const orphans = (await fs.readdir(directory)).filter((name) => name.endsWith(".tmp"));
    assert.equal(orphans.length, stage === "before-rename" ? 1 : 0);
    // A new process/save never promotes an orphan, and is not blocked by it.
    await createAtomicFileWriter()(target, "saved after restart");
    assert.equal(await fs.readFile(target, "utf8"), "saved after restart");
  });
}
