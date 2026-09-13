import assert from "node:assert/strict";
import test from "node:test";
import { buildReadingDocumentIndex, createReadingDocumentIndexer, searchReadingDocument } from "../app/search/reading-document-index";
import { createReadingSearchService } from "../app/search/reading-search-service";

test("incremental indexing preserves every match and heading after edits and cancellation", async () => {
  const source = Array.from({ length: 30 }, (_, i) => `## فصل ${i}\n\n${"زمینه یکتا ".repeat(700)}\n\n`).join("");
  const indexer = createReadingDocumentIndexer();
  await indexer.build(source);
  const changed = source.replace("فصل 17", "عنوان تازه").replace("فصل 20", "عنوان بعدی");
  const next = await indexer.build(changed);
  assert.ok(next && next.reusedChunks > 0 && next.parsedChunks > 0);
  assert.deepEqual(next.blocks, buildReadingDocumentIndex(changed));
  let yields = 0;
  assert.equal(await indexer.build(source + "\n# لغو", () => yields > 1, async () => { yields++; }), null);
  const repeated = await indexer.build(changed);
  assert.equal(repeated?.parsedChunks, 0);
});

test("latest query keeps its document while superseding an unfinished build and pages exact occurrences", async () => {
  const replies: unknown[] = [];
  const old = "# قدیم\n\n" + "نشانه ".repeat(20_000);
  const current = "# جدید\n\n" + "کتاب ".repeat(207) + "\n\nآخرین کتاب\n";
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("worker service timeout")), 10_000);
    const service = createReadingSearchService(response => {
      replies.push(response);
      try {
        assert.equal(response.id, 3);
        assert.deepEqual(response, { id: 3, ...searchReadingDocument(buildReadingDocumentIndex(current), "كتاب", 4) });
        clearTimeout(timeout); resolve();
      } catch (error) { clearTimeout(timeout); reject(error); }
    });
    service.request({ id: 1, content: old, query: "نشانه", page: 0 });
    service.request({ id: 2, content: current, query: "جدید", page: 0 });
    service.request({ id: 3, query: "كتاب", page: 4 });
  });
  assert.equal(replies.length, 1);
});
