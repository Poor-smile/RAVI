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
