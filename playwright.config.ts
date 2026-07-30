import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "keyboard-shortcuts.spec.ts",
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 7_000,
  },
  reporter: [["line"]],
  use: {
    trace: "retain-on-failure",
  },
});
