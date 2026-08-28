"use client";

import "./audio-transcription.css";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  AudioFile,
  Check,
  Download,
  ExpandContent,
  FileText,
  Pause,
  PlayArrow,
  RefreshCw,
  ShieldCheck,
  SpeechToText,
  Spellcheck,
  Stop,
  Trash2,
  X,
} from "@/app/icons/material-symbols";
import { buildLocalStructuredTranscript, suggestAudioContentKind } from "../audio/structure";
import { latestAudioJobForSession } from "../audio/pipeline";
import type {
  AudioCleanupResult,
  AudioContentKind,
  AudioModelState,
  AudioModelTierId,
  AudioStructuredResult,
  AudioTranscriptSegment,
  AudioTranscriptionJob,
} from "../audio/types";
import { MagicWandIcon } from "./magic-wand-trigger";

export type AudioTranscriptionSession = {
  id: string;
  documentPath: string;
  relativePath: string;
  source: string;
  fileName: string;
  durationMs: number;
  blockFrom: number;
  blockTo: number;
};

type PanelPhase = "model" | "transcribing" | "cleaning" | "structured" | "inserted" | "error";
type FailedStage = "transcription" | "cleaning";

const INSERT_SUCCESS_HOLD_MS = 1800;

const KIND_LABELS: Record<AudioContentKind, string> = {
  meeting: "جلسه",
  interview: "مصاحبه",
  lecture: "درس یا سخنرانی",
  "phone-call": "تماس تلفنی",
  "voice-note": "یادداشت صوتی",
  conversation: "گفت‌وگو",
  general: "محتوای عمومی",
};

const JOURNEY_STEPS = [
  { label: "تبدیل گفتار", Icon: AudioFile },
  { label: "بازسازی فارسی", Icon: Spellcheck },
  { label: "پیش‌نمایش سند", Icon: FileText },
] as const;

const JOURNEY_COPY = {
  transcribing: [
    "قطعه‌های صوت را می‌شنوم…",
    "گفتار فارسی را تشخیص می‌دهم…",
    "بخش‌های نامطمئن را نگه می‌دارم…",
  ],
  cleaning: [
    "واژه‌های شنیده‌شده را بازسازی می‌کنم…",
    "جمله‌ها و نشانه‌گذاری را اصلاح می‌کنم…",
    "متن خوانا و ساختاریافته می‌سازم…",
  ],
} as const;

function AudioSmartJourney({ stage, job }: { stage: "transcribing" | "cleaning"; job: AudioTranscriptionJob | null }) {
  const reduceMotion = useReducedMotion();
  const activeIndex = stage === "transcribing" ? 0 : 1;
  const copy = JOURNEY_COPY[stage];

  return (
    <div className="audio-ai-journey" role="status" aria-live="polite">
      <div className="audio-ai-atmosphere" aria-hidden="true">
        <motion.i
          className="audio-ai-sweep"
          initial={reduceMotion ? false : { x: "-145%", opacity: 0 }}
          animate={reduceMotion ? { x: "0%", opacity: 0.16 } : { x: ["-145%", "145%"], opacity: [0, 0.72, 0] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 3.2, ease: [0.16, 1, 0.3, 1], repeat: Infinity, repeatDelay: 0.35 }}
        />
        <i className="audio-ai-glow" />
      </div>
      <div className="audio-ai-mark" aria-hidden="true">
        <motion.span
          animate={reduceMotion ? undefined : { scale: [1, 1.08, 1], opacity: [0.82, 1, 0.82] }}
          transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
        >
          <MagicWandIcon size={23} />
        </motion.span>
      </div>
      <strong>
        {stage === "transcribing"
          ? job?.phase === "paused"
            ? "تبدیل گفتار متوقف شده"
            : "راوی در حال شنیدن فایل است…"
          : "راوی هوشمند متن را بازسازی می‌کند…"}
      </strong>
      <div className="audio-ai-copy" aria-hidden="true">
        {copy.map((text, index) => (
          <motion.span
            key={text}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={reduceMotion ? { opacity: index === 0 ? 1 : 0 } : { opacity: [0, 1, 1, 0] }}
            transition={reduceMotion ? { duration: 0 } : { duration: 6.6, times: [0, 0.08, 0.28, 0.34], delay: index * 2.2, repeat: Infinity }}
          >
            {text}
          </motion.span>
        ))}
      </div>
      <ol className="audio-ai-steps" aria-label="مراحل آماده‌سازی متن">
        {JOURNEY_STEPS.map(({ label, Icon }, index) => {
          const state = index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending";
          return (
            <li className={`is-${state}`} key={label} aria-current={state === "active" ? "step" : undefined}>
              <span>{state === "complete" ? <Check size={16} /> : <Icon size={17} />}</span>
              <small>{label}</small>
            </li>
          );
        })}
      </ol>
      {stage === "transcribing" && job ? (
        <div className="audio-ai-progress">
          <div>
            <span>قطعهٔ {(job.currentChunk + 1).toLocaleString("fa-IR")} از {job.totalChunks.toLocaleString("fa-IR")}</span>
            <b>{Math.round(job.progress * 100).toLocaleString("fa-IR")}٪</b>
          </div>
          <progress max={1} value={job.progress} />
          <small>
            {job.etaSeconds === null
              ? "در حال محاسبهٔ زمان باقی‌مانده…"
              : `حدود ${Math.max(1, Math.ceil(job.etaSeconds / 60)).toLocaleString("fa-IR")} دقیقه باقی مانده`}
          </small>
        </div>
      ) : (
        <p className="audio-ai-privacy"><ShieldCheck size={15} aria-hidden="true" /> فایل صوتی روی سیستم شما می‌ماند؛ فقط رونوشت برای بازسازی استفاده می‌شود.</p>
      )}
    </div>
  );
}

