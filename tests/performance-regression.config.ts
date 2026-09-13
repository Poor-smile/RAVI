import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
  testDir: ".",
  testMatch: ["performance-integrity.spec.ts", "reading-full-search.spec.ts", "reading-navigation-regression.spec.ts", "r03-reading-search.spec.ts", "r04-reading-outline.spec.ts", "r05-reading-highlights.spec.ts", "r06-reading-comments.spec.ts", "r08-reading-selection.spec.ts", "editor-kb-release.spec.ts", "desktop-save-audit.spec.ts", "desktop-atomic-save.spec.ts"],
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["line"]],
  use: { channel: "chrome", baseURL: "http://127.0.0.1:3198", viewport: { width: 1440, height: 900 }, trace: "retain-on-failure" },
  webServer: { command: "node desktop/serve.mjs --port 3198", cwd: fileURLToPath(new URL("..", import.meta.url)), url: "http://127.0.0.1:3198", reuseExistingServer: false, timeout: 30_000 },
});
