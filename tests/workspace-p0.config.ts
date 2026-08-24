import { defineConfig } from "@playwright/test";
import { playwrightWorkerServer } from "./playwright-worker-server";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: ".",
  testMatch: ["workspace-p0.spec.ts"],
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["line"]],
  use: {
    baseURL: externalBaseURL ?? "http://127.0.0.1:3152",
    viewport: { width: 1440, height: 1024 },
    trace: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : playwrightWorkerServer(3152, ".wrangler/workspace-p0.log"),
});
