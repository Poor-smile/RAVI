import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  performLibraryMutation,
  safeLibraryPath,
  undoLibraryDelete,
} from "../desktop/library-filesystem.mjs";

async function fixture(t) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-obl04-"));
  const rootPath = path.join(temporary, "قفسهٔ من");
  const trashRoot = path.join(temporary, "trash");
  await mkdir(rootPath);
  t.after(() => rm(temporary, { recursive: true, force: true }));
  return { rootPath, trashRoot };
}

test("desktop contract rejects traversal, absolute paths and reserved names", async (t) => {
  const { rootPath, trashRoot } = await fixture(t);
  assert.throws(() => safeLibraryPath(rootPath, "../secret.md"), {
    code: "unsafe-path",
  });
  assert.throws(() => safeLibraryPath(rootPath, "C:\\secret.md"), {
    code: "unsafe-path",
  });
  await assert.rejects(
    performLibraryMutation({
      rootPath,
      trashRoot,
      request: {
        kind: "create-file",
        rootId: "root",
        parentPath: "",
        name: "CON.md",
      },
    }),
    { code: "invalid-name" },
  );
});

test("create, rename and move never overwrite an existing entry", async (t) => {
  const { rootPath, trashRoot } = await fixture(t);
  const mutate = (request) =>
    performLibraryMutation({ rootPath, trashRoot, request });

  await mutate({
    kind: "create-folder",
    rootId: "root",
    parentPath: "",
    name: "پژوهش فارسی",
  });
  await mutate({
    kind: "create-file",
    rootId: "root",
    parentPath: "",
    name: "draft one.md",
    content: "# پیش‌نویس",
  });
  await assert.rejects(
    mutate({
      kind: "create-file",
      rootId: "root",
      parentPath: "",
      name: "draft one.md",
    }),
    { code: "already-exists" },
  );

  const renamed = await mutate({
    kind: "rename",
    rootId: "root",
    sourcePath: "draft one.md",
    name: "نسخه نهایی.md",
    entryKind: "file",
  });
  assert.equal(renamed.result.nextPath, "نسخه نهایی.md");

  const moved = await mutate({
    kind: "move",
    rootId: "root",
    sourcePath: "نسخه نهایی.md",
    destinationFolder: "پژوهش فارسی",
    entryKind: "file",
  });
  assert.equal(moved.result.nextPath, "پژوهش فارسی/نسخه نهایی.md");
  assert.equal(
    await readFile(path.join(rootPath, "پژوهش فارسی", "نسخه نهایی.md"), "utf8"),
    "# پیش‌نویس",
  );

  await assert.rejects(
    mutate({
      kind: "rename",
      rootId: "root",
      sourcePath: "پژوهش فارسی/نسخه نهایی.md",
      name: "نسخه.txt",
      entryKind: "file",
    }),
    { code: "invalid-name" },
  );
});

test("delete is recoverable and undo refuses to overwrite a replacement", async (t) => {
  const { rootPath, trashRoot } = await fixture(t);
  const sourcePath = path.join(rootPath, "یادداشت حذف‌شونده.md");
  await writeFile(sourcePath, "متن محفوظ", "utf8");
  const deletion = await performLibraryMutation({
    rootPath,
    trashRoot,
    request: {
      kind: "delete",
      rootId: "root",
      sourcePath: "یادداشت حذف‌شونده.md",
      entryKind: "file",
    },
  });
  await assert.rejects(access(sourcePath));
  assert.ok(deletion.result.undoToken);
  await undoLibraryDelete(deletion.undoRecord);
  assert.equal(await readFile(sourcePath, "utf8"), "متن محفوظ");

  const secondDeletion = await performLibraryMutation({
    rootPath,
    trashRoot,
    request: {
      kind: "delete",
      rootId: "root",
      sourcePath: "یادداشت حذف‌شونده.md",
      entryKind: "file",
    },
  });
  await writeFile(sourcePath, "جایگزین", "utf8");
  await assert.rejects(undoLibraryDelete(secondDeletion.undoRecord), {
    code: "already-exists",
  });
  assert.equal(await readFile(sourcePath, "utf8"), "جایگزین");
});

test("folders cannot be moved into themselves", async (t) => {
  const { rootPath, trashRoot } = await fixture(t);
  await mkdir(path.join(rootPath, "parent", "child"), { recursive: true });
  await assert.rejects(
    performLibraryMutation({
      rootPath,
      trashRoot,
      request: {
        kind: "move",
        rootId: "root",
        sourcePath: "parent",
        destinationFolder: "parent/child",
        entryKind: "folder",
      },
    }),
    { code: "unsafe-path" },
  );
});
