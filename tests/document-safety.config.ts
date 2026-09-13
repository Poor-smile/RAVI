import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["desktop-document-safety.spec.ts", "desktop-save-completion.spec.ts"],
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [["line"]],
  outputDir: "../outputs/corrective-2026-09-06/test-results",
  use: { trace: "retain-on-failure" },
});
