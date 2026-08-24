import { defineConfig } from "@playwright/test";
import { playwrightWorkerServer } from "./tests/playwright-worker-server";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests",
  testMatch: [
    "ai-chat.spec.ts",
    "export-flow.spec.ts",
    "identity-baseline.spec.ts",
    "keyboard-shortcuts.spec.ts",
    "mermaid-persian-studio.spec.ts",
    "mermaid-stability.spec.ts",
    "mermaid-ultimate-stress.spec.ts",
    "p21-graph-studio.spec.ts",
    "persian-ai-review.spec.ts",
  ],
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 7_000,
  },
  reporter: [["line"]],
  use: {
    baseURL: externalBaseURL ?? "http://127.0.0.1:3137",
    trace: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : playwrightWorkerServer(3137, ".wrangler/playwright-gate.log"),
});
