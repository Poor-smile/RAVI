import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "dist-tauri/**",
    "release/**",
    "release-pruned/**",
    "release-*/**",
    ".tmp*/**",
    "artifacts/**",
    "outputs/**",
    "landing/assets/vendor/**",
    ".deploy-*/**",
    ".artifacts/**",
    "test-results/**",
    "tmp/**",
    "work/**",
    "src-tauri/target/**",
    ".wrangler/**",
    ".vinext/**",
    ".qa-library/**",
    ".tmp-video-audit/**",
    ".codex-video-review/**",
    ".codex-release-stage-*/**",
    ".codex-temp/**",
    ".tmp-figma/**",
    "electron-dist-*/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
