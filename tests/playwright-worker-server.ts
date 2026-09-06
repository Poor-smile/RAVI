import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function playwrightWorkerServer(port: number, logPath: string) {
  const serverEnvironment = { ...process.env };
  if (serverEnvironment.FORCE_COLOR !== undefined) {
    delete serverEnvironment.NO_COLOR;
  }
  return {
    command: `node scripts/start-playwright-worker.mjs --port ${port}`,
    cwd: projectRoot,
    env: {
      ...serverEnvironment,
      WRANGLER_LOG_PATH: logPath,
    },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
    timeout: 240_000,
  } as const;
}
