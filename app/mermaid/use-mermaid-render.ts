"use client";

import { useEffect, useRef, useState } from "react";
import {
  MermaidRenderError,
  MermaidTheme,
  mermaidRenderKey,
  renderMermaid,
} from "./renderer";

export type MermaidRenderState = {
  status: "idle" | "loading" | "valid" | "invalid";
  svg: string;
  lastValidSvg: string;
  renderKey: string;
  error: MermaidRenderError | null;
};

const INITIAL_STATE: MermaidRenderState = {
  status: "idle",
  svg: "",
  lastValidSvg: "",
  renderKey: "",
  error: null,
};

const MERMAID_RENDER_CACHE_LIMIT = 80;
const mermaidRenderCache = new Map<string, string>();

function cachedRenderState(code: string, theme: MermaidTheme) {
  const renderKey = mermaidRenderKey(code, theme);
  const svg = mermaidRenderCache.get(renderKey);
  if (!svg) return INITIAL_STATE;
  return {
    status: "valid",
    svg,
    lastValidSvg: svg,
    renderKey,
    error: null,
  } satisfies MermaidRenderState;
}

function rememberRenderedSvg(renderKey: string, svg: string) {
  mermaidRenderCache.delete(renderKey);
  mermaidRenderCache.set(renderKey, svg);
  if (mermaidRenderCache.size <= MERMAID_RENDER_CACHE_LIMIT) return;
  const oldestKey = mermaidRenderCache.keys().next().value;
  if (typeof oldestKey === "string") mermaidRenderCache.delete(oldestKey);
}

export function useMermaidRender(
  code: string,
  theme: MermaidTheme,
  debounceMs = 0,
  renderNonce = 0,
) {
  const [state, setState] = useState<MermaidRenderState>(() =>
    cachedRenderState(code, theme),
  );
  const requestRef = useRef(0);

  useEffect(() => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    const timer = window.setTimeout(() => {
      if (!code.trim()) {
        setState((current) => ({
          ...current,
          status: "invalid",
          error: {
            kind: "syntax",
            message: "برای دیدن پیش‌نمایش، کد Mermaid را وارد کنید.",
            technical: "Empty Mermaid source",
          },
        }));
        return;
      }
      const renderKey = mermaidRenderKey(code, theme);
      const cachedSvg = mermaidRenderCache.get(renderKey);
      if (cachedSvg && renderNonce === 0) {
        setState((current) =>
          current.status === "valid" &&
          current.svg === cachedSvg &&
          current.renderKey === renderKey
            ? current
            : {
                status: "valid",
                svg: cachedSvg,
                lastValidSvg: cachedSvg,
                renderKey,
                error: null,
              },
        );
        return;
      }
      setState((current) => ({ ...current, status: "loading", error: null }));
      void renderMermaid(code, theme).then((result) => {
        if (requestRef.current !== request) return;
        if (result.ok) {
          const nextRenderKey = mermaidRenderKey(code, theme);
          rememberRenderedSvg(nextRenderKey, result.svg);
          setState({
            status: "valid",
            svg: result.svg,
            lastValidSvg: result.svg,
            renderKey: nextRenderKey,
            error: null,
          });
          return;
        }
        setState((current) => ({
          ...current,
          status: "invalid",
          svg: "",
          error: result.error,
        }));
      });
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [code, debounceMs, renderNonce, theme]);

  return state;
}
