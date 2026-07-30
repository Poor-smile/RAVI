"use client";

import { useEffect, useRef, useState } from "react";
import {
  MermaidRenderError,
  MermaidTheme,
  renderMermaid,
} from "./renderer";

export type MermaidRenderState = {
  status: "idle" | "loading" | "valid" | "invalid";
  svg: string;
  lastValidSvg: string;
  error: MermaidRenderError | null;
};

const INITIAL_STATE: MermaidRenderState = {
  status: "idle",
  svg: "",
  lastValidSvg: "",
  error: null,
};

export function useMermaidRender(
  code: string,
  theme: MermaidTheme,
  debounceMs = 0,
  renderNonce = 0,
) {
  const [state, setState] = useState<MermaidRenderState>(INITIAL_STATE);
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
      setState((current) => ({ ...current, status: "loading", error: null }));
      void renderMermaid(code, theme).then((result) => {
        if (requestRef.current !== request) return;
        if (result.ok) {
          setState({
            status: "valid",
            svg: result.svg,
            lastValidSvg: result.svg,
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