function AudioInsertSuccess() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="audio-insert-success"
      role="status"
      aria-live="polite"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
    >
      <motion.div
        className="audio-insert-success-mark"
        aria-hidden="true"
        initial={reduceMotion ? false : { scale: 0.68, opacity: 0, filter: "blur(7px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: reduceMotion ? 0 : 0.46, ease: [0.16, 1, 0.3, 1] }}
      >
        <Check size={30} />
      </motion.div>
      <motion.strong
        initial={reduceMotion ? false : { y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : 0.12 }}
      >
        متن زیر بلاک صوت درج شد
      </motion.strong>
      <motion.small
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.24, delay: reduceMotion ? 0 : 0.24 }}
      >
        در حال بازگشت به راوی هوشمند…
      </motion.small>
    </motion.div>
  );
}

function formatBytes(value: number) {
  if (!value) return "۰ مگابایت";
  return `${Math.round(value / 1024 / 1024).toLocaleString("fa-IR")} مگابایت`;
}

function modelTierEmphasis(tier: AudioModelTierId) {
  if (tier === "light") return "سریع‌ترین انتخاب";
  if (tier === "balanced") return "تعادل سرعت و دقت";
  return "بیشترین دقت";
}

function installStageTitle(state: AudioModelState) {
  if (state.installState === "paused") return "دانلود متوقف شده است";
  if (state.installState === "error") return "دانلود مدل کامل نشد";
  if (state.installState === "verifying") return "در حال بررسی سلامت مدل";
  if (state.installState === "installing") return "در حال فعال‌سازی مدل";
  if (state.installComponent === "ffmpeg") return "در حال دریافت پیش‌نیاز صوت";
  if (state.installComponent === "engine") return "در حال دریافت موتور گفتار";
  return "در حال دانلود مدل گفتار";
}

