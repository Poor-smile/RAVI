"use client";

import "./persian-corrections-panel.css";

import type { RefObject } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  estimatePersianAiReviewCost,
  type PersianAiReviewResult,
  type PersianAiSuggestion,
} from "../ai/persian-review";
import {
  readPersianAiReviewSession,
  subscribeToPersianAiReviewSession,
  updatePersianAiReviewSession,
  type PersianAiReviewSession,
} from "../ai/persian-review-session";
import type { CodexConnectionState } from "../ai/types";
import { AlertTriangle, Check, FactCheck, RefreshCw, X } from "../icons/material-symbols";
import { MagicWandIcon } from "./magic-wand-trigger";

export type PersianCorrectionRow = { id: string; title: string; detail: string; count: number };
type ApplyResult = { ok: true } | { ok: false; reason: "conflict" | "error" };

export function PersianCorrectionsPanel({
  issues,
  reviewKey,
  panelRef,
  documentContent,
  connectionState,
  onFix,
  onFixAll,
  onCheckConnection,
  onStartLogin,
  onOpenInstallGuide,
  onReview,
  onRewrite,
  onApplySuggestion,
  onApplyAllSuggestions,
}: {
  issues: readonly PersianCorrectionRow[];
  reviewKey: string;
  panelRef?: RefObject<HTMLElement | null>;
  documentContent: string;
  connectionState: CodexConnectionState;
  onFix: (issueId: string) => void;
  onFixAll: () => void;
  onCheckConnection: () => Promise<CodexConnectionState>;
  onStartLogin: () => Promise<void>;
  onOpenInstallGuide: () => void;
  onReview: (reviewKey: string, source: string) => Promise<PersianAiReviewResult>;
  onRewrite: (suggestion: PersianAiSuggestion) => Promise<string>;
  onApplySuggestion: (suggestion: PersianAiSuggestion, sourceSnapshot: string, reviewKey: string) => Promise<ApplyResult>;
  onApplyAllSuggestions: (suggestions: readonly PersianAiSuggestion[], sourceSnapshot: string, reviewKey: string) => Promise<ApplyResult>;
}) {
  const total = issues.reduce((sum, issue) => sum + issue.count, 0);
  const activeIssues = issues.filter((issue) => issue.count > 0);
  const categoryCount = activeIssues.length;
  const isClean = total === 0;
  const [reviewSession, setReviewSession] = useState(() =>
    readPersianAiReviewSession(reviewKey),
  );
  const {
    phase,
    sourceSnapshot,
    summary,
    suggestions,
    visibleSuggestionCount,
    suggestionStates,
    confirmAll,
    statusMessage,
  } = reviewSession;

  useEffect(
    () => subscribeToPersianAiReviewSession(reviewKey, setReviewSession),
    [reviewKey],
  );

  const setSessionField = <Key extends keyof PersianAiReviewSession>(
    key: Key,
    value:
      | PersianAiReviewSession[Key]
      | ((current: PersianAiReviewSession[Key]) => PersianAiReviewSession[Key]),
  ) => {
    updatePersianAiReviewSession(reviewKey, (current) => ({
      ...current,
      [key]:
        typeof value === "function"
          ? (value as (currentValue: PersianAiReviewSession[Key]) => PersianAiReviewSession[Key])(
              current[key],
            )
          : value,
    }));
  };

  const pendingSuggestions = useMemo(
    () => suggestions.filter((item) => (suggestionStates[item.id] ?? "pending") === "pending"),
    [suggestionStates, suggestions],
  );

  useEffect(() => {
    if (phase !== "suggestions" || visibleSuggestionCount >= suggestions.length) return;
    const timer = window.setTimeout(
      () =>
        updatePersianAiReviewSession(reviewKey, (current) => ({
          ...current,
          visibleSuggestionCount: current.visibleSuggestionCount + 1,
        })),
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160,
    );
    return () => window.clearTimeout(timer);
  }, [phase, reviewKey, suggestions.length, visibleSuggestionCount]);

  const beginSmartReview = async () => {
    setSessionField("statusMessage", "");
    if (connectionState !== "connected") {
      setSessionField("phase", "disconnected");
      const nextConnectionState = await onCheckConnection();
      if (nextConnectionState === "connected") setSessionField("phase", "confirm");
      return;
    }
    setSessionField("phase", "confirm");
  };

  const runSmartReview = async () => {
    const snapshot = documentContent;
    updatePersianAiReviewSession(reviewKey, (current) => ({
      ...current,
      sourceSnapshot: snapshot,
      phase: "checking",
      suggestions: [],
      suggestionStates: {},
      visibleSuggestionCount: 0,
      confirmAll: false,
      statusMessage: "",
    }));
    try {
      const result = await onReview(reviewKey, snapshot);
      updatePersianAiReviewSession(reviewKey, (current) => ({
        ...current,
        summary: result.summary,
        suggestions: result.suggestions,
        visibleSuggestionCount: result.suggestions.length ? 1 : 0,
        phase: result.suggestions.length ? "suggestions" : "success",
        statusMessage: result.suggestions.length
          ? ""
          : "مشکل زمینه‌ای قابل‌اعتمادی پیدا نشد.",
      }));
    } catch (reviewError) {
      const message = reviewError instanceof Error ? reviewError.message : "بررسی انجام نشد.";
      if (message.includes("CODEX_QUOTA_EXHAUSTED")) setSessionField("phase", "quota");
      else if (message.includes("CODEX_CLI_MISSING") || message.includes("CODEX_AUTH_REQUIRED")) setSessionField("phase", "disconnected");
      else {
        updatePersianAiReviewSession(reviewKey, (current) => ({
          ...current,
          phase: "error",
          statusMessage: message,
        }));
      }
    }
  };

  const rewriteSuggestion = async (suggestion: PersianAiSuggestion) => {
    setSessionField("suggestionStates", (current) => ({ ...current, [suggestion.id]: "rewriting" }));
    try {
      const replacement = await onRewrite(suggestion);
      setSessionField("suggestions", (current) => current.map((item) => item.id === suggestion.id ? { ...item, replacement } : item));
    } catch (rewriteError) {
      setSessionField("statusMessage", rewriteError instanceof Error ? rewriteError.message : "بازنویسی پیشنهاد انجام نشد.");
    } finally {
      setSessionField("suggestionStates", (current) => ({ ...current, [suggestion.id]: "pending" }));
    }
  };

  const removeAppliedSuggestions = (suggestionIds: readonly string[]) => {
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 220;
    window.setTimeout(() => {
      updatePersianAiReviewSession(reviewKey, (current) => {
        const removed = new Set(suggestionIds);
        const nextSuggestions = current.suggestions.filter(
          (item) => !removed.has(item.id),
        );
        const nextSuggestionStates = { ...current.suggestionStates };
        for (const suggestionId of suggestionIds) {
          delete nextSuggestionStates[suggestionId];
        }
        return {
          ...current,
          phase: nextSuggestions.length ? "suggestions" : "success",
          suggestions: nextSuggestions,
          suggestionStates: nextSuggestionStates,
          visibleSuggestionCount: Math.min(
            current.visibleSuggestionCount,
            nextSuggestions.length,
          ),
        };
      });
    }, duration);
  };

  const applySuggestion = async (suggestion: PersianAiSuggestion) => {
    const result = await onApplySuggestion(suggestion, sourceSnapshot, reviewKey);
    if (!result.ok) {
      updatePersianAiReviewSession(reviewKey, (current) => ({
        ...current,
        phase: "error",
        statusMessage: result.reason === "conflict" ? "متن هنگام بررسی تغییر کرده است؛ برای جلوگیری از بازنویسی ناخواسته دوباره بررسی کنید." : "پیشنهاد اعمال نشد؛ دوباره تلاش کنید.",
      }));
      return;
    }
    updatePersianAiReviewSession(reviewKey, (current) => ({
      ...current,
      suggestionStates: {
        ...current.suggestionStates,
        [suggestion.id]: "exiting-applied",
      },
      statusMessage: "پیشنهاد اعمال و نسخهٔ پیش از تغییر ذخیره شد.",
    }));
    removeAppliedSuggestions([suggestion.id]);
  };

  const applyAll = async () => {
    const appliedSuggestionIds = pendingSuggestions.map((item) => item.id);
    const result = await onApplyAllSuggestions(
      pendingSuggestions,
      sourceSnapshot,
      reviewKey,
    );
    if (!result.ok) {
      updatePersianAiReviewSession(reviewKey, (current) => ({
        ...current,
        phase: "error",
        statusMessage: result.reason === "conflict" ? "متن هنگام بررسی تغییر کرده است؛ اعمال گروهی انجام نشد." : "اعمال گروهی انجام نشد؛ دوباره تلاش کنید.",
      }));
      return;
    }
    updatePersianAiReviewSession(reviewKey, (current) => ({
      ...current,
      suggestionStates: {
        ...current.suggestionStates,
        ...Object.fromEntries(
          appliedSuggestionIds.map((suggestionId) => [
            suggestionId,
            "exiting-applied",
          ]),
        ),
      },
      confirmAll: false,
      statusMessage: "همهٔ پیشنهادهای تأییدشده اعمال و در نسخه‌ها ثبت شدند.",
    }));
    removeAppliedSuggestions(appliedSuggestionIds);
  };

  return (
    <section ref={panelRef} className={`persian-corrections-panel ${isClean ? "is-clean" : ""}`} id="persian-corrections-panel" aria-labelledby="sidebar-pane-title" tabIndex={-1}>
      <div className="persian-corrections-summary" role="status" aria-live="polite">
        <strong>{total.toLocaleString("fa-IR")} مورد در {categoryCount.toLocaleString("fa-IR")} دسته</strong>
        <button type="button" onClick={onFixAll} disabled={isClean} aria-label={isClean ? "متن فارسی مرتب است" : `اصلاح همهٔ ${total.toLocaleString("fa-IR")} مورد`}>اصلاح همه</button>
      </div>

      {activeIssues.length > 0 && (
        <div className="persian-corrections-list" role="list" aria-label="دسته‌های اصلاح فارسی">
          {activeIssues.map((issue) => (
            <div key={issue.id} role="listitem">
              <button className="persian-correction-row" type="button" onClick={() => onFix(issue.id)} aria-label={`${issue.title}، ${issue.count.toLocaleString("fa-IR")} مورد، اصلاح این دسته`}>
                <span className="persian-correction-heading"><strong className="persian-correction-title">{issue.title}</strong><span className="persian-local-badge">محلی</span></span>
                <small className="persian-correction-detail">{issue.count.toLocaleString("fa-IR")} مورد · {issue.detail}</small>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="persian-ai-review-entry">
        <button className="persian-ai-review-trigger" type="button" onClick={() => void beginSmartReview()} disabled={!documentContent.trim() || phase === "checking"}>
          <FactCheck size={18} aria-hidden="true" /><span>بررسی با هوش مصنوعی</span>
        </button>
        <small>مشکلات وابسته به معنی و بافت جمله</small>
      </div>

      {phase === "confirm" && <div className="persian-ai-review-confirm" role="group" aria-label="تأیید بررسی هوشمند"><strong>کل سند بررسی شود؟</strong><p>{documentContent.length.toLocaleString("fa-IR")} نویسه · مصرف تقریبی {estimatePersianAiReviewCost(documentContent.length)} · پیشنهادها بدون تأیید شما اعمال نمی‌شوند.</p><div className="persian-ai-inline-actions"><button type="button" onClick={() => void runSmartReview()}>شروع بررسی</button><button type="button" onClick={() => setSessionField("phase", "idle")}>لغو</button></div></div>}

      {phase === "checking" && <div className="persian-ai-review-state is-loading" role="status" aria-live="polite"><RefreshCw className="is-spinning" size={22} aria-hidden="true" /><div><strong>در حال بررسی سند…</strong><small>پیشنهادها پس از اعتبارسنجی به‌تدریج نمایش داده می‌شوند.</small></div></div>}

      {phase === "disconnected" && <div className="persian-ai-review-state" role="status"><AlertTriangle size={21} aria-hidden="true" /><div><strong>ChatGPT آماده نیست</strong><small>اصلاحات محلی همچنان بدون اتصال کار می‌کنند.</small></div><div className="persian-ai-inline-actions">{connectionState === "cli_missing" ? <button type="button" onClick={onOpenInstallGuide}>راهنمای نصب</button> : connectionState === "auth_required" ? <button type="button" onClick={() => void onStartLogin()}>ورود با ChatGPT</button> : <button type="button" onClick={() => void onCheckConnection()}>بررسی اتصال</button>}</div></div>}

      {phase === "quota" && <div className="persian-ai-review-state is-warning" role="alert"><AlertTriangle size={21} aria-hidden="true" /><div><strong>سهمیهٔ فعلی تمام شده است</strong><small>بعداً دوباره تلاش کنید؛ اصلاحات محلی در دسترس‌اند.</small></div></div>}

      {phase === "error" && <div className="persian-ai-review-state is-error" role="alert"><AlertTriangle size={21} aria-hidden="true" /><div><strong>بررسی یا اعمال انجام نشد</strong><small>{statusMessage || "اتصال و متن سند را بررسی کنید."}</small></div><button type="button" onClick={() => void runSmartReview()}>تلاش دوباره</button></div>}

      {phase === "suggestions" && (
        <div className="persian-ai-suggestions" aria-label="پیشنهادهای هوشمند فارسی">
          <div className="persian-ai-suggestions-summary" role="status" aria-live="polite"><strong>{summary}</strong>{pendingSuggestions.length > 1 && <button type="button" onClick={() => setSessionField("confirmAll", true)}>اعمال گروهی</button>}</div>
          {confirmAll && <div className="persian-ai-batch-confirm" role="group" aria-label="تأیید اعمال گروهی"><strong>{pendingSuggestions.length.toLocaleString("fa-IR")} پیشنهاد اعمال شود؟</strong><small>پیش از تغییر، یک نسخه از سند ذخیره می‌شود.</small><div className="persian-ai-inline-actions"><button type="button" onClick={() => void applyAll()}>تأیید اعمال</button><button type="button" onClick={() => setSessionField("confirmAll", false)}>لغو</button></div></div>}
          <div className="persian-ai-suggestion-list" role="list">
            {suggestions.slice(0, visibleSuggestionCount).map((suggestion) => {
              const state = suggestionStates[suggestion.id] ?? "pending";
              return (
                <article className={`persian-ai-suggestion-card is-${state}`} key={suggestion.id} role="listitem">
                  <header><span className="persian-ai-badge"><span>راوی هوشمند</span><MagicWandIcon size={14} /></span><strong>{suggestion.category}</strong></header>
                  <p className="persian-ai-reason">دلیل: {suggestion.reason}</p>
                  <p className="persian-ai-current">اکنون: {suggestion.current}</p>
                  <p className="persian-ai-replacement">پیشنهاد: {suggestion.replacement}</p>
                  {state === "pending" || state === "rewriting" ? <div className="persian-ai-suggestion-actions"><button type="button" onClick={() => setSessionField("suggestionStates", (current) => ({ ...current, [suggestion.id]: "rejected" }))}><X size={15} aria-hidden="true" /> رد</button><button type="button" disabled={state === "rewriting"} onClick={() => void rewriteSuggestion(suggestion)}>{state === "rewriting" && <RefreshCw className="is-spinning" size={14} aria-hidden="true" />}بازنویسی</button><button className="is-primary" type="button" onClick={() => void applySuggestion(suggestion)}><Check size={15} aria-hidden="true" /> اعمال</button></div> : <p className="persian-ai-suggestion-outcome" role="status">{state === "exiting-applied" ? "اعمال شد" : "رد شد"}</p>}
                </article>
              );
            })}
          </div>
          <p className="persian-ai-review-note">راوی هوشمند · هر پیشنهاد مستقل و قابل رد است</p>
        </div>
      )}

      {phase === "success" && <div className="persian-ai-review-state is-success" role="status" aria-live="polite"><Check size={21} aria-hidden="true" /><div><strong>بررسی هوشمند کامل شد</strong><small>{statusMessage}</small></div><button type="button" onClick={() => void runSmartReview()}>بررسی دوباره</button></div>}
      {statusMessage && phase === "suggestions" && <p className="persian-ai-live-message" role="status" aria-live="polite">{statusMessage}</p>}
      <p className="persian-corrections-privacy">{phase === "idle" ? "محلی · متن ارسال نمی‌شود" : "هوشمند · فقط پس از تأیید شما"}</p>
    </section>
  );
}
