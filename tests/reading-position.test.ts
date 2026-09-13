import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  captureReadingViewport,
  createReadingDraftId,
  READING_POSITION_VERSION,
  readingContentSignature,
  readingDocumentKey,
  restoreReadingViewport,
  sanitizeReadingPositionMap,
  upsertReadingPosition,
  type ReadingPositionRecord,
  type ReadingPositionMap,
} from "../app/reading-position";

test("reading document keys remain stable for native paths", () => {
  assert.equal(
    readingDocumentKey({
      activeDocumentPath: "C:\\Notes\\فصل.md",
      draftId: "unused",
    }),
    "file:c:/notes/فصل.md",
  );
});

test("source anchors retain exact identity when unvisited predecessor blocks are absent", () => {
  const repeated = "متن کاملاً تکراری در همه بخش‌ها";
  const source = readingFixture(Array.from({ length: 12 }, () => ({ tag: "p", text: repeated })), 8 * 212 - 300);
  Array.from(source.context.article.children).forEach((element, index) => element.setAttribute("data-source-offset", String(index * 1000)));
  const snapshot = captureReadingViewport(source.context)!;
  assert.equal(snapshot.anchor.sourceOffset, 8000);
  const sparse = readingFixture(Array.from({ length: 5 }, () => ({ tag: "p", text: repeated })), 0);
  [0, 8000, 9000, 10000, 11000].forEach((offset, index) => sparse.context.article.children[index].setAttribute("data-source-offset", String(offset)));
  const result = restoreReadingViewport(sparse.context, { ...snapshot, version: READING_POSITION_VERSION, documentKey: "draft:sparse", contentSignature: "same", viewMode: "reading", readerSize: 18, outlineOpen: false, updatedAt: 1 }, "same");
  assert.equal(result.match, "exact");
  assert.equal(captureReadingViewport(sparse.context)?.anchor.sourceOffset, 8000);
});

test("draft ids and content signatures are stable enough for local records", () => {
  const draftId = createReadingDraftId();
  assert.match(draftId, /^draft-/u);
  assert.equal(
    readingContentSignature("متن فارسی"),
    readingContentSignature("متن فارسی"),
  );
  assert.notEqual(
    readingContentSignature("متن فارسی"),
    readingContentSignature("متن فارسی تازه"),
  );
});

test("invalid and excessive reading records are rejected and capped", () => {
  const makeRecord = (index: number): ReadingPositionRecord => ({
    version: READING_POSITION_VERSION,
    documentKey: `draft:${index}`,
    contentSignature: "sig",
    viewMode: "reading",
    anchor: {
      blockIndex: index,
      blockType: "p",
      headingPath: ["فصل"],
      textPrefix: "ابتدای بند",
      textSuffix: "انتهای بند",
    },
    viewportOffset: 12,
    fallbackProgress: 0.5,
    readerSize: 18,
    outlineOpen: true,
    updatedAt: index,
  });
  let positions: ReadingPositionMap = {};
  for (let index = 0; index < 130; index += 1) {
    positions = upsertReadingPosition(positions, makeRecord(index));
  }
  assert.equal(Object.keys(positions).length, 100);
  assert.equal(Boolean(positions["draft:129"]), true);
  assert.equal(Boolean(positions["draft:0"]), false);
  assert.deepEqual(sanitizeReadingPositionMap({ broken: { version: 1 } }), {});
});

type ReadingFixtureBlock = {
  tag: "h1" | "h2" | "p" | "figure";
  text: string;
  height?: number;
};

function readingFixture(blocks: ReadingFixtureBlock[], initialScrollTop: number) {
  const dom = new JSDOM(
    '<!doctype html><main id="root"><article id="article"></article></main>',
  );
  const fixtureWindow = dom.window;
  const fixtureDocument = fixtureWindow.document;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fixtureWindow,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: fixtureDocument,
  });
  const root = fixtureDocument.getElementById("root") as HTMLElement;
  const article = fixtureDocument.getElementById("article") as HTMLElement;
  let scrollTop = initialScrollTop;
  const blockGap = 32;
  const positions = blocks.map((block, index) => ({
    top: blocks
      .slice(0, index)
      .reduce((total, previous) => total + (previous.height ?? 180) + blockGap, 0),
    height: block.height ?? 180,
  }));
  const contentHeight = positions.reduce(
    (maximum, position) => Math.max(maximum, position.top + position.height),
    0,
  );

  Object.defineProperties(root, {
    clientHeight: { configurable: true, value: 800 },
    scrollHeight: {
      configurable: true,
      get: () => Math.max(800, contentHeight + 300),
    },
    scrollTop: {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    },
  });
  root.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      right: 900,
      bottom: 800,
      left: 0,
      width: 900,
      height: 800,
      toJSON: () => ({}),
    }) as DOMRect;

  blocks.forEach((block, index) => {
    const element = fixtureDocument.createElement(block.tag);
    element.textContent = block.text;
    element.getBoundingClientRect = () => {
      const top = positions[index].top - scrollTop;
      const blockHeight = positions[index].height;
      return {
        x: 0,
        y: top,
        top,
        right: 700,
        bottom: top + blockHeight,
        left: 0,
        width: 700,
        height: blockHeight,
        toJSON: () => ({}),
      } as DOMRect;
    };
    article.append(element);
  });

  return {
    context: { article, root },
    scrollTop: () => scrollTop,
  };
}

