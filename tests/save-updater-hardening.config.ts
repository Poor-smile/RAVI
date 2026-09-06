import { defineConfig } from "@playwright/test";
import path from "node:path";

const output = path.resolve(process.env.RAAVI_AUDIT_DIR ?? ".artifacts/save-updater-hardening");
export default defineConfig({
  testDir: ".",
  testMatch: ["desktop-atomic-save.spec.ts", "desktop-save-audit.spec.ts", "desktop-security.spec.ts"],
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 90_000,
  outputDir: path.join(output, "desktop-results"),
  reporter: [["line"], ["json", { outputFile: path.join(output, "desktop-results.json") }]],
  use: { trace: "retain-on-failure" },
});
