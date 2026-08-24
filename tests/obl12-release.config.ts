import { defineConfig } from "@playwright/test";
import { playwrightWorkerServer } from "./playwright-worker-server";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: ".",
  testMatch: ["release-workflow.spec.ts"],
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["line"]],
  use: {
    baseURL: externalBaseURL ?? "http://127.0.0.1:3144",
    viewport: { width: 375, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : playwrightWorkerServer(3144, ".wrangler/obl12-release.log"),
});
