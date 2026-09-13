import { defineConfig } from "@playwright/test";
import path from "node:path";
import { playwrightWorkerServer } from "./playwright-worker-server";

// Includes every functional spec. Marketing screenshot capture is a separate task.
const output = path.resolve(process.env.RAAVI_AUDIT_DIR ?? ".artifacts/public-release-audit");
const deviceAccess = ["desktop-access.spec.ts"];
const workflow = ["release-workflow.spec.ts"];
const workspace = ["workspace-p0.spec.ts", "workspace-p1.spec.ts"];
// Preserve the 180-second contracts of performance-native/document-safety configs.
const native = ["table-focus-native.spec.ts", "desktop-document-session.spec.ts", "desktop-save-audit.spec.ts",
  "desktop-atomic-save.spec.ts", "reading-continuity-audit.spec.ts",
  "desktop-document-safety.spec.ts", "desktop-save-completion.spec.ts"];
// These run as separate required stages with their own viewport/time/server contracts.
const corrective = ["corrective-ui.spec.ts", "rem-fidelity.spec.ts", "rem-native-pdf.spec.ts",
  "reading-full-search.spec.ts", "r03-reading-search.spec.ts", "reading-navigation-regression.spec.ts"];
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
      testIgnore: [...deviceAccess, ...workflow, ...workspace, ...native, ...corrective, "landing-gallery-capture.spec.ts"],
    },
    { name: "native", testMatch: native, timeout: 180_000, expect: { timeout: 15_000 } },
    { name: "device-access", testMatch: deviceAccess, timeout: 120_000 },
    { name: "release-workflow", testMatch: workflow, use: { viewport: { width: 1280, height: 900 } }, timeout: 120_000 },
    { name: "workspace", testMatch: workspace, use: { viewport: { width: 1440, height: 1024 } }, timeout: 90_000 },
  ],
});
