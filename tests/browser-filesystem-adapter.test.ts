import assert from "node:assert/strict";
import test from "node:test";
import {
  performBrowserLibraryMutation,
  undoBrowserLibraryDelete,
  type BrowserDirectoryHandle,
  type BrowserFileHandle,
  type BrowserUndoRecord,
} from "../app/filesystem/browser-adapter";

function missing() {
  return Object.assign(new Error("missing"), { code: "ENOENT" });
}

class MemoryFile implements BrowserFileHandle {
  kind = "file" as const;
  bytes = new Uint8Array();

  constructor(public name: string) {}

  async getFile() {
    return new File([this.bytes], this.name, { lastModified: 1 });
  }

  async createWritable() {
    return {
      write: async (data: Blob | BufferSource | string) => {
        if (typeof data === "string") {
          this.bytes = new TextEncoder().encode(data);
        } else if (data instanceof Blob) {
          this.bytes = new Uint8Array(await data.arrayBuffer());
        } else if (ArrayBuffer.isView(data)) {
          this.bytes = new Uint8Array(
            data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
          );
        } else {
          this.bytes = new Uint8Array(data);
        }
      },
      close: async () => {},
      abort: async () => {},
    };
  }

  text() {
    return new TextDecoder().decode(this.bytes);
  }
}

class MemoryDirectory implements BrowserDirectoryHandle {
  kind = "directory" as const;
  entries = new Map<string, MemoryDirectory | MemoryFile>();

  constructor(public name: string) {}

  async *values() {
    yield* this.entries.values();
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    const existing = this.entries.get(name);
    if (existing instanceof MemoryFile) return existing;
    if (existing || !options?.create) throw missing();
    const file = new MemoryFile(name);
    this.entries.set(name, file);
    return file;
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const existing = this.entries.get(name);
    if (existing instanceof MemoryDirectory) return existing;
    if (existing || !options?.create) throw missing();
    const directory = new MemoryDirectory(name);
    this.entries.set(name, directory);
    return directory;
  }

  async removeEntry(name: string, options?: { recursive?: boolean }) {
    const existing = this.entries.get(name);
    if (!existing) throw missing();
    if (
      existing instanceof MemoryDirectory &&
      existing.entries.size &&
      !options?.recursive
    ) {
      throw new Error("not empty");
    }
    this.entries.delete(name);
  }

  async requestPermission() {
    return "granted";
  }

  async queryPermission() {
    return "granted";
  }
}

test("web adapter follows the same safe create, rename, move, delete and undo contract", async () => {
  const root = new MemoryDirectory("قفسه");
  const undo = new Map<string, BrowserUndoRecord>();

  await performBrowserLibraryMutation(
    root,
    {
      kind: "create-file",
      rootId: "root",
      parentPath: "",
      name: "پیش‌نویس.md",
      content: "# متن",
    },
    undo,
  );
  assert.equal((root.entries.get("پیش‌نویس.md") as MemoryFile).text(), "# متن");

  await assert.rejects(
    performBrowserLibraryMutation(
      root,
      {
        kind: "create-file",
        rootId: "root",
        parentPath: "",
        name: "پیش‌نویس.md",
      },
      undo,
    ),
    { code: "already-exists" },
  );

  await performBrowserLibraryMutation(
    root,
    {
      kind: "rename",
      rootId: "root",
      sourcePath: "پیش‌نویس.md",
      name: "نسخه نهایی.md",
      entryKind: "file",
    },
    undo,
  );
  await performBrowserLibraryMutation(
    root,
    {
      kind: "create-folder",
      rootId: "root",
      parentPath: "",
      name: "بایگانی",
    },
    undo,
  );
  await performBrowserLibraryMutation(
    root,
    {
      kind: "move",
      rootId: "root",
      sourcePath: "نسخه نهایی.md",
      destinationFolder: "بایگانی",
      entryKind: "file",
    },
    undo,
  );
  const archive = root.entries.get("بایگانی") as MemoryDirectory;
  assert.equal((archive.entries.get("نسخه نهایی.md") as MemoryFile).text(), "# متن");

  const deletion = await performBrowserLibraryMutation(
    root,
    {
      kind: "delete",
      rootId: "root",
      sourcePath: "بایگانی/نسخه نهایی.md",
      entryKind: "file",
    },
    undo,
  );
  assert.equal(archive.entries.has("نسخه نهایی.md"), false);
  await undoBrowserLibraryDelete(root, deletion.undoToken!, undo);
  assert.equal((archive.entries.get("نسخه نهایی.md") as MemoryFile).text(), "# متن");
});
