import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig({
  testDir: ".",
  testMatch: ["mobile-back-stack.spec.ts", "mobile-layout-regression.spec.ts"],
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["line"]],
  use: {
    baseURL: externalBaseURL ?? "http://127.0.0.1:3137",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command:
          "node node_modules/vinext/dist/cli.js dev --hostname 127.0.0.1 --port 3137",
        cwd: projectRoot,
        env: {
          ...process.env,
          WRANGLER_LOG_PATH: ".wrangler/mobile-back-stack.log",
        },
        url: "http://127.0.0.1:3137",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
