import { defineConfig } from "@playwright/test";
import path from "node:path";
import { playwrightWorkerServer } from "./playwright-worker-server";

// Includes every functional spec. Marketing screenshot capture is a separate task.
const output = path.resolve(process.env.RAAVI_AUDIT_DIR ?? ".artifacts/public-release-audit");
const mobile = ["mobile-back-stack.spec.ts", "mobile-layout-regression.spec.ts"];
const workflow = ["release-workflow.spec.ts"];
const workspace = ["workspace-p0.spec.ts", "workspace-p1.spec.ts"];
export default defineConfig({
  testDir: ".",
  outputDir: `${output}/browser-results`,
  updateSnapshots: "none",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{platform}{ext}",
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["line"], ["json", { outputFile: `${output}/browser-results.json` }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3176",
    channel: process.env.RAAVI_TEST_BROWSER_CHANNEL,
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined :
    playwrightWorkerServer(3176, ".wrangler/public-release-audit.log"),
  projects: [
    {
      name: "product",
      testMatch: "*.spec.ts",
      testIgnore: [...mobile, ...workflow, ...workspace, "landing-gallery-capture.spec.ts"],
    },
    { name: "mobile", testMatch: mobile, use: { viewport: { width: 390, height: 844 } }, timeout: 120_000 },
    { name: "release-workflow", testMatch: workflow, use: { viewport: { width: 375, height: 844 } }, timeout: 120_000 },
    { name: "workspace", testMatch: workspace, use: { viewport: { width: 1440, height: 1024 } }, timeout: 90_000 },
  ],
});
