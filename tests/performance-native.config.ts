import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".", testMatch: ["desktop-document-session.spec.ts", "desktop-save-audit.spec.ts", "desktop-atomic-save.spec.ts", "reading-continuity-audit.spec.ts"], workers: 1,
  timeout: 180_000, expect: { timeout: 15_000 }, reporter: [["line"]],
  use: { trace: "retain-on-failure" },
});