test("semantic anchors survive prepended content when paragraphs repeat across chapters", () => {
  const repeatedParagraph =
    "این بند عمداً در همهٔ فصل‌ها تکرار می‌شود تا بازیابی فقط به اولین تطبیق متنی اعتماد نکند.";
  const originalBlocks: ReadingFixtureBlock[] = [
    { tag: "h1", text: "کتاب" },
    { tag: "h2", text: "فصل یک" },
    { tag: "p", text: repeatedParagraph },
    { tag: "p", text: "نشانهٔ همسایهٔ فصل یک" },
    { tag: "h2", text: "فصل دو" },
    { tag: "p", text: repeatedParagraph },
    { tag: "p", text: "نشانهٔ همسایهٔ فصل دو" },
    { tag: "h2", text: "فصل سه" },
    { tag: "p", text: repeatedParagraph },
    { tag: "p", text: "نشانهٔ همسایهٔ فصل سه" },
  ];
  const targetIndex = 8;
  const original = readingFixture(originalBlocks, targetIndex * 212 - 300);
  const snapshot = captureReadingViewport(original.context);
  assert.ok(snapshot);
  assert.equal(snapshot.anchor.headingPath.at(-1), "فصل سه");

  const record: ReadingPositionRecord = {
    version: READING_POSITION_VERSION,
    documentKey: "file:c:/notes/book.md",
    contentSignature: readingContentSignature("original"),
    viewMode: "reading",
    ...snapshot,
    readerSize: 18,
    outlineOpen: true,
    updatedAt: Date.now(),
  };
  const changedBlocks: ReadingFixtureBlock[] = [
    { tag: "h1", text: "مقدمهٔ افزوده‌شده" },
    { tag: "p", text: "این بند بیرون از راوی اضافه شده است." },
    ...originalBlocks,
  ];
  const changed = readingFixture(changedBlocks, original.scrollTop());
  const result = restoreReadingViewport(
    changed.context,
    record,
    readingContentSignature("changed"),
  );
  const restored = captureReadingViewport(changed.context);

  assert.equal(result.match, "exact");
  assert.ok(restored);
  assert.equal(restored.anchor.headingPath.at(-1), "فصل سه");
  assert.equal(restored.anchor.textPrefix, snapshot.anchor.textPrefix);
  assert.equal(restored.viewportOffset, snapshot.viewportOffset);
});

test("a nearby semantic neighbor survives a renamed chapter and a prepend", () => {
  const repeated = "این متن مشترک در چند فصل تکرار شده و باید با بافت اطراف خود پیدا شود.";
  const originalBlocks: ReadingFixtureBlock[] = [
    { tag: "h1", text: "کتاب" },
    { tag: "h2", text: "فصل اول" },
    { tag: "p", text: repeated },
    { tag: "p", text: "پایان فصل اول" },
    { tag: "h2", text: "فصل دوم" },
    { tag: "p", text: repeated },
    { tag: "p", text: "نشانهٔ یکتای پس از بند هدف" },
  ];
  const original = readingFixture(originalBlocks, 5 * 212 - 300);
  const snapshot = captureReadingViewport(original.context);
  assert.ok(snapshot);
  const record: ReadingPositionRecord = {
    version: READING_POSITION_VERSION,
    documentKey: "file:c:/notes/renamed.md",
    contentSignature: "before",
    viewMode: "reading",
    ...snapshot,
    readerSize: 18,
    outlineOpen: true,
    updatedAt: 1,
  };
  const changed = readingFixture(
    [
      { tag: "p", text: "یادداشت تازه در ابتدای سند" },
      ...originalBlocks.map((block, index) =>
        index === 4 ? { ...block, text: "فصل دوم — بازنگری‌شده" } : block,
      ),
    ],
    original.scrollTop(),
  );

  const result = restoreReadingViewport(changed.context, record, "after");
  const restored = captureReadingViewport(changed.context);
  assert.equal(result.match, "exact");
  assert.ok(restored);
  assert.equal(restored.anchor.textPrefix, snapshot.anchor.textPrefix);
  assert.equal(restored.anchor.headingPath.at(-1), "فصل دوم — بازنگری‌شده");
});

