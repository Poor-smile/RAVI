import { MermaidMemoryCache } from "./cache";
import { estimateMermaidComplexity } from "./complexity";
import {
  MERMAID_LIMITS,
  mermaidLimitError,
  mermaidRenderKey,
  renderMermaidInCurrentContext,
  type MermaidRenderResult,
  type MermaidTheme,
} from "./renderer";
import {
  MermaidRenderScheduler,
  type MermaidRenderJob,
  type MermaidRendererTransport,
  type MermaidRenderPriority,
} from "./scheduler";

export type MermaidRenderRequestOptions = {
  documentId?: string;
  blockId?: string;
  priority?: MermaidRenderPriority;
  generation?: number;
  force?: boolean;
  bypassCache?: boolean;
};

class LocalMermaidRendererTransport implements MermaidRendererTransport {
  async render(job: MermaidRenderJob) {
    const result = await renderMermaidInCurrentContext(
      job.code,
      job.theme,
      job.complexity,
    );
    if (result.ok) {
      return {
        ok: true as const,
        svg: result.svg,
        complexity: result.complexity,
        metrics: result.metrics,
      };
    }
    return {
      ok: false as const,
      error: result.error,
      metrics: result.metrics ?? {},
    };
  }

  async restart() {
    // Browser fallback cannot terminate Mermaid's synchronous DOM work. The
    // Tauri build always selects the restartable WebView transport below.
  }
}

class RuntimeMermaidRendererTransport implements MermaidRendererTransport {
  private transport: MermaidRendererTransport | null = null;
  restartCount = 0;

  async render(job: MermaidRenderJob) {
    return (await this.getTransport()).render(job);
  }

  async restart(reason: "timeout" | "crash" | "superseded") {
    this.restartCount += 1;
    return (await this.getTransport()).restart(reason);
  }

  async dispose() {
    await this.transport?.dispose?.();
  }

  private async getTransport() {
    if (this.transport) return this.transport;
    if (typeof window !== "undefined" && window.raaviMermaid) {
      const { ElectronMermaidRendererTransport } = await import("./electron-renderer-transport");
      this.transport = new ElectronMermaidRendererTransport(window.raaviMermaid);
      return this.transport;
    }
    const isTauri =
      typeof window !== "undefined" &&
      "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>);
    if (isTauri) {
      const { TauriMermaidRendererTransport } = await import(
        "./tauri-renderer-transport"
      );
      this.transport = new TauriMermaidRendererTransport();
    } else this.transport = new LocalMermaidRendererTransport();
    return this.transport;
  }
}

const cache = new MermaidMemoryCache();
const transport = new RuntimeMermaidRendererTransport();
const scheduler = new MermaidRenderScheduler(
  transport,
  MERMAID_LIMITS.renderTimeoutMs,
);
const generations = new Map<string, number>();
let jobSequence = 0;

function nextGeneration(documentId: string, blockId: string) {
  const key = `${documentId}:${blockId}`;
  const generation = (generations.get(key) ?? 0) + 1;
  generations.set(key, generation);
  return generation;
}

function publishDebug(last?: {
  key: string;
  result: MermaidRenderResult;
}) {
  if (
    typeof window === "undefined" ||
    (typeof process !== "undefined" && process.env.NODE_ENV === "production")
  ) {
    return;
  }
  (window as unknown as Record<string, unknown>).__RAAVI_MERMAID_DEBUG__ = {
    cache: cache.stats(),
    restartCount: transport.restartCount,
    last,
  };
}

export async function scheduleMermaidRender(
  code: string,
  theme: MermaidTheme,
  options: MermaidRenderRequestOptions = {},
): Promise<MermaidRenderResult> {
  const complexity = estimateMermaidComplexity(code);
  const limited = mermaidLimitError(code);
  if (limited) return { ok: false, error: limited, complexity, metrics: {} };
  if (complexity.level === "extreme" && !options.force) {
    return {
      ok: false,
      complexity,
      metrics: {},
      error: {
        kind: "limit",
        message: "پیش‌نمایش خودکار این نمودار سنگین متوقف شد.",
        technical: `امتیاز پیچیدگی ${complexity.score.toLocaleString("fa-IR")} است.`,
        suggestion:
          "آخرین خروجی سالم حفظ شده است؛ برای ادامه از دکمهٔ «رندر کامل» استفاده کنید.",
      },
    };
  }

  const key = mermaidRenderKey(code, theme);
  if (!options.bypassCache) {
    const cached = cache.get(key);
    if (cached) {
      const result: MermaidRenderResult = {
        ok: true,
        svg: cached.svg,
        fromCache: true,
        complexity: cached.complexity,
        metrics: { total: 0 },
      };
      publishDebug({ key, result });
      return result;
    }
  }

  const documentId = options.documentId ?? "raavi-document";
  const blockId = options.blockId ?? key;
  const generation =
    options.generation ?? nextGeneration(documentId, blockId);
  const job: MermaidRenderJob = {
    id: `mermaid-${++jobSequence}`,
    documentId,
    blockId,
    code,
    theme,
    priority: options.priority ?? "visible",
    generation,
    complexity,
  };
  const output = await scheduler.schedule(job, key);
  output.metrics.total = [
    output.metrics.queueWait,
    output.metrics.rendererStartup,
    output.metrics.parse,
    output.metrics.layoutRender,
    output.metrics.sanitize,
    output.metrics.transfer,
  ].reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const result: MermaidRenderResult = output.ok
    ? {
        ok: true,
        svg: output.svg,
        fromCache: false,
        complexity: output.complexity,
        metrics: output.metrics,
      }
    : {
        ok: false,
        error: output.error,
        complexity,
        metrics: output.metrics,
      };
  if (result.ok) cache.set(key, result.svg, result.complexity);
  publishDebug({ key, result });
  return result;
}

export function getCachedMermaidRender(code: string, theme: MermaidTheme) {
  return cache.get(mermaidRenderKey(code, theme));
}

export function pinMermaidRender(key: string) {
  cache.pin(key);
  publishDebug();
}

export function unpinMermaidRender(key: string) {
  cache.unpin(key);
  publishDebug();
}

export function getMermaidRenderDebugStats() {
  return { cache: cache.stats(), restartCount: transport.restartCount };
}
