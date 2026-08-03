"use client";

import { useEffect } from "react";
import { renderMermaidInCurrentContext } from "../mermaid/renderer";
import type { MermaidRenderJob } from "../mermaid/scheduler";
import {
  MERMAID_RENDER_JOB_EVENT,
  MERMAID_RENDER_READY_EVENT,
  MERMAID_RENDER_RESULT_EVENT,
} from "../mermaid/tauri-renderer-transport";

export function MermaidRendererHost() {
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const rendererLabel =
      new URLSearchParams(window.location.search).get("rendererLabel") ?? "";

    void Promise.all([
      import("@tauri-apps/api/event"),
      import("@tauri-apps/api/webviewWindow"),
    ]).then(async ([{ emitTo, listen }, { getCurrentWebviewWindow }]) => {
      const currentLabel = getCurrentWebviewWindow().label || rendererLabel;
      unlisten = await listen<MermaidRenderJob>(
        MERMAID_RENDER_JOB_EVENT,
        async ({ payload: job }) => {
          try {
            const result = await renderMermaidInCurrentContext(
              job.code,
              job.theme,
              job.complexity,
            );
            if (disposed) return;
            const output = result.ok
              ? {
                  ok: true as const,
                  svg: result.svg,
                  complexity: result.complexity,
                  metrics: result.metrics,
                }
              : {
                  ok: false as const,
                  error: result.error,
                  metrics: result.metrics ?? {},
                };
            await emitTo("main", MERMAID_RENDER_RESULT_EVENT, {
              rendererLabel: currentLabel,
              jobId: job.id,
              result: output,
            });
          } catch (error) {
            if (disposed) return;
            await emitTo("main", MERMAID_RENDER_RESULT_EVENT, {
              rendererLabel: currentLabel,
              jobId: job.id,
              result: {
                ok: false,
                error: {
                  kind: "renderer-crash",
                  message: "موتور نمودار نیاز به راه‌اندازی دوباره دارد.",
                  technical:
                    error instanceof Error ? error.message : String(error),
                },
                metrics: {},
              },
            });
          }
        },
      );
      await emitTo("main", MERMAID_RENDER_READY_EVENT, {
        rendererLabel: currentLabel,
      });
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return <main aria-label="موتور ایزولهٔ رندر نمودار" />;
}
