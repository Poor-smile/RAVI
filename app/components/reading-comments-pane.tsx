"use client";

import "./reading-comments-pane.css";

import { AlertTriangle, Check, FactCheck, RefreshCw, Search, Trash2, X } from "@/app/icons/material-symbols";
import type { CodexConnectionState } from "@/app/ai/types";
import type { SmartAnnotationResult } from "@/app/ai/smart-annotations";
import { smartAnnotationCategorySummary } from "@/app/ai/smart-annotations";
import {
  readSmartAnnotationSession,
  runDocumentScopedSmartAnnotationRequest,
  subscribeToSmartAnnotationSession,
  updateSmartAnnotationSession,
} from "@/app/ai/smart-annotation-session";
import type { RaaviAnnotation } from "@/app/raavi";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type RefObject } from "react";
import { MagicWandIcon } from "./magic-wand-trigger";
import { formatReadingAnnotationTime, normalizeReadingAnnotationQuery, quoteReadingAnnotation } from "./reading-annotation-utils";

type ApplyResult = { ok: true } | { ok: false; reason: "conflict" | "error" };

export function ReadingCommentsPane(props: {
  panelId?: string;
  comments: readonly RaaviAnnotation[];
  activeId: string;
  reviewKey: string;
  documentContent: string;
  connectionState: CodexConnectionState;
  searchOpen: boolean;
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  onSearchQueryChange: (value: string) => void;
  onSearchClose: () => void;
  onActivate: (comment: RaaviAnnotation) => void;
  onSetActive: (id: string) => void;
  onBodyChange: (id: string, body: string) => void;
  onDelete: (id: string) => void;
  onDismiss: () => void;
  onCheckConnection: () => Promise<CodexConnectionState>;
  onStartLogin: () => Promise<void>;
  onOpenInstallGuide: () => void;
  onReview: (reviewKey: string, source: string) => Promise<SmartAnnotationResult>;
  onAddSmartAnnotations: (items: readonly RaaviAnnotation[]) => void;
  onUpdateSmartAnnotation: (id: string, patch: Partial<RaaviAnnotation>) => void;
  onApplySmartAnnotation: (annotation: RaaviAnnotation, sourceSnapshot: string, reviewKey: string) => Promise<ApplyResult>;
  onRewriteSmartAnnotation: (annotation: RaaviAnnotation) => Promise<string>;
}) {
  const {
    panelId = "reading-comments-pane", comments, activeId, reviewKey,
    documentContent, connectionState, searchOpen, searchQuery, searchInputRef,
    panelRef, onSearchQueryChange, onSearchClose, onActivate, onSetActive,
    onBodyChange, onDelete, onDismiss, onCheckConnection, onStartLogin,
    onOpenInstallGuide, onReview, onAddSmartAnnotations,
    onUpdateSmartAnnotation, onApplySmartAnnotation, onRewriteSmartAnnotation,
  } = props;
  const listRef = useRef<HTMLDivElement>(null);
  const subscribeToSession = useCallback(
    (onStoreChange: () => void) =>
      subscribeToSmartAnnotationSession(reviewKey, () => onStoreChange()),
    [reviewKey],
  );
  const readSession = useCallback(
    () => readSmartAnnotationSession(reviewKey),
    [reviewKey],
  );
  const session = useSyncExternalStore(
    subscribeToSession,
    readSession,
    readSession,
  );
  const [exitingIds, setExitingIds] = useState<Set<string>>(() => new Set());

  const normalComments = useMemo(() => comments.filter((item) => item.source !== "raavi-ai"), [comments]);
  const smartComments = useMemo(() => comments.filter((item) => item.source === "raavi-ai" && (item.status ?? "open") !== "applied" && item.status !== "rejected" && item.status !== "resolved"), [comments]);
  const attachedSmartComments = smartComments.filter((item) => item.status !== "detached");
  const detachedSmartComments = smartComments.filter((item) => item.status === "detached");
  const categorySummary = smartAnnotationCategorySummary(attachedSmartComments);
  const normalizedQuery = normalizeReadingAnnotationQuery(searchQuery);
  const visibleNormalComments = useMemo(() => normalizedQuery ? normalComments.filter((comment) => normalizeReadingAnnotationQuery(`${comment.quote} ${comment.body}`).includes(normalizedQuery)) : normalComments, [normalComments, normalizedQuery]);

  useEffect(() => {
    if (comments.length && !comments.some((comment) => comment.id === activeId)) onSetActive(comments[0].id);
  }, [activeId, comments, onSetActive]);

  useEffect(() => {
    if (!activeId) return;
    listRef.current?.querySelector<HTMLElement>(`#annotation-card-${CSS.escape(activeId)}`)?.scrollIntoView({ block: "nearest" });
  }, [activeId, comments]);

  const setPhase = (phase: typeof session.phase, statusMessage = "") => updateSmartAnnotationSession(reviewKey, (current) => ({ ...current, phase, statusMessage }));

  const beginReview = async () => {
    if (!documentContent.trim()) return;
    if (connectionState !== "connected") {
      setPhase("disconnected");
      const next = await onCheckConnection();
      if (next === "connected") setPhase("confirm");
      return;
    }
    setPhase("confirm");
  };

  const runReview = async () => {
    const sourceSnapshot = documentContent;
    updateSmartAnnotationSession(reviewKey, (current) => ({ ...current, phase: "checking", sourceSnapshot, summary: "", annotations: [], visibleCount: 0, statusMessage: "", startedAt: new Date().toISOString() }));
    try {
      const result = await runDocumentScopedSmartAnnotationRequest(reviewKey, () => onReview(reviewKey, sourceSnapshot));
      onAddSmartAnnotations(result.annotations);
      updateSmartAnnotationSession(reviewKey, (current) => ({ ...current, phase: "complete", summary: result.summary, annotations: result.annotations, visibleCount: result.annotations.length, statusMessage: result.annotations.length ? "" : "نشانهٔ قابل‌اعتمادی پیدا نشد." }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "نشانه‌گذاری انجام نشد.";
      if (message.includes("CODEX_QUOTA_EXHAUSTED")) setPhase("quota");
      else if (message.includes("CODEX_CLI_MISSING") || message.includes("CODEX_AUTH_REQUIRED")) setPhase("disconnected");
      else setPhase("error", message);
    }
  };

  const removeWithMotion = (id: string, patch: Partial<RaaviAnnotation>) => {
    setExitingIds((current) => new Set(current).add(id));
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260;
    window.setTimeout(() => {
      onUpdateSmartAnnotation(id, patch);
      setExitingIds((current) => { const next = new Set(current); next.delete(id); return next; });
    }, duration);
  };

  const applySmart = async (annotation: RaaviAnnotation) => {
    onUpdateSmartAnnotation(annotation.id, { status: "applying" });
    const result = await onApplySmartAnnotation(annotation, session.sourceSnapshot, reviewKey);
    if (!result.ok) {
      onUpdateSmartAnnotation(annotation.id, { status: "open" });
      setPhase("error", result.reason === "conflict" ? "متن این بخش پس از بررسی تغییر کرده است؛ پیشنهاد اعمال نشد." : "پیشنهاد اعمال نشد؛ دوباره تلاش کنید.");
      return;
    }
    removeWithMotion(annotation.id, { status: "applied" });
  };

  const rewriteSmart = async (annotation: RaaviAnnotation) => {
    onUpdateSmartAnnotation(annotation.id, { status: "applying" });
    try {
      const suggestion = await onRewriteSmartAnnotation(annotation);
      onUpdateSmartAnnotation(annotation.id, { suggestion, status: "open" });
    } catch {
      onUpdateSmartAnnotation(annotation.id, { status: "open" });
      setPhase("error", "بازنویسی پیشنهاد آماده نشد.");
    }
  };

  const moveRowFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.classList.contains("reading-comment-row-jump")) return;
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(".reading-comment-row-jump"));
    const currentIndex = rows.indexOf(target);
    if (currentIndex < 0 || !rows.length) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      const comment = visibleNormalComments[currentIndex];
      if (comment) onDelete(comment.id);
      return;
    }
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % rows.length;
    else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + rows.length) % rows.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = rows.length - 1;
    else return;
    event.preventDefault();
    rows[nextIndex]?.focus({ preventScroll: true });
    rows[nextIndex]?.scrollIntoView({ block: "nearest" });
  };

  return (
    <section ref={panelRef} id={panelId} className="sidebar-annotations-view reading-comments-pane" aria-labelledby="sidebar-pane-title" tabIndex={-1} onKeyDownCapture={(event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      const target = event.target;
      if (target instanceof HTMLInputElement && target.classList.contains("reading-comment-row-body")) {
        target.closest(".reading-comment-row")?.querySelector<HTMLButtonElement>(".reading-comment-row-jump")?.focus({ preventScroll: true });
        return;
      }
      onDismiss();
    }}>
      {searchOpen && <label className="reading-sidebar-filter-control reading-comments-search-control"><Search size={18} aria-hidden="true" /><input ref={searchInputRef} type="search" value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} placeholder="جست‌وجو در نظرات…" aria-label="جست‌وجو در نظرات سند" autoComplete="off" spellCheck={false} dir="auto" /><button type="button" onClick={() => { if (!searchQuery) onSearchClose(); else { onSearchQueryChange(""); searchInputRef.current?.focus({ preventScroll: true }); } }} aria-label={searchQuery ? "پاک‌کردن جست‌وجوی نظرات" : "بستن جست‌وجوی نظرات"}><X size={16} aria-hidden="true" /></button></label>}
      <button className="smart-annotation-trigger" type="button" onClick={() => void beginReview()} disabled={!documentContent.trim() || session.phase === "checking"}><span>{session.phase === "checking" ? "در حال نشانه‌گذاری…" : session.phase === "complete" ? "نشانه‌گذاری دوباره" : "نشانه‌گذاری هوشمند سند"}</span><FactCheck size={18} aria-hidden="true" /></button>
      {session.phase === "confirm" && <div className="smart-annotation-confirm" role="group" aria-label="تأیید نشانه‌گذاری هوشمند"><strong>کل سند بررسی می‌شود</strong><p>راوی متن همین سند را برای پیدا‌کردن ابهام، تناقض، تکرار و ضعف ساختار به ChatGPT می‌فرستد. هیچ تغییری بدون تأیید شما اعمال نمی‌شود.</p><div className="smart-annotation-privacy"><strong>محدوده: کل سند</strong><span>کامنت‌ها و نتیجه در فایل Markdown محلی می‌مانند.</span></div><div className="smart-annotation-actions"><button type="button" onClick={() => setPhase("idle")}>انصراف</button><button className="is-primary" type="button" onClick={() => void runReview()}>شروع بررسی</button></div><small>پیش از اعمال، نسخهٔ فعلی سند برای بازگشت احتمالی ذخیره می‌شود.</small></div>}
      {session.phase === "checking" && <div className="smart-annotation-processing" role="status" aria-live="polite"><strong>در حال نشانه‌گذاری…</strong><span>یافته‌ها پس از اعتبارسنجی به نظرات اضافه می‌شوند.</span><div className="smart-annotation-progress"><i /></div><small>پردازش این سند با تعویض تب ادامه پیدا می‌کند.</small></div>}
      {session.phase === "disconnected" && <div className="smart-annotation-state is-warning" role="status"><AlertTriangle size={21} aria-hidden="true" /><div><strong>ChatGPT آماده نیست</strong><small>نظرات عادی و نشانه‌های محلی همچنان در دسترس‌اند.</small></div><div className="smart-annotation-actions">{connectionState === "cli_missing" ? <button type="button" onClick={onOpenInstallGuide}>راهنمای نصب</button> : connectionState === "auth_required" ? <button type="button" onClick={() => void onStartLogin()}>ورود با ChatGPT</button> : <button type="button" onClick={() => void onCheckConnection()}>بررسی اتصال</button>}</div></div>}
      {session.phase === "quota" && <div className="smart-annotation-state is-warning" role="alert"><AlertTriangle size={21} aria-hidden="true" /><div><strong>سهمیهٔ فعلی تمام شده است</strong><small>بعداً دوباره تلاش کنید؛ نظرات موجود محفوظ‌اند.</small></div></div>}
      {session.phase === "error" && <div className="smart-annotation-state is-error" role="alert"><AlertTriangle size={21} aria-hidden="true" /><div><strong>نشانه‌گذاری یا اعمال انجام نشد</strong><small>{session.statusMessage}</small></div><button type="button" onClick={() => void runReview()}>تلاش دوباره</button></div>}
      {categorySummary.length > 0 && <div className="smart-annotation-summary" role="status" aria-label="خلاصه نشانه‌های هوشمند">{categorySummary.map(({ category, count }) => <span key={category}><strong>{count.toLocaleString("fa-IR")}</strong><small>{category}</small></span>)}</div>}
      {session.phase === "complete" && <div className="smart-annotation-complete" role="status"><Check size={20} aria-hidden="true" /><div><strong>نشانه‌گذاری کامل شد</strong><small>{session.summary || session.statusMessage}</small></div></div>}
      <div ref={listRef} className="reading-comments-list" role="list" aria-label="نظرات همین سند" onKeyDown={moveRowFocus}>
        {attachedSmartComments.map((comment) => <SmartCommentCard key={comment.id} comment={comment} exiting={exitingIds.has(comment.id)} onActivate={onActivate} onApply={() => void applySmart(comment)} onRewrite={() => void rewriteSmart(comment)} onIgnore={() => removeWithMotion(comment.id, { status: "rejected" })} onResolve={() => removeWithMotion(comment.id, { status: "resolved" })} />)}
        {detachedSmartComments.length > 0 && <section className="detached-annotations"><div className="detached-warning"><strong>{detachedSmartComments.length.toLocaleString("fa-IR")} نشانه نیازمند اتصال دوباره است</strong><span>راوی جای تازه را حدس نمی‌زند.</span></div><h3>نیازمند اتصال دوباره</h3>{detachedSmartComments.map((comment) => <article className="detached-annotation-card" key={comment.id}><strong>راوی هوشمند · {comment.category || "سایر"}</strong><p>{quoteReadingAnnotation(comment.quote)}</p><div><button type="button" onClick={() => onDelete(comment.id)}>حذف</button><button type="button" onClick={() => onActivate(comment)}>انتخاب متن</button></div></article>)}</section>}
        <p className="reading-comments-summary">نظرات · {normalComments.length.toLocaleString("fa-IR")} مورد</p>
        {visibleNormalComments.map((comment) => { const active = comment.id === activeId; return <article id={`annotation-card-${comment.id}`} className={`reading-comment-row ${active ? "is-active" : ""}`} role="listitem" key={comment.id}><div className="reading-comment-row-main"><button className="reading-comment-row-jump" type="button" onClick={() => onActivate(comment)} aria-current={active ? "location" : undefined} aria-label={`رفتن به نظر: ${comment.quote}`}><strong dir="auto">{quoteReadingAnnotation(comment.quote)}</strong></button><input className="reading-comment-row-body" type="text" value={comment.body} onFocus={() => onSetActive(comment.id)} onChange={(event) => onBodyChange(comment.id, event.target.value)} aria-label={`ویرایش نظر برای: ${comment.quote}`} placeholder="بدون متن نظر" autoComplete="off" dir="auto" data-editable-kind="annotationBody" /><time dateTime={comment.createdAt} suppressHydrationWarning>{formatReadingAnnotationTime(comment.createdAt)}</time></div><button className="reading-comment-row-delete" type="button" onClick={() => onDelete(comment.id)} aria-label={`حذف نظر: ${comment.quote}`}><Trash2 size={16} aria-hidden="true" /></button></article>; })}
        {!comments.length && session.phase === "idle" && <div className="reading-comments-empty" role="status"><strong>هنوز نشانهٔ هوشمندی ثبت نشده</strong><span>برای بررسی انسجام، ابهام و تکرار، دکمهٔ بالا را بزنید.</span></div>}
        {normalComments.length > 0 && !visibleNormalComments.length && <div className="reading-comments-empty" role="status"><strong>نظری مطابق جست‌وجو پیدا نشد</strong><span>عبارت دیگری را امتحان کنید.</span></div>}
      </div>
    </section>
  );
}

