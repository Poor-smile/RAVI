import { defineConfig } from "@playwright/test";
import path from "node:path";
import { playwrightWorkerServer } from "./playwright-worker-server";

export default defineConfig({
  testDir: ".",
  testMatch: ["reading-listen.spec.ts"],
  workers: 1,
  timeout: 45_000,
  reporter: [["line"]],
  use: {
    baseURL: "http://127.0.0.1:3158",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: path.join(
        process.env.LOCALAPPDATA ?? "",
        "ms-playwright",
        "chromium-1234",
        "chrome-win64",
        "chrome.exe",
      ),
    },
  },
  webServer: playwrightWorkerServer(3158, ".wrangler/reading-listen.log"),
});
