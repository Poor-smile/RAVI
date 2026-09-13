import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: ".",
  testMatch: ["reading-full-search.spec.ts", "r03-reading-search.spec.ts", "reading-navigation-regression.spec.ts"],
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["line"]],
  use: { channel: "chrome", baseURL: "http://127.0.0.1:3198", viewport: { width: 1180, height: 858 }, trace: "retain-on-failure" },
  webServer: { command: "node desktop/serve.mjs --port 3198", cwd: fileURLToPath(new URL("..", import.meta.url)), url: "http://127.0.0.1:3198", reuseExistingServer: false, timeout: 30_000 },
});