test("the same anchor and viewport offset are restored after late media reflow", () => {
  const compactBlocks: ReadingFixtureBlock[] = [
    { tag: "h1", text: "کتاب" },
    { tag: "h2", text: "فصل رسانه" },
    { tag: "figure", text: "تصویر فصل", height: 180 },
    { tag: "p", text: "بند پیش از هدف" },
    { tag: "p", text: "بند هدف پس از تصویر دیررس" },
    { tag: "p", text: "بند پس از هدف یک" },
    { tag: "p", text: "بند پس از هدف دو" },
    { tag: "p", text: "بند پس از هدف سه" },
  ];
  const compact = readingFixture(compactBlocks, 4 * 212 - 300);
  const snapshot = captureReadingViewport(compact.context);
  assert.ok(snapshot);
  const record: ReadingPositionRecord = {
    version: READING_POSITION_VERSION,
    documentKey: "file:c:/notes/media.md",
    contentSignature: "same",
    viewMode: "reading",
    ...snapshot,
    readerSize: 18,
    outlineOpen: false,
    updatedAt: 1,
  };
  const expanded = readingFixture(
    compactBlocks.map((block, index) =>
      index === 2 ? { ...block, height: 920 } : block,
    ),
    compact.scrollTop(),
  );

  const result = restoreReadingViewport(expanded.context, record, "same");
  const restored = captureReadingViewport(expanded.context);
  assert.equal(result.match, "index");
  assert.ok(restored);
  assert.equal(restored.anchor.textPrefix, snapshot.anchor.textPrefix);
  assert.equal(restored.viewportOffset, snapshot.viewportOffset);
});

test("fully replaced content uses deterministic progress fallback", () => {
  const before = readingFixture(
    Array.from({ length: 12 }, (_, index) => ({
      tag: index === 0 ? ("h1" as const) : ("p" as const),
      text: `متن اصلی ${index}`,
    })),
    940,
  );
  const snapshot = captureReadingViewport(before.context);
  assert.ok(snapshot);
  const record: ReadingPositionRecord = {
    version: READING_POSITION_VERSION,
    documentKey: "file:c:/notes/replaced.md",
    contentSignature: "before",
    viewMode: "reading",
    ...snapshot,
    readerSize: 18,
    outlineOpen: true,
    updatedAt: 1,
  };
  const replacement = readingFixture(
    Array.from({ length: 20 }, (_, index) => ({
      tag: index === 0 ? ("h1" as const) : ("p" as const),
      text: `محتوای کاملاً جایگزین ${index}`,
    })),
    0,
  );

  const result = restoreReadingViewport(replacement.context, record, "after");
  assert.equal(result.match, "progress");
  assert.ok(
    Math.abs(
      replacement.scrollTop() -
        (20 * 212 - 32 + 300 - 800) * record.fallbackProgress,
    ) < 1,
  );
});

test("valid version-one records migrate without losing their anchor", () => {
  const legacyKey = "file:c:/notes/legacy.md";
  const legacy = {
    [legacyKey]: {
      version: 1,
      documentKey: legacyKey,
      contentSignature: "legacy",
      viewMode: "reading",
      anchor: {
        blockIndex: 4,
        blockType: "p",
        headingPath: ["فصل قدیمی"],
        textPrefix: "ابتدای بند قدیمی",
        textSuffix: "انتهای بند قدیمی",
      },
      viewportOffset: 20,
      fallbackProgress: 0.4,
      readerSize: 18,
      outlineOpen: true,
      updatedAt: 1,
    },
  };

  const migrated = sanitizeReadingPositionMap(legacy)[legacyKey];
  assert.equal(migrated?.version, READING_POSITION_VERSION);
  assert.equal(migrated?.anchor.textPrefix, "ابتدای بند قدیمی");
  assert.equal(migrated?.fallbackProgress, 0.4);
});

test("an unrelated deletion and append keep the same semantic paragraph", () => {
  const targetText =
    "این بند یکتای هدف باید پس از حذف بند پیشین و افزودن پیوست در انتهای سند همان‌جا بماند.";
  const originalBlocks: ReadingFixtureBlock[] = [
    { tag: "h1", text: "کتاب" },
    { tag: "h2", text: "فصل پایدار" },
    { tag: "p", text: "بند قابل حذف" },
    { tag: "p", text: targetText },
    { tag: "p", text: "همسایهٔ پس از هدف" },
    { tag: "p", text: "دنبالهٔ سند" },
  ];
  const original = readingFixture(originalBlocks, 3 * 212 - 300);
  const snapshot = captureReadingViewport(original.context);
  assert.ok(snapshot);
  const record: ReadingPositionRecord = {
    version: READING_POSITION_VERSION,
    documentKey: "file:c:/notes/delete-append.md",
    contentSignature: "before",
    viewMode: "reading",
    ...snapshot,
    readerSize: 18,
    outlineOpen: true,
    updatedAt: 1,
  };
  const changed = readingFixture(
    [
      ...originalBlocks.filter((_, index) => index !== 2),
      { tag: "h2", text: "پیوست تازه" },
      { tag: "p", text: "این بند در انتهای سند افزوده شده است." },
    ],
    original.scrollTop(),
  );

  const result = restoreReadingViewport(changed.context, record, "after");
  const restored = captureReadingViewport(changed.context);
  assert.equal(result.match, "exact");
  assert.ok(restored);
  assert.equal(restored.anchor.textPrefix, snapshot.anchor.textPrefix);
  assert.equal(restored.anchor.headingPath.at(-1), "فصل پایدار");
});
