"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { printableArticleClone, stagePrintDocument } from "./print-document";

export type PreparedPdf = { id: string; bytes: Uint8Array };
export type PdfPreparation = { status: "idle" | "preparing" | "ready" | "browser" | "error"; document?: PreparedPdf; error?: string };
type PdfBackend = {
  preparePdf?: (options: { landscape: boolean }) => Promise<PreparedPdf>;
  savePreparedPdf?: (id: string, fileName: string) => Promise<{ saved: boolean; filePath?: string }>;
  releasePreparedPdf?: (id: string) => Promise<unknown>;
};

export function usePdfExport() {
  const [state, setState] = useState<PdfPreparation>({ status: "idle" });
  const generation = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const snapshot = useRef<{ article: HTMLElement; name: string } | null>(null);
  const prepared = useRef<{ document: PreparedPdf; backend: PdfBackend } | null>(null);
  const release = useCallback(() => {
    const current = prepared.current;
    prepared.current = null;
    if (current) void current.backend.releasePreparedPdf?.(current.document.id).catch(() => undefined);
  }, []);
  const cancel = useCallback(() => {
    generation.current++;
    snapshot.current = null;
    release();
    setState({ status: "idle" });
  }, [release]);
  useEffect(() => () => { generation.current++; snapshot.current = null; release(); }, [release]);

  const refresh = useCallback((landscape: boolean) => {
    const captured = snapshot.current;
    if (!captured) return;
    const request = ++generation.current;
    release();
    const backend: PdfBackend | undefined = window.raaviDesktop;
    if (!backend?.preparePdf || !backend.savePreparedPdf) { setState({ status: "browser" }); return; }
    setState({ status: "preparing" });
    // A print projection must remain stable until Chromium finishes reading it.
    queue.current = queue.current.catch(() => undefined).then(async () => {
      if (request !== generation.current) return;
      const staged = await stagePrintDocument(captured.article, captured.name, landscape);
      try {
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        if (request !== generation.current) return;
        const result = await backend.preparePdf!({ landscape });
        if (request !== generation.current) { await backend.releasePreparedPdf?.(result.id); return; }
        const document = { id: result.id, bytes: new Uint8Array(result.bytes) };
        prepared.current = { document, backend };
        setState({ status: "ready", document });
      } finally { staged.cleanup(); }
    }).catch(() => {
      if (request === generation.current) setState({ status: "error", error: "ساخت پیش‌نمایش PDF کامل نشد. دوباره تلاش کنید." });
    });
  }, [release]);
  const prepare = useCallback((article: HTMLElement, name: string, landscape: boolean) => {
    snapshot.current = { article: printableArticleClone(article), name };
    refresh(landscape);
  }, [refresh]);
  const save = useCallback(async (landscape: boolean) => {
    const current = prepared.current;
    if (current && snapshot.current) return current.backend.savePreparedPdf!(current.document.id, snapshot.current.name);
    if (!snapshot.current || window.raaviDesktop?.preparePdf) throw new Error("PDF_NOT_READY");
    const staged = await stagePrintDocument(snapshot.current.article, snapshot.current.name, landscape);
    try { window.print(); } finally { staged.cleanup(); }
    return { saved: false, browser: true };
  }, []);
  return { state, prepare, refresh, cancel, save };
}
