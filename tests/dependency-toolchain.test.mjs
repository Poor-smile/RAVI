import assert from "node:assert/strict";
import test from "node:test";
import { transform, transformSync } from "@esbuild-kit/core-utils";

test("Drizzle's legacy TS loader works with its patched esbuild override", async () => {
  const source = "const value: number = 6 * 7; export { value };";
  const sync = transformSync(source, "dependency-probe.ts");
  const compiledModule = { exports: {} };
  new Function("module", "exports", sync.code)(compiledModule, compiledModule.exports);
  assert.equal(compiledModule.exports.value, 42);
  const asyncResult = await transform(source, "dependency-probe.ts");
  const loaded = await import(`data:text/javascript;base64,${Buffer.from(asyncResult.code).toString("base64")}`);
  assert.equal(loaded.value, 42);
});
