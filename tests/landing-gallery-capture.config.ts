import { defineConfig } from "@playwright/test";
import { playwrightWorkerServer } from "./playwright-worker-server";

export default defineConfig({
  testDir: ".",
  testMatch: "landing-gallery-capture.spec.ts",
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  reporter: [["line"]],
  use: {
    baseURL: "http://127.0.0.1:3155",
    viewport: { width: 1600, height: 900 },
    launchOptions: {
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    },
    trace: "retain-on-failure",
  },
  webServer: playwrightWorkerServer(
    3155,
    ".wrangler/landing-gallery-capture.log",
  ),
});
