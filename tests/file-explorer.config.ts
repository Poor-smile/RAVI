import { defineConfig } from "@playwright/test";
import { playwrightWorkerServer } from "./playwright-worker-server";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: ".",
  testMatch: ["file-explorer.spec.ts"],
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["line"]],
  use: {
    baseURL: externalBaseURL ?? "http://127.0.0.1:3138",
    trace: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : playwrightWorkerServer(3138, ".wrangler/file-explorer.log"),
});
