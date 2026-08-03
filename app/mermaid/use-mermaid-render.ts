"use client";

import { useEffect, useRef, useState } from "react";
import { createMermaidBlobUrl } from "./blob-url";
import type { MermaidComplexity } from "./complexity";
import {
  getCachedMermaidRender,
  pinMermaidRender,
  unpinMermaidRender,
  type MermaidRenderRequestOptions,
} from "./render-service";
import {
  type MermaidRenderError,
  type MermaidRenderMetrics,
  type MermaidTheme,
  mermaidRenderKey,
  renderMermaid,
} from "./renderer";

export type MermaidRenderState = {
  status: "idle" | "loading" | "valid" | "invalid";
  svg: string;
  lastValidSvg: string;
  renderKey: string;
  error: MermaidRenderError | null;
  complexity: MermaidComplexity | null;
  metrics: MermaidRenderMetrics;
};

const INITIAL_STATE: MermaidRenderState = {
  status: "idle",
  svg: "",
  lastValidSvg: "",
  renderKey: "",
  error: null,
  complexity: null,
  metrics: {},
};

function cachedRenderState(code: string, theme: MermaidTheme) {
  const renderKey = mermaidRenderKey(code, theme);
  const entry = getCachedMermaidRender(code, theme);
  if (!entry) return INITIAL_STATE;
  return {
    status: "valid",
    svg: entry.svg,
    lastValidSvg: entry.svg,
    renderKey,
    error: null,
    complexity: entry.complexity,
    metrics: { total: 0 },
  } satisfies MermaidRenderState;
}

export function useMermaidBlobUrl(svg: string) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const blob = createMermaidBlobUrl(svg);
    let active = true;
    queueMicrotask(() => {
      if (active) setUrl(blob?.url ?? "");
    });
    return () => {
      active = false;
      blob?.revoke();
    };
  }, [svg]);

  return url;
}

export function mermaidSvgAccessibleName(svg: string) {
  if (!svg) return "نمودار Mermaid";
  const attribute = svg.match(/\saria-label=(?:"([^"]*)"|'([^']*)')/iu);
  const title = svg.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/iu);
  const encoded = (attribute?.[1] ?? attribute?.[2] ?? title?.[1] ?? "").trim();
  if (!encoded) return "نمودار Mermaid";
  return encoded
    .replace(/<[^>]*>/gu, "")
    .replace(/&#x([\da-f]+);/giu, (_, value: string) =>
      String.fromCodePoint(Number.parseInt(value, 16)),
    )
    .replace(/&#(\d+);/gu, (_, value: string) =>
      String.fromCodePoint(Number.parseInt(value, 10)),
    )
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

export function useMermaidRender(
  code: string,
  theme: MermaidTheme,
  debounceMs = 0,
  renderNonce = 0,
  enabled = true,
  requestOptions: MermaidRenderRequestOptions = {},
) {
  const [state, setState] = useState<MermaidRenderState>(() =>
    cachedRenderState(code, theme),
  );
  const requestRef = useRef(0);
  const {
    documentId,
    blockId,
    priority,
    force = false,
    bypassCache = false,
  } = requestOptions;

  useEffect(() => {
    if (!state.renderKey || state.status !== "valid") return;
    pinMermaidRender(state.renderKey);
    return () => unpinMermaidRender(state.renderKey);
  }, [state.renderKey, state.status]);

  useEffect(() => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    if (!enabled) {
      const idleTimer = window.setTimeout(() => {
        if (requestRef.current === request) {
          setState((current) => {
            const cached = cachedRenderState(code, theme);
            return cached.status === "valid"
              ? cached
              : { ...current, status: "idle", svg: "", error: null };
          });
        }
      }, 0);
      return () => window.clearTimeout(idleTimer);
    }
    const timer = window.setTimeout(() => {
      if (!code.trim()) {
        setState((current) => ({
          ...current,
          status: "invalid",
          error: {
            kind: "syntax",
            message: "برای دیدن پیش‌نمایش، کد Mermaid را وارد کنید.",
            technical: "منبع نمودار خالی است.",
          },
        }));
        return;
      }
      const renderKey = mermaidRenderKey(code, theme);
      const cached =
        renderNonce === 0 && !bypassCache
          ? getCachedMermaidRender(code, theme)
          : undefined;
      if (cached) {
        setState({
          status: "valid",
          svg: cached.svg,
          lastValidSvg: cached.svg,
          renderKey,
          error: null,
          complexity: cached.complexity,
          metrics: { total: 0 },
        });
        return;
      }
      setState((current) => ({ ...current, status: "loading", error: null }));
      void renderMermaid(code, theme, {
        documentId,
        blockId,
        priority,
        generation: request,
        force: force || renderNonce > 0,
        bypassCache: bypassCache || renderNonce > 0,
      }).then((result) => {
        if (requestRef.current !== request) return;
        if (result.ok) {
          setState({
            status: "valid",
            svg: result.svg,
            lastValidSvg: result.svg,
            renderKey,
            error: null,
            complexity: result.complexity,
            metrics: result.metrics,
          });
          return;
        }
        if (result.error.kind === "cancelled") return;
        setState((current) => ({
          ...current,
          status: "invalid",
          svg: "",
          error: result.error,
          complexity: result.complexity ?? current.complexity,
          metrics: result.metrics ?? {},
        }));
      });
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [
    blockId,
    bypassCache,
    code,
    debounceMs,
    documentId,
    enabled,
    force,
    priority,
    renderNonce,
    theme,
  ]);

  return state;
}
