import { BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isTrustedIpcSender } from "./ipc-security.mjs";

const preload = fileURLToPath(new URL("./mermaid-preload.cjs", import.meta.url));
const route = "/mermaid-renderer";
const timeoutMs = 5_000;
const failure = (kind, technical) => ({
  ok: false, metrics: {},
  error: { kind, message: kind === "timeout" ? "رندر نمودار بیش از حد طول کشید و متوقف شد." : "رندر نمودار متوقف شد؛ دوباره تلاش کنید.", technical },
});

export function createElectronMermaidRenderer(getContext) {
  let renderer = null;
  let ready = false;
  let pending = null;
  let generation = 0;
  let disposed = false;

  function trusted(event) {
    return isTrustedIpcSender(event, { window: renderer, origin: getContext().origin }) &&
      new URL(event.senderFrame.url).pathname === route;
  }

  function complete(output) {
    const task = pending;
    pending = null;
    if (!task) return;
    clearTimeout(task.timer);
    task.resolve(output);
  }

  function stop(kind, detail) {
    const previous = renderer;
    renderer = null;
    ready = false;
    generation += 1;
    complete(failure(kind, detail));
    if (previous && !previous.isDestroyed()) {
      // Separate session partitions prevent process reuse with the main window.
      // Still check the OS PID before terminating a process, as defense in depth.
      const main = getContext().window;
      const pid = previous.webContents.getOSProcessId();
      if (pid && main && !main.isDestroyed() && pid !== main.webContents.getOSProcessId()) {
        previous.webContents.forcefullyCrashRenderer();
      }
      previous.destroy();
    }
  }

  function sendJob() {
    if (pending && ready && renderer && !renderer.isDestroyed()) {
      renderer.webContents.send("mermaid:job", pending.job);
    }
  }

  const onReady = (event) => {
    if (!trusted(event) || ready) return;
    const main = getContext().window;
    if (!main || renderer.webContents.getOSProcessId() === main.webContents.getOSProcessId()) {
      stop("renderer-crash", "Diagram renderer must have its own OS process.");
      return;
    }
    ready = true;
    sendJob();
  };
  const onResult = (event, jobId, result) => {
    if (!trusted(event) || !pending || jobId !== pending.job.id) return;
    if (!result || typeof result.ok !== "boolean" || !result.metrics ||
        (result.ok && (typeof result.svg !== "string" || result.svg.length > 16 * 1024 * 1024 || !result.complexity)) ||
        (!result.ok && typeof result.error?.kind !== "string")) {
      stop("renderer-crash", "Invalid diagram renderer response.");
      return;
    }
    complete(result);
  };
  ipcMain.on("mermaid:ready", onReady);
  ipcMain.on("mermaid:result", onResult);

  function createWindow() {
    const { origin } = getContext();
    const currentGeneration = generation;
    const window = new BrowserWindow({
      show: false, width: 1600, height: 1000, skipTaskbar: true,
      title: "Raavi Mermaid Renderer",
      webPreferences: {
        preload: path.resolve(preload),
        partition: "raavi-mermaid-renderer",
        contextIsolation: true, nodeIntegration: false, sandbox: true,
        webSecurity: true, backgroundThrottling: false,
      },
    });
    renderer = window;
    const session = window.webContents.session;
    session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.setPermissionCheckHandler(() => false);
    session.webRequest.onBeforeRequest((details, callback) => {
      // Diagrams may load bundled code and fonts, never remote content.
      callback({ cancel: new URL(details.url).origin !== origin });
    });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event) => event.preventDefault());
    window.webContents.on("will-redirect", (event) => event.preventDefault());
    window.webContents.on("render-process-gone", (_event, details) => {
      if (renderer === window) stop("renderer-crash", `Diagram process ended: ${details.reason}`);
    });
    window.on("closed", () => {
      if (renderer === window) stop("renderer-crash", "Diagram window closed.");
    });
    void window.loadURL(`${origin}${route}`).catch((error) => {
      if (generation === currentGeneration && renderer === window) stop("renderer-crash", String(error));
    });
  }

  return {
    render(_event, job) {
      if (disposed) return failure("renderer-crash", "Diagram renderer disposed.");
      if (!job || typeof job.id !== "string" || job.id.length > 200 ||
          typeof job.code !== "string" || job.code.length > 40_000 || job.code.split("\n").length > 1_000 ||
          !["light", "dark"].includes(job.theme)) {
        return failure("limit", "Invalid or oversized diagram request.");
      }
      if (pending) return failure("limit", "A diagram is already rendering.");
      return new Promise((resolve) => {
        pending = { job, resolve, timer: setTimeout(() => stop("timeout", "Diagram process exceeded 5000 ms."), timeoutMs) };
        try {
          if (renderer && ready) sendJob();
          else if (!renderer) createWindow();
        } catch (error) { stop("renderer-crash", String(error)); }
      });
    },
    restart(_event, reason) {
      stop(reason === "timeout" ? "timeout" : "cancelled", `Diagram renderer restarted: ${String(reason)}`);
    },
    dispose() {
      disposed = true;
      stop("cancelled", "Document window closed.");
      ipcMain.removeListener("mermaid:ready", onReady);
      ipcMain.removeListener("mermaid:result", onResult);
    },
  };
}
