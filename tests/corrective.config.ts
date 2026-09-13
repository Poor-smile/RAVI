import { defineConfig } from "@playwright/test";
import { playwrightWorkerServer } from "./playwright-worker-server";
export default defineConfig({ testDir: ".", testMatch: "corrective-ui.spec.ts", workers: 1, timeout: 60000,
  expect: { timeout: 10000 }, reporter: [["line"]], outputDir: "../outputs/corrective-2026-09-12/ui",
  use: { channel: "chrome", baseURL: "http://127.0.0.1:3148", viewport: { width: 1366, height: 900 }, trace: "retain-on-failure" },
  webServer: playwrightWorkerServer(3148, ".wrangler/corrective.log") });
