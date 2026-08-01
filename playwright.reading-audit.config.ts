import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["reading-continuity-audit.spec.ts"],
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["line"]],
  use: {
    trace: "retain-on-failure",
  },
});
