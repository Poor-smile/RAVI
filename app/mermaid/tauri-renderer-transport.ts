import type { UnlistenFn } from "@tauri-apps/api/event";
import type { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type {
  MermaidRenderJob,
  MermaidRendererOutput,
  MermaidRendererTransport,
} from "./scheduler";
import { recordMermaidMeasure } from "./performance";

type RendererEnvelope = {
  rendererLabel: string;
  jobId: string;
  result: MermaidRendererOutput;
};

type PendingResult = {
  startedAt: number;
  resolve: (result: MermaidRendererOutput) => void;
  reject: (error: unknown) => void;
};

export const MERMAID_RENDER_JOB_EVENT = "raavi-mermaid-render-job";
export const MERMAID_RENDER_RESULT_EVENT = "raavi-mermaid-render-result";
export const MERMAID_RENDER_READY_EVENT = "raavi-mermaid-render-ready";

export class TauriMermaidRendererTransport
  implements MermaidRendererTransport
{
  private renderer: WebviewWindow | null = null;
  private rendererLabel = "";
  private rendererGeneration = 0;
  private resultUnlisten: UnlistenFn | null = null;
  private readyUnlisten: UnlistenFn | null = null;
  private pending = new Map<string, PendingResult>();
  private startupPromise: Promise<void> | null = null;
  private lastStartupMs = 0;
  restartCount = 0;

  async render(job: MermaidRenderJob) {
    await this.ensureRenderer();
    const { emitTo } = await import("@tauri-apps/api/event");
    return new Promise<MermaidRendererOutput>((resolve, reject) => {
      this.pending.set(job.id, {
        startedAt: performance.now(),
        resolve,
        reject,
      });
      void emitTo(this.rendererLabel, MERMAID_RENDER_JOB_EVENT, job).catch(
        (error) => {
          this.pending.delete(job.id);
          reject(error);
        },
      );
    });
  }

  async restart(reason: "timeout" | "crash" | "superseded") {
    void reason;
    this.restartCount += 1;
    const renderer = this.renderer;
    this.renderer = null;
    this.rendererLabel = "";
    this.startupPromise = null;
    // The scheduler owns the timeout/cancellation result. Clearing these
    // callbacks after destroying the WebView avoids converting timeout into
    // a second, misleading crash result.
    this.pending.clear();
    if (renderer) {
      try {
        await renderer.destroy();
      } catch {
        try {
          await renderer.close();
        } catch {
          // The crashed WebView may already have been destroyed by WebView2.
        }
      }
    }
    await this.ensureRenderer();
  }

  async dispose() {
    this.resultUnlisten?.();
    this.readyUnlisten?.();
    this.resultUnlisten = null;
    this.readyUnlisten = null;
    const renderer = this.renderer;
    this.renderer = null;
    if (renderer) await renderer.destroy().catch(() => renderer.close());
  }

  private async ensureRenderer() {
    if (this.renderer) return;
    if (this.startupPromise) return this.startupPromise;
    this.startupPromise = this.createRenderer();
    try {
      await this.startupPromise;
    } finally {
      this.startupPromise = null;
    }
  }

  private async createRenderer() {
    const startupAt = performance.now();
    const [{ listen }, { WebviewWindow }] = await Promise.all([
      import("@tauri-apps/api/event"),
      import("@tauri-apps/api/webviewWindow"),
    ]);
    if (!this.resultUnlisten) {
      this.resultUnlisten = await listen<RendererEnvelope>(
        MERMAID_RENDER_RESULT_EVENT,
        ({ payload }) => {
          if (payload.rendererLabel !== this.rendererLabel) return;
          const pending = this.pending.get(payload.jobId);
          if (!pending) return;
          this.pending.delete(payload.jobId);
          const transfer = Math.max(
            0,
            performance.now() - pending.startedAt - (payload.result.metrics.total ?? 0),
          );
          payload.result.metrics.transfer = transfer;
          recordMermaidMeasure(
            payload.jobId,
            "transfer",
            performance.now() - transfer,
            transfer,
          );
          const rendererStartup = this.lastStartupMs;
          this.lastStartupMs = 0;
          payload.result.metrics.rendererStartup =
            (payload.result.metrics.rendererStartup ?? 0) + rendererStartup;
          pending.resolve(payload.result);
        },
      );
    }

    this.rendererGeneration += 1;
    const label = `mermaid-renderer-${this.rendererGeneration}`;
    let resolveReady = () => {};
    let rejectReady: (error: Error) => void = () => {};
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const timeout = window.setTimeout(
      () => rejectReady(new Error("RAAVI_MERMAID_RENDERER_STARTUP_TIMEOUT")),
      4_000,
    );
    this.readyUnlisten = await listen<{ rendererLabel: string }>(
        MERMAID_RENDER_READY_EVENT,
        ({ payload }) => {
          if (payload.rendererLabel !== label) return;
          window.clearTimeout(timeout);
          this.readyUnlisten?.();
          this.readyUnlisten = null;
          resolveReady();
        },
      );
    const renderer = new WebviewWindow(label, {
      url: `/?raavi-mermaid-renderer=1&rendererLabel=${encodeURIComponent(label)}`,
      title: "Raavi Mermaid Renderer",
      visible: false,
      focus: false,
      decorations: false,
      skipTaskbar: true,
      width: 1,
      height: 1,
    });
    await new Promise<void>((resolve, reject) => {
      void renderer.once("tauri://created", () => resolve());
      void renderer.once<string>("tauri://error", ({ payload }) =>
        reject(new Error(payload)),
      );
    });
    this.renderer = renderer;
    this.rendererLabel = label;
    await ready;
    this.lastStartupMs = performance.now() - startupAt;
    recordMermaidMeasure(label, "rendererStartup", startupAt, this.lastStartupMs);
  }
}
