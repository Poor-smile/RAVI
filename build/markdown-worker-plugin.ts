import { createRequire } from "node:module";
import type { Plugin } from "vite";

const require = createRequire(import.meta.url);

export function markdownWorkerPlugin(): Plugin {
  return {
    name: "markdown-worker-entities",
    enforce: "pre",
    resolveId(id) {
      // The browser export uses document.createElement. Workers need the
      // package's pure JavaScript default export, also used by its worker export.
      if (id === "decode-named-character-reference") return require.resolve(id);
    },
  };
}
