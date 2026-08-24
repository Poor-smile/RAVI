import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { MATERIAL_SYMBOL_PATHS } from "../app/icons/material-symbol-paths";
import { MATERIAL_SYMBOL_NAMES } from "../app/icons/material-symbols";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(target);
      return /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
    }),
  );
  return nested.flat();
}

test("every Ravi icon maps to outlined and filled Material Symbol vectors", () => {
  for (const [legacyName, symbol] of Object.entries(MATERIAL_SYMBOL_NAMES)) {
    const vector = MATERIAL_SYMBOL_PATHS[symbol];
    assert.ok(vector, `${legacyName} must map to an existing Material Symbol`);
    assert.match(vector.viewBox, /^0 -960 960 960$/);
    assert.ok(vector.outline.length > 0, `${symbol} needs an outlined path`);
    assert.ok(vector.filled.length > 0, `${symbol} needs a filled path`);
  }
});

test("application source no longer imports Lucide", async () => {
  const files = await sourceFiles(path.resolve("app"));
  const offenders: string[] = [];

  for (const file of files) {
    if ((await readFile(file, "utf8")).includes("lucide-react")) {
      offenders.push(path.relative(process.cwd(), file));
    }
  }

  assert.deepEqual(offenders, []);
});
