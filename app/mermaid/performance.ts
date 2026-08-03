import type { MermaidRenderMetrics } from "./renderer";

export type MermaidPerformancePhase = keyof MermaidRenderMetrics;

export function recordMermaidMeasure(
  traceId: string,
  phase: MermaidPerformancePhase,
  startedAt: number,
  duration = performance.now() - startedAt,
) {
  if (typeof performance === "undefined" || typeof performance.mark !== "function") return;
  const prefix = `raavi-mermaid:${traceId}:${phase}`;
  try {
    performance.mark(`${prefix}:start`, { startTime: startedAt });
    performance.mark(`${prefix}:end`, { startTime: startedAt + duration });
    performance.measure(prefix, `${prefix}:start`, `${prefix}:end`);
  } catch {
    // Metrics must never interfere with rendering on older WebViews.
  }
}
