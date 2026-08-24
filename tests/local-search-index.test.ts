import assert from "node:assert/strict";
import test from "node:test";
import {
  LocalSearchIndex,
  normalizeSearchText,
  rankQuickOpenCandidates,
  type LocalSearchSource,
} from "../app/search/local-index";

function source(
  index: number,
  content = `# یادداشت ${index}\nمتن نمونه برای فایل ${index}`,
): LocalSearchSource {
  return {
    key: `root::folder/note-${index}.md`,
    name: `یادداشت ${index}.md`,
    path: `قفسه/folder/note-${index}.md`,
    relativePath: `folder/note-${index}.md`,
    rootId: "root",
    lastModified: index,
    size: content.length,
    readText: async () => content,
  };
}

test("Persian and Arabic character variants share one searchable form", () => {
  assert.equal(normalizeSearchText("يادداشت كاربردی"), "یادداشت کاربردی");
});

test("one thousand files index incrementally without monopolizing the task queue", async () => {
  const index = new LocalSearchIndex();
  index.updateSources(Array.from({ length: 1_000 }, (_, item) => source(item)));
  let yielded = false;
  const timer = setTimeout(() => {
    yielded = true;
  }, 0);
  const progress = await index.indexAll();
  clearTimeout(timer);
  assert.equal(progress.indexed, 1_000);
  assert.equal(progress.errors, 0);
  assert.equal(yielded, true);
});

test("a newer query can cancel the previous indexing or search work", async () => {
  const index = new LocalSearchIndex();
  index.updateSources([
    {
      ...source(1),
      readText: () => new Promise((resolve) => setTimeout(() => resolve("کند"), 15)),
    },
  ]);
  const controller = new AbortController();
  const work = index.indexAll({ signal: controller.signal });
  controller.abort();
  await assert.rejects(work, (error: unknown) => {
    return error instanceof DOMException && error.name === "AbortError";
  });
});

test("full-text results expose a readable snippet, line and source offset", async () => {
  const index = new LocalSearchIndex();
  index.updateSources([
    source(1, "# عنوان\nخط معمولی\nاین عبارت مهم در متن است."),
    source(2, "# سند دیگر\nبدون نتیجه"),
  ]);
  await index.indexAll();
  const [result] = await index.search("عبارت مهم", {
    scope: "content",
    sort: "relevance",
  });
  assert.equal(result.key, source(1).key);
  assert.equal(result.line, 3);
  assert.match(result.snippet, /عبارت مهم/u);
  assert.equal(typeof result.offset, "number");
});

test("source refresh removes deleted paths and indexes renamed files", async () => {
  const index = new LocalSearchIndex();
  index.updateSources([source(1, "کلید قدیمی")]);
  await index.indexAll();
  const renamed = {
    ...source(2, "کلید تازه"),
    name: "نام تازه.md",
    path: "قفسه/folder/نام تازه.md",
  };
  index.updateSources([renamed]);
  await index.indexAll();
  assert.equal(index.snapshot().some((item) => item.key === source(1).key), false);
  const results = await index.search("کلید تازه", {
    scope: "content",
    sort: "relevance",
  });
  assert.equal(results[0]?.key, renamed.key);
});

test("Quick Open combines fuzzy match with local recency, frequency and pinning", () => {
  const now = Date.UTC(2026, 7, 14);
  const ranked = rankQuickOpenCandidates(
    [
      { key: "a", name: "گزارش.md", path: "الف/گزارش.md", lastModified: 1 },
      {
        key: "b",
        name: "گزارش نهایی.md",
        path: "ب/گزارش نهایی.md",
        lastModified: 2,
        openedAt: now - 1_000,
        openCount: 5,
        pinned: true,
      },
    ],
    "گزارش",
    now,
  );
  assert.equal(ranked[0].key, "b");
});
