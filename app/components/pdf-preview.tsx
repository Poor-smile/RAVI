"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PdfPreparation } from "../export/use-pdf-export";

export function PdfPreview({ preparation, landscape, onLandscapeChange, onRetry, onReady, settingsHeader, settingsFooter }: {
  preparation: PdfPreparation; landscape: boolean; onLandscapeChange: (value: boolean) => void; onRetry: () => void; onReady: (id: string) => void;
  settingsHeader?: ReactNode; settingsFooter?: ReactNode;
}) {
  const [loaded, setLoaded] = useState<{ id: string; pdf?: PDFDocumentProxy; error?: string }>({ id: "" });
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(.6);
  const [rendered, setRendered] = useState("");
  const [renderError, setRenderError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const document = preparation.document;
  const pdf = loaded.id === document?.id ? loaded.pdf : undefined;
  const activePage = Math.min(page, pdf?.numPages ?? 1);
  const renderKey = `${document?.id}:${activePage}:${zoom}`;
  useEffect(() => {
    if (!document) return;
    let disposed = false;
    let destroy: (() => Promise<void>) | undefined;
    void import("pdfjs-dist").then(async api => {
      if (disposed) return;
      api.GlobalWorkerOptions.workerSrc = workerUrl;
      // PDF.js transfers its input buffer; keep the native snapshot untouched.
      const task = api.getDocument({ data: document.bytes.slice(), useWasm: false, disableFontFace: true });
      destroy = () => task.destroy();
      const pdf = await task.promise;
      if (disposed) { await task.destroy(); return; }
      setLoaded({ id: document.id, pdf });
    }).catch(() => { if (!disposed) setLoaded({ id: document.id, error: "نمایش فایل PDF ممکن نشد. دوباره تلاش کنید." }); });
    return () => { disposed = true; void destroy?.(); };
  }, [document]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let disposed = false;
    let render: RenderTask | undefined;
    const target = canvas.current;
    void pdf.getPage(activePage).then(async current => {
      if (disposed) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = current.getViewport({ scale: zoom * 96 / 72 });
      target.width = Math.ceil(viewport.width * ratio);
      target.height = Math.ceil(viewport.height * ratio);
      target.style.width = `${viewport.width}px`;
      target.style.height = `${viewport.height}px`;
      render = current.render({ canvas: target, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0], background: "white" });
      await render.promise;
      if (!disposed) { setRendered(renderKey); setRenderError(""); onReady(document!.id); }
    }).catch(error => { if (!disposed && error?.name !== "RenderingCancelledException") setRenderError("نمایش این صفحه کامل نشد؛ دوباره تلاش کنید."); });
    return () => { disposed = true; render?.cancel(); };
  }, [pdf, activePage, zoom, renderKey, document, onReady]);
  const error = preparation.error || (loaded.id === document?.id ? loaded.error : "") || renderError;
  const browser = preparation.status === "browser";
  return <section className="pdf-preview" aria-label="پیش‌نمایش صفحه‌بندی PDF">
    <aside className="pdf-preview-settings">
      {settingsHeader}
      <span>اندازهٔ کاغذ: A4</span>
      <strong>جهت صفحه</strong>
      <div className="pdf-preview-orientation">
      <button type="button" aria-pressed={!landscape} onClick={() => { setPage(1); onLandscapeChange(false); }}>عمودی</button>
      <button type="button" aria-pressed={landscape} onClick={() => { setPage(1); onLandscapeChange(true); }}>افقی</button>
      </div>
      <span>حاشیه: ۱۴ میلی‌متر</span>
      <p id="export-modal-description">ظاهر چاپ از تم برنامه مستقل است؛ متن و لینک‌ها مشکی و زمینه سفید می‌ماند.</p>
      <div className="pdf-settings-footer">{settingsFooter}</div>
    </aside>
    <div className="pdf-preview-document">
    <div className="pdf-preview-controls">
      {!browser && <>
        <label>بزرگ‌نمایی <select value={zoom} onChange={event => setZoom(Number(event.target.value))}><option value={.5}>۵۰٪</option><option value={.6}>۶۰٪</option><option value={.75}>۷۵٪</option><option value={1}>۱۰۰٪</option><option value={1.5}>۱۵۰٪</option></select></label>
        <button type="button" disabled={!pdf || activePage <= 1} onClick={() => setPage(activePage - 1)}>صفحهٔ قبل</button>
        <span role="status">{pdf ? `صفحهٔ ${activePage.toLocaleString("fa-IR")} از ${pdf.numPages.toLocaleString("fa-IR")}` : "در حال آماده‌سازی…"}</span>
        <button type="button" disabled={!pdf || activePage >= pdf.numPages} onClick={() => setPage(activePage + 1)}>صفحهٔ بعد</button>
      </>}
    </div>
    {browser ? <p className="pdf-browser-note">پیش‌نمایش دقیق و انتخاب مقصد «ذخیره به‌صورت PDF» در پنجرهٔ چاپ مرورگر انجام می‌شود.</p> : error ?
      <div role="alert" className="pdf-preview-error"><p>{error}</p><button type="button" onClick={() => { setRenderError(""); onRetry(); }}>تلاش دوباره</button></div> :
      <div className="pdf-preview-scroll" aria-busy={!pdf || rendered !== renderKey}>
        {(!pdf || rendered !== renderKey) && <p role="status">در حال آماده‌سازی صفحه…</p>}
        <canvas ref={canvas} className="pdf-preview-canvas" aria-label={`صفحهٔ ${activePage.toLocaleString("fa-IR")} PDF`} style={{ visibility: pdf && rendered === renderKey ? "visible" : "hidden" }} />
      </div>}
    </div>
  </section>;
}
