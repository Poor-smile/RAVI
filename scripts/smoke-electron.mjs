import { spawnSync } from "node:child_process";
import path from "node:path";

const output = path.join(
  ".artifacts",
  `electron-smoke-${process.env.npm_package_version ?? "dev"}-${process.pid}-${Date.now()}`,
);
const cli = path.join(
  process.cwd(),
  "node_modules",
  "electron-builder",
  "out",
  "cli",
  "cli.js",
);

console.log(`Electron smoke output: ${output}`);
const result = spawnSync(
  process.execPath,
  [
    cli,
    "--win",
    "dir",
    "--x64",
    "--publish",
    "never",
    `--config.directories.output=${output}`,
    "--config.electronDist=node_modules/electron/dist",
  ],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
