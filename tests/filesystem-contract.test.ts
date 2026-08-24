import assert from "node:assert/strict";
import test from "node:test";
import {
  joinLibraryPath,
  normalizeLibraryRelativePath,
  validateLibraryDocumentRename,
  validateLibraryEntryName,
} from "../app/filesystem/contract";

test("library names preserve Persian and Unicode while rejecting OS hazards", () => {
  assert.equal(
    validateLibraryEntryName("گزارش نهایی ۱۴۰۵.md", { kind: "file" }),
    "",
  );
  assert.equal(
    validateLibraryEntryName("research 📚", { kind: "folder" }),
    "",
  );
  assert.match(
    validateLibraryEntryName("CON.md", { kind: "file" }),
    /رزرو/u,
  );
  assert.match(
    validateLibraryEntryName("bad?.md", { kind: "file" }),
    /نامعتبر/u,
  );
});

test("relative paths normalize separators without accepting traversal", () => {
  assert.equal(
    normalizeLibraryRelativePath("پوشه\\English path\\یادداشت.md"),
    "پوشه/English path/یادداشت.md",
  );
  assert.equal(
    joinLibraryPath("پوشهٔ من", "new note.md"),
    "پوشهٔ من/new note.md",
  );
  assert.throws(() => normalizeLibraryRelativePath("../secret.md"));
  assert.throws(() => normalizeLibraryRelativePath("folder/../../secret.md"));
});

test("renames keep the portable document extension", () => {
  assert.equal(validateLibraryDocumentRename("الف.md", "ب.markdown"), "");
  assert.equal(validateLibraryDocumentRename("الف.ravi", "ب.ravi"), "");
  assert.match(validateLibraryDocumentRename("الف.md", "ب.txt"), /Markdown/u);
  assert.match(
    validateLibraryDocumentRename("الف.ravi", "ب.md"),
    /سند قدیمی|Markdown/u,
  );
});
