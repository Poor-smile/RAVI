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
  assert.equal(raaviImageAssetId(source.match(/\(([^)]+)\)/)?.[1] ?? ""), imageAsset.id);
  assert.equal(
    markdownWithEmbeddedRaaviImages(source, parsed.assets),
    `![نمونه](${raaviImageDataUrl(imageAsset)})`,
  );
});

test("Raavi ignores unsafe or unsupported image payloads", () => {
  const document = makeRaaviDocument("sample.md", "", [], 1, [], [
    { ...imageAsset, id: "unsafe-image", mimeType: "image/svg+xml" as never },
  ]);
  const parsed = parseRaaviDocument(JSON.stringify(document));
  assert.deepEqual(parsed.assets, []);
});

test("Raavi preserves valid image geometry and drops invalid geometry", () => {
  const valid = parseRaaviDocument(
    JSON.stringify(makeRaaviDocument("sample.md", "", [], 1, [], [imageAsset])),
  );
  const invalid = parseRaaviDocument(
    JSON.stringify(
      makeRaaviDocument("sample.md", "", [], 1, [], [
        { ...imageAsset, width: -1, height: 999_999 },
      ]),
    ),
  );

  assert.equal(valid.assets[0]?.width, 640);
  assert.equal(valid.assets[0]?.height, 360);
  assert.equal(invalid.assets[0]?.width, undefined);
  assert.equal(invalid.assets[0]?.height, undefined);
});
