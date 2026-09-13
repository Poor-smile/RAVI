import { parentPort } from "node:worker_threads";

parentPort.on("message", async ({ id, task, payload }) => {
  try {
    let value;
    switch (task) {
      case "codex-status": {
        const { getCodexConnectionStatus } = await import("./codex-cli.mjs");
        value = await getCodexConnectionStatus();
        break;
      }
      case "windows-replacement": {
        const { createWindowsReplacement } = await import("./windows-save-permissions.mjs");
        value = await createWindowsReplacement(payload.source, payload.temporary);
        break;
      }
      default: throw new Error("Unknown native task.");
    }
    parentPort.postMessage({ id, value });
  } catch (error) {
    parentPort.postMessage({ id, error: { message: error.message, code: error.code } });
  }
});
