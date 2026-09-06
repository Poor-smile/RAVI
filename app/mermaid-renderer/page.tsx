"use client";

import { useEffect } from "react";
import { renderMermaidInCurrentContext } from "../mermaid/renderer";
import type { MermaidRenderJob, MermaidRendererOutput } from "../mermaid/scheduler";

declare global {
  interface Window {
    raaviMermaidHost?: {
      ready: () => void;
      onJob: (callback: (job: MermaidRenderJob) => void) => () => void;
      result: (jobId: string, output: MermaidRendererOutput) => void;
    };
  }
}

// A dedicated route avoids mounting document state, desktop adapters or the UI.
export default function ElectronMermaidRendererHost() {
  useEffect(() => {
    const bridge = window.raaviMermaidHost;
    if (!bridge) return;
    let disposed = false;
    const remove = bridge.onJob(async (job) => {
      try {
        document.documentElement.dataset.theme = job.theme;
        const result = await renderMermaidInCurrentContext(job.code, job.theme);
        if (disposed) return;
        bridge.result(job.id, result.ok ? {
          ok: true, svg: result.svg, complexity: result.complexity, metrics: result.metrics,
        } : { ok: false, error: result.error, metrics: result.metrics ?? {} });
      } catch (error) {
        if (!disposed) bridge.result(job.id, {
          ok: false,
          error: { kind: "renderer-crash", message: "موتور نمودار نیاز به راه‌اندازی دوباره دارد.", technical: String(error) },
          metrics: {},
        });
      }
    });
    bridge.ready();
    return () => { disposed = true; remove(); };
  }, []);
  return <main aria-label="موتور ایزولهٔ رندر نمودار" />;
}