function SmartCommentCard({ comment, exiting, onActivate, onApply, onRewrite, onIgnore, onResolve }: { comment: RaaviAnnotation; exiting: boolean; onActivate: (comment: RaaviAnnotation) => void; onApply: () => void; onRewrite: () => void; onIgnore: () => void; onResolve: () => void }) {
  const applying = comment.status === "applying";
  return <article id={`annotation-card-${comment.id}`} className={`smart-comment-card ${applying ? "is-applying" : ""} ${exiting ? "is-exiting" : ""}`} role="listitem"><header><span className="smart-comment-brand"><MagicWandIcon size={16} /><strong>راوی هوشمند</strong></span><span>{comment.category || "سایر"}</span><time dateTime={comment.createdAt}>{formatReadingAnnotationTime(comment.createdAt)}</time></header><button className="smart-comment-anchor" type="button" onClick={() => onActivate(comment)}>{quoteReadingAnnotation(comment.quote)}</button><p className="smart-comment-reason">{comment.body}</p>{comment.suggestion && <div className="smart-comment-diff"><p><span>متن فعلی</span>{comment.quote}</p><p><span>پیشنهاد راوی</span>{comment.suggestion}</p></div>}<div className="smart-comment-meta"><span>اطمینان {Math.round((comment.confidence ?? 0.7) * 100).toLocaleString("fa-IR")}٪</span><span>باز</span></div>{applying ? <div className="smart-comment-applying" role="status"><RefreshCw className="is-spinning" size={18} aria-hidden="true" /><span>در حال اعمال پیشنهاد…</span></div> : <div className="smart-comment-actions"><button type="button" onClick={onIgnore}>نادیده‌گرفتن</button><button type="button" onClick={onRewrite}>اصلاح دوباره</button><button className="is-primary" type="button" onClick={onApply}>اعمال پیشنهاد</button><button type="button" onClick={onResolve}>حل‌شده</button></div>}</article>;
}
