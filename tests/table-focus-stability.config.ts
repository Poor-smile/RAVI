import { defineConfig } from "@playwright/test";
import { playwrightWorkerServer } from "./playwright-worker-server";
export default defineConfig({
  testDir: ".", testMatch: ["table-focus-stability.spec.ts", "rich-blocks.spec.ts"],
  workers: 1, timeout: 60_000, expect: { timeout: 10_000 }, reporter: [["line"]],
  use: { channel: "chrome", baseURL: "http://127.0.0.1:3153", viewport: { width: 1440, height: 900 }, trace: "retain-on-failure" },
  webServer: playwrightWorkerServer(3153, ".wrangler/table-focus.log"),
});