function formatClock(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60).toLocaleString("fa-IR")}:${(seconds % 60).toString().padStart(2, "0").replace(/\d/gu, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])}`;
}

function initialModelState(): AudioModelState {
  return { supported: true, activeTier: null, installState: "idle", installTier: null, installComponent: null, progress: 0, downloadedBytes: 0, totalBytes: 0, error: "", tiers: [] };
}

function friendlyCleanupError(cause: unknown) {
  const detail = cause instanceof Error ? cause.message : String(cause ?? "");
  if (/CODEX_CLI_MISSING|راوی هوشمند در دسترس نیست/iu.test(detail)) return "راوی هوشمند روی این سیستم آماده نیست؛ اتصال ChatGPT را بررسی و دوباره تلاش کنید.";
  if (/CODEX_AUTH_REQUIRED/iu.test(detail)) return "ورود با ChatGPT کامل نیست؛ وارد حساب شوید و بازسازی متن را دوباره اجرا کنید.";
  if (/quota|usage limit|rate limit|CODEX_QUOTA_EXHAUSTED/iu.test(detail)) return "سهمیهٔ راوی هوشمند برای این دوره تمام شده است؛ بعداً دوباره تلاش کنید.";
  return detail || "بازسازی متن با راوی هوشمند کامل نشد.";
}

export function AudioTranscriptionPanel({ session, onCleanWithCodex, onInsert, onComplete }: {
  session: AudioTranscriptionSession;
  connectionState: string;
  onCleanWithCodex: (segments: readonly AudioTranscriptSegment[], kind: AudioContentKind) => Promise<AudioCleanupResult>;
  onInsert: (result: AudioStructuredResult, segments: readonly AudioTranscriptSegment[]) => Promise<boolean>;
  onComplete: () => void;
}) {
  const desktop = typeof window === "undefined" ? undefined : window.raaviDesktop;
  const [modelState, setModelState] = useState<AudioModelState>(() => ({ ...initialModelState(), supported: typeof window !== "undefined" && Boolean(window.raaviDesktop?.getAudioModelState) }));
  const [showTiers, setShowTiers] = useState(false);
  const [job, setJob] = useState<AudioTranscriptionJob | null>(null);
  const [phase, setPhase] = useState<PanelPhase>("model");
  const [structured, setStructured] = useState<AudioStructuredResult | null>(null);
  const [error, setError] = useState("");
  const [failedStage, setFailedStage] = useState<FailedStage>("transcription");
  const [fullscreen, setFullscreen] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [pendingTier, setPendingTier] = useState<AudioModelTierId | null>(null);
  const ensuringTranscriptionRef = useRef(false);
  const cleanupJobRef = useRef<string | null>(null);
  const installProgressRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  const uncertain = useMemo(() => job?.segments.filter((item) => item.uncertain) ?? [], [job?.segments]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (phase !== "inserted") return;
    const timeout = window.setTimeout(() => onCompleteRef.current(), INSERT_SUCCESS_HOLD_MS);
    return () => window.clearTimeout(timeout);
  }, [phase]);

  useEffect(() => {
    if (modelState.installState !== "idle") installProgressRef.current?.scrollIntoView({ block: "nearest" });
  }, [modelState.installState]);

  const startTranscription = useCallback(async (tier: AudioModelTierId) => {
    if (!desktop?.startAudioTranscription) return;
    setError("");
    setFailedStage("transcription");
    setStructured(null);
    cleanupJobRef.current = null;
    setPhase("transcribing");
    try {
      const started = await desktop.startAudioTranscription({ documentPath: session.documentPath, relativePath: session.relativePath, fileName: session.fileName, durationMs: session.durationMs, tier });
      setJob(started);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تبدیل گفتار شروع نشد.");
      setPhase("error");
    }
  }, [desktop, session.documentPath, session.durationMs, session.fileName, session.relativePath]);

  const beginSmartCleanup = useCallback(async (completedJob: AudioTranscriptionJob, force = false) => {
    if (!force && cleanupJobRef.current === completedJob.id) return;
    cleanupJobRef.current = completedJob.id;
    const suggestedKind = suggestAudioContentKind(completedJob.segments.map((item) => item.text).join(" "));
    setJob(completedJob);
    setError("");
    setFailedStage("cleaning");
    setPhase("cleaning");
    try {
      const cleaned = await onCleanWithCodex(completedJob.segments, suggestedKind);
      const local = buildLocalStructuredTranscript(completedJob.segments, cleaned.kind);
      const result: AudioStructuredResult = { kind: cleaned.kind, kindLabel: KIND_LABELS[cleaned.kind] ?? local.kindLabel, title: cleaned.title || local.title, markdown: cleaned.markdown };
      setStructured(result);
      setPhase("structured");
      if (desktop?.saveAudioTranscriptionResult) await desktop.saveAudioTranscriptionResult(completedJob.id, result);
    } catch (cause) {
      cleanupJobRef.current = null;
      setError(friendlyCleanupError(cause));
      setPhase("error");
    }
  }, [desktop, onCleanWithCodex]);

  const applyJobState = useCallback((candidate: AudioTranscriptionJob) => {
    setJob(candidate);
    if (candidate.phase === "complete") {
      if (candidate.structured?.markdown) {
        cleanupJobRef.current = candidate.id;
        setStructured(candidate.structured);
        setPhase("structured");
      } else {
        void beginSmartCleanup(candidate);
      }
    } else if (candidate.phase === "error") {
      setFailedStage("transcription");
      setError(candidate.error || "تبدیل گفتار کامل نشد.");
      setPhase("error");
    } else if (candidate.phase === "cancelled") {
      setFailedStage("transcription");
      setError("تبدیل گفتار با درخواست شما لغو شد.");
      setPhase("error");
    } else {
      setPhase("transcribing");
    }
  }, [beginSmartCleanup]);

  const ensureTranscription = useCallback(async (tier: AudioModelTierId) => {
    if (ensuringTranscriptionRef.current) return;
    ensuringTranscriptionRef.current = true;
    try {
      const jobs = await desktop?.listAudioTranscriptionJobs?.(session.documentPath);
      const existing = latestAudioJobForSession(jobs, session.relativePath);
      if (existing && existing.phase !== "cancelled") applyJobState(existing);
      else await startTranscription(tier);
    } finally {
      ensuringTranscriptionRef.current = false;
    }
  }, [applyJobState, desktop, session.documentPath, session.relativePath, startTranscription]);

  useEffect(() => {
    let active = true;
    if (!desktop?.getAudioModelState) return;
    const hydrate = async () => {
      const [state, jobs] = await Promise.all([desktop.getAudioModelState!(), desktop.listAudioTranscriptionJobs?.(session.documentPath)]);
      if (!active) return;
      setModelState(state);
      const existing = latestAudioJobForSession(jobs, session.relativePath);
      if (existing && existing.phase !== "cancelled") {
        setShowTiers(false);
        applyJobState(existing);
      } else if (state.activeTier) {
        setShowTiers(false);
        await ensureTranscription(state.activeTier);
      } else {
        setShowTiers(true);
        setPhase("model");
      }
    };
    void hydrate().catch((cause) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "وضعیت موتور صوتی خوانده نشد.");
      setPhase("error");
    });
    const unsubscribe = desktop.onAudioLocalEvent?.((event) => {
      if (!active) return;
      if (event.type === "model") {
        setModelState(event.state);
        if (event.state.activeTier) {
          setShowTiers(false);
          void ensureTranscription(event.state.activeTier);
        }
        return;
      }
      if (event.job.documentPath === session.documentPath && event.job.relativePath === session.relativePath) applyJobState(event.job);
    });
    return () => { active = false; unsubscribe?.(); };
  }, [applyJobState, desktop, ensureTranscription, session.documentPath, session.relativePath]);

  async function installTier(tier: AudioModelTierId) {
    if (!desktop?.installAudioModel) return;
    setError("");
    setPendingTier(tier);
    setModelState((current) => ({ ...current, installState: "downloading", installTier: tier, installComponent: null, progress: 0, downloadedBytes: 0, totalBytes: current.tiers.find((item) => item.id === tier)?.sizeBytes ?? 0, error: "" }));
    try {
      const state = await desktop.installAudioModel(tier);
      setModelState(state);
      if (state.activeTier) await ensureTranscription(state.activeTier);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "دانلود مدل شروع نشد.";
      setError(detail);
      setModelState((current) => ({ ...current, installState: "error", error: detail }));
    } finally {
      setPendingTier(null);
    }
  }

  const preview = structured;
  const focusedInstall = modelState.installState !== "idle" && Boolean(modelState.installTier);
  const focusedTier = modelState.tiers.find((tier) => tier.id === modelState.installTier);
  const installStep = modelState.installState === "installing" ? 2 : modelState.installState === "verifying" ? 1 : 0;

  return (
    <section className="audio-transcription-panel" aria-labelledby="sidebar-pane-title">
      <div className="audio-panel-context"><span>{session.fileName}</span><small><bdi>Pro</bdi> · پردازش صوت محلی</small></div>

      {phase === "model" && !modelState.supported ? (
        <div className="audio-panel-state is-warning" role="status"><AlertTriangle size={24} aria-hidden="true" /><strong>تبدیل محلی در نسخهٔ دسکتاپ فعال است</strong><p>پخش صوت همچنان کار می‌کند؛ برای تبدیل گفتار از نسخهٔ Electron استفاده کنید.</p></div>
      ) : phase === "model" && (showTiers || !modelState.activeTier) ? (
        <div className="audio-model-setup">
          {focusedInstall && focusedTier ? (
            <section className={`audio-model-install-focus is-${modelState.installState}`} role={modelState.installState === "error" ? "alert" : "status"} ref={installProgressRef}>
              <div className="audio-model-install-mark" aria-hidden="true"><Download size={24} /></div>
              <small>مدل {focusedTier.label}</small>
              <strong>{installStageTitle(modelState)}</strong>
              <p>{focusedTier.suitableFor}</p>

              <ol className="audio-model-install-steps" aria-label="مراحل آماده‌سازی مدل">
                {["دریافت فایل‌ها", "بررسی سلامت", "فعال‌سازی"].map((label, index) => (
                  <li key={label} className={index < installStep ? "is-complete" : index === installStep ? "is-active" : ""}>
                    <span>{index < installStep ? <Check size={14} /> : index + 1}</span>
                    <small>{label}</small>
                  </li>
                ))}
              </ol>

              {modelState.installState !== "error" && (
                <div className="audio-model-install-meter">
                  <div><span>{formatBytes(modelState.downloadedBytes)} از {formatBytes(modelState.totalBytes)}</span><b>{Math.round(modelState.progress * 100).toLocaleString("fa-IR")}٪</b></div>
                  <progress max={1} value={modelState.progress} />
                </div>
              )}

              {modelState.installState === "paused" ? (
                <button className="is-primary audio-model-main-action" type="button" onClick={() => void desktop?.resumeAudioModelInstall?.()}><PlayArrow size={17} aria-hidden="true" /> ادامهٔ دانلود</button>
              ) : modelState.installState === "downloading" ? (
                <button className="audio-model-main-action" type="button" onClick={() => void desktop?.pauseAudioModelInstall?.()}><Pause size={17} aria-hidden="true" /> توقف موقت</button>
              ) : modelState.installState === "error" ? (
                <div className="audio-model-recovery">
                  <p>{error || modelState.error || "اتصال اینترنت را بررسی و دوباره تلاش کنید."}</p>
                  <button className="is-primary" type="button" onClick={() => void installTier(focusedTier.id)}><RefreshCw size={16} aria-hidden="true" /> تلاش دوباره</button>
                  <button type="button" onClick={() => { setError(""); setModelState((current) => ({ ...current, installState: "idle", installTier: null, installComponent: null, error: "" })); }}>انتخاب مدل دیگر</button>
                </div>
              ) : null}

              {modelState.installState !== "error" && <small className="audio-model-background-note">پس از پایان نصب، تبدیل همین فایل خودکار شروع می‌شود؛ می‌توانید در بخش‌های دیگر راوی کار کنید.</small>}
            </section>
          ) : (
            <>
              <header><SpeechToText size={24} aria-hidden="true" /><div><strong>مدل مناسب سیستم شما</strong><p>مدل فقط یک‌بار دانلود می‌شود و تبدیل گفتار روی همین دستگاه انجام می‌گیرد.</p></div></header>
              <div className="audio-model-tiers" role="group" aria-label="سطح مدل گفتار">
                {modelState.tiers.map((tier) => (
                  <article className={tier.recommended ? "is-recommended" : ""} key={tier.id}>
                    <div className="audio-model-tier-heading"><div><strong>{tier.label}</strong><small>{modelTierEmphasis(tier.id)}</small></div>{tier.recommended && <span>پیشنهاد راوی</span>}</div>
                    <p>{tier.suitableFor}</p>
                    <div className="audio-model-tier-meta"><span>{formatBytes(tier.sizeBytes)} دانلود</span><span>{tier.detail}</span></div>
                    <button type="button" className={tier.recommended ? "is-primary" : ""} onClick={() => void installTier(tier.id)} aria-busy={pendingTier === tier.id}>
                      <Download size={16} aria-hidden="true" />{pendingTier === tier.id ? "در حال آماده‌سازی…" : tier.installed ? "انتخاب این مدل" : `دانلود مدل ${tier.label}`}
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      ) : phase === "transcribing" ? (
        <div className="audio-processing-state"><AudioSmartJourney stage="transcribing" job={job} /><p className="audio-recovery-note">قطعه‌های تکمیل‌شده برای بازیابی نگه داشته می‌شوند.</p>{job && <div className="audio-panel-actions">{job.phase === "paused" ? <button type="button" onClick={() => void desktop?.resumeAudioTranscription?.(job.id)}><PlayArrow size={16} aria-hidden="true" /> ادامه</button> : <button type="button" onClick={() => void desktop?.pauseAudioTranscription?.(job.id)}><Pause size={16} aria-hidden="true" /> توقف</button>}<button type="button" onClick={() => void desktop?.cancelAudioTranscription?.(job.id)}><Stop size={16} aria-hidden="true" /> لغو</button></div>}</div>
      ) : phase === "cleaning" ? (
        <div className="audio-processing-state"><AudioSmartJourney stage="cleaning" job={job} /></div>
      ) : phase === "structured" && job && preview ? (
        <div className="audio-structured-result">
          <header><div><small>نوع محتوا · {preview.kindLabel}</small><strong>{preview.title}</strong></div><button type="button" onClick={() => setFullscreen(true)}><ExpandContent size={17} aria-hidden="true" /> نمای تمام‌صفحه</button></header>
          <pre dir="auto">{preview.markdown}</pre>
          {uncertain.length > 0 && <details className="audio-uncertain-details"><summary>{uncertain.length.toLocaleString("fa-IR")} بخش نیازمند شنیدن دوباره</summary><div>{uncertain.map((item) => <button type="button" key={item.id} onClick={() => window.dispatchEvent(new CustomEvent("raavi:play-audio-segment", { detail: { source: session.source, startMs: item.startMs, endMs: item.endMs } }))}><PlayArrow size={16} aria-hidden="true" />{formatClock(item.startMs)} · {item.text || "بخش نامطمئن"}</button>)}</div></details>}
          <button className="audio-insert-action" type="button" disabled={inserting} onClick={async () => { setInserting(true); const inserted = await onInsert(preview, job.segments); setInserting(false); if (inserted) setPhase("inserted"); }}>{inserting ? "در حال درج…" : "درج متن زیر بلاک صوت"}</button>
          <button type="button" onClick={() => void beginSmartCleanup(job, true)}><RefreshCw size={16} aria-hidden="true" /> بازسازی دوباره</button>
        </div>
      ) : phase === "inserted" ? (
        <AudioInsertSuccess />
      ) : phase === "error" ? (
        <div className="audio-panel-state is-error" role="alert"><AlertTriangle size={24} aria-hidden="true" /><strong>{failedStage === "cleaning" ? "بازسازی متن کامل نشد" : "تبدیل گفتار کامل نشد"}</strong><p>{error}</p><button type="button" onClick={() => { if (failedStage === "cleaning" && job?.phase === "complete") void beginSmartCleanup(job, true); else void startTranscription(modelState.activeTier ?? job?.tier ?? "light"); }}><RefreshCw size={16} aria-hidden="true" /> تلاش دوباره</button></div>
      ) : null}

      {modelState.activeTier && phase !== "transcribing" && phase !== "model" && <footer className="audio-model-footer"><span>مدل {modelState.tiers.find((tier) => tier.id === modelState.activeTier)?.label ?? modelState.activeTier}</span><button type="button" onClick={() => { setShowTiers(true); setPhase("model"); }}>تعویض مدل</button><button type="button" onClick={() => { if (window.confirm("مدل فعال حذف شود؟ برای تبدیل فایل بعدی باید آن را دوباره دانلود کنید.")) void desktop?.deleteAudioModel?.(modelState.activeTier!); }} aria-label="حذف مدل فعال"><Trash2 size={15} aria-hidden="true" /></button></footer>}

      {fullscreen && preview && <div className="audio-fullscreen-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFullscreen(false); }}><section className="audio-fullscreen-preview" role="dialog" aria-modal="true" aria-label="پیش‌نمایش تمام‌صفحهٔ رونوشت"><header><strong>{preview.title}</strong><button type="button" onClick={() => setFullscreen(false)} aria-label="بستن پیش‌نمایش تمام‌صفحه"><X size={19} aria-hidden="true" /></button></header><pre dir="auto">{preview.markdown}</pre></section></div>}
    </section>
  );
}
