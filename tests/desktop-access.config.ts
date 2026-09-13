import { defineConfig } from "@playwright/test";
import path from "node:path";
import { playwrightWorkerServer } from "./playwright-worker-server";

export default defineConfig({
  testDir: ".",
  testMatch: ["desktop-access.spec.ts", "about-entry-points.spec.ts", "release-workflow.spec.ts"],
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: "../outputs/desktop-only/browser",
  reporter: [["line"], ["json", { outputFile: path.resolve("outputs/desktop-only/browser-results.json") }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3137",
    channel: process.env.RAAVI_TEST_BROWSER_CHANNEL,
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : playwrightWorkerServer(3137, ".wrangler/desktop-access.log"),
});
