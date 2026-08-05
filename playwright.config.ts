import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: [
    "export-flow.spec.ts",
    "keyboard-shortcuts.spec.ts",
    "mermaid-persian-studio.spec.ts",
    "mermaid-stability.spec.ts",
    "mermaid-ultimate-stress.spec.ts",
  ],
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
