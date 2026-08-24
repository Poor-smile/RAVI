import assert from "node:assert/strict";
import test from "node:test";
import {
  markdownWithEmbeddedRaaviImages,
  makeRaaviDocument,
  parseRaaviDocument,
  raaviImageAssetId,
  raaviImageDataUrl,
  raaviImageUrl,
} from "../app/raavi";

const imageAsset = {
  id: "image-001",
  name: "sample.png",
  mimeType: "image/png" as const,
  data: "iVBORw0KGgo=",
  width: 640,
  height: 360,
};

test("Raavi packages inserted image assets with the document", () => {
  const source = `![نمونه](${raaviImageUrl(imageAsset.id)})`;
  const document = makeRaaviDocument(
    "sample.md",
    source,
    [],
    2,
    [],
    [imageAsset],
  );
  const parsed = parseRaaviDocument(JSON.stringify(document));

  assert.deepEqual(parsed.assets, [imageAsset]);
  assert.equal(
    raaviImageAssetId(source.match(/\(([^)]+)\)/)?.[1] ?? ""),
    imageAsset.id,
  );
  assert.equal(
    markdownWithEmbeddedRaaviImages(source, parsed.assets),
    `![نمونه](${raaviImageDataUrl(imageAsset)})`,
  );
});

test("Raavi ignores unsafe or unsupported image payloads", () => {
  const document = makeRaaviDocument(
    "sample.md",
    "",
    [],
    1,
    [],
    [{ ...imageAsset, id: "unsafe-image", mimeType: "image/svg+xml" as never }],
  );
  const parsed = parseRaaviDocument(JSON.stringify(document));
  assert.deepEqual(parsed.assets, []);
});

test("Raavi preserves valid image geometry and drops invalid geometry", () => {
  const valid = parseRaaviDocument(
    JSON.stringify(makeRaaviDocument("sample.md", "", [], 1, [], [imageAsset])),
  );
  const invalid = parseRaaviDocument(
    JSON.stringify(
      makeRaaviDocument(
        "sample.md",
        "",
        [],
        1,
        [],
        [{ ...imageAsset, width: -1, height: 999_999 }],
      ),
    ),
  );

  assert.equal(valid.assets[0]?.width, 640);
  assert.equal(valid.assets[0]?.height, 360);
  assert.equal(invalid.assets[0]?.width, undefined);
  assert.equal(invalid.assets[0]?.height, undefined);
});

test("Raavi preserves version provenance and ignores unknown kinds", () => {
  const document = makeRaaviDocument("sample.md", "نسخهٔ فعلی", [], 3, [
    {
      number: 2,
      savedAt: "2026-08-21T08:00:00.000Z",
      content: "نسخهٔ خودکار",
      annotations: [],
      kind: "autosave",
    },
    {
      number: 3,
      savedAt: "2026-08-21T08:05:00.000Z",
      content: "نسخهٔ دستی",
      annotations: [],
      kind: "manual",
    },
    {
      number: 4,
      savedAt: "2026-08-21T08:06:00.000Z",
      content: "پیش از تغییر هوشمند",
      annotations: [],
      kind: "ai",
    },
  ]);
  const parsed = parseRaaviDocument(JSON.stringify(document));
  const withUnknownKind = parseRaaviDocument(
    JSON.stringify({
      ...document,
      versions: [{ ...document.versions[0], kind: "remote" }],
    }),
  );

  assert.deepEqual(
    parsed.versions.map((version) => version.kind),
    ["autosave", "manual", "ai"],
  );
  assert.equal(withUnknownKind.versions[0]?.kind, undefined);
});

test("legacy margin annotations migrate locally to comments", () => {
  const parsed = parseRaaviDocument(
    JSON.stringify({
      ...makeRaaviDocument("legacy.ravi", "متن قدیمی", [], 1, []),
      annotations: [
        {
          id: "legacy-margin",
          kind: "margin",
          start: 0,
          end: 3,
          quote: "متن",
          body: "یادداشت قدیمی",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    }),
  );

  assert.equal(parsed.annotations.length, 1);
  assert.equal(parsed.annotations[0]?.kind, "comment");
  assert.equal(parsed.annotations[0]?.body, "یادداشت قدیمی");
});
