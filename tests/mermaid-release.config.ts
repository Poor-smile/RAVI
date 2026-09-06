import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["mermaid-isolation.spec.ts", "mermaid-stability.spec.ts", "mermaid-ultimate-stress.spec.ts", "desktop-security.spec.ts"],
  workers: 1, retries: 0, forbidOnly: true, updateSnapshots: "none",
  timeout: 90_000,
  outputDir: process.env.RAAVI_AUDIT_DIR ? `${process.env.RAAVI_AUDIT_DIR}/mermaid-traces` : "../.artifacts/mermaid-traces",
  reporter: [["line"], ["json", { outputFile: `${process.env.RAAVI_AUDIT_DIR ?? "../.artifacts"}/mermaid-browser-results.json` }]],
  use: { trace: "retain-on-failure" },
});
