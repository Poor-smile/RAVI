import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["file-explorer-desktop.spec.ts"],
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  reporter: [["line"]],
  use: { trace: "retain-on-failure" },
});
