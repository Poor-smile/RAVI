import { defineConfig } from "@playwright/test";
import { playwrightWorkerServer } from "./playwright-worker-server";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: ".",
  testMatch: ["command-palette.spec.ts"],
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["line"]],
  use: {
    baseURL: externalBaseURL ?? "http://127.0.0.1:3141",
    trace: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : playwrightWorkerServer(3141, ".wrangler/command-palette.log"),
});
