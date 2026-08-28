"use client";

import "./audio-transcription.css";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  LoaderCircle,
  Pause,
  PlayArrow,
  X,
} from "@/app/icons/material-symbols";
import type { AudioModelState } from "../audio/types";

function formatBytes(value: number) {
  if (!value) return "۰ مگابایت";
  return `${Math.round(value / 1024 / 1024).toLocaleString("fa-IR")} مگابایت`;
}

function stageLabel(state: AudioModelState) {
  if (state.installState === "verifying") return "در حال بررسی سلامت بسته";
  if (state.installState === "installing") return "در حال نصب و پیکربندی";
  if (state.installState === "paused") return "دانلود مدل گفتار متوقف شده";
  if (state.installState === "error") return "دانلود مدل گفتار کامل نشد";
  if (state.installComponent === "ffmpeg") return "در حال دریافت پیش‌نیاز صوت";
  if (state.installComponent === "engine") return "در حال دریافت موتور تبدیل گفتار";
  return "در حال دانلود مدل گفتار";
}

export function AudioModelDownloadIndicator({ hidden = false }: { hidden?: boolean }) {
  const desktop = typeof window === "undefined" ? undefined : window.raaviDesktop;
  const [state, setState] = useState<AudioModelState | null>(null);
  const [completed, setCompleted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const previousStateRef = useRef<AudioModelState["installState"]>("idle");

  useEffect(() => {
    if (!desktop?.getAudioModelState) return;
    void desktop.getAudioModelState().then(setState);
    const unsubscribe = desktop.onAudioLocalEvent?.((event) => {
      if (event.type !== "model") return;
      const wasRunning = previousStateRef.current !== "idle";
      previousStateRef.current = event.state.installState;
      setState(event.state);
      setDismissed(false);
      if (wasRunning && event.state.installState === "idle" && event.state.activeTier) {
        setCompleted(true);
        window.setTimeout(() => setCompleted(false), 6000);
      }
    });
    return () => unsubscribe?.();
  }, [desktop]);

  if (!state || hidden || dismissed) return null;
  const visible = state.installState !== "idle" || completed;
  if (!visible) return null;
  const tierLabel = state.tiers.find((tier) => tier.id === (state.installTier ?? state.activeTier))?.label;
  const percent = Math.round(state.progress * 100);
  const isComplete = completed && state.installState === "idle";

  return (
    <aside
      className={`audio-model-download-indicator${isComplete ? " is-complete" : ""}${state.installState === "error" ? " is-error" : ""}`}
      role={state.installState === "error" ? "alert" : "status"}
      aria-live="polite"
      dir="rtl"
    >
      <div className="audio-model-indicator-icon" aria-hidden="true">
        {isComplete ? (
          <Check size={20} />
        ) : state.installState === "error" ? (
          <AlertTriangle size={20} />
        ) : state.installState === "downloading" ? (
          <Download size={20} />
        ) : (
          <LoaderCircle className="is-spinning" size={20} />
        )}
      </div>
      <div className="audio-model-indicator-body">
        <div>
          <strong>{isComplete ? `مدل ${tierLabel ?? "گفتار"} آماده و فعال شد` : stageLabel(state)}</strong>
          {!isComplete && state.installState !== "error" && (
            <span>{percent.toLocaleString("fa-IR")}٪</span>
          )}
        </div>
        {!isComplete && state.installState !== "error" && (
          <>
            <progress max={1} value={state.progress} aria-label="پیشرفت دانلود مدل صوتی" />
            <small>
              {formatBytes(state.downloadedBytes)} از {formatBytes(state.totalBytes)}
              {tierLabel ? ` · مدل ${tierLabel}` : ""}
            </small>
          </>
        )}
        {state.installState === "error" && <small>{state.error || "برای ادامه دوباره تلاش کنید."}</small>}
      </div>
      <div className="audio-model-indicator-actions">
        {state.installState === "downloading" && (
          <button
            type="button"
            onClick={() => void desktop?.pauseAudioModelInstall?.().then(setState)}
            aria-label="توقف دانلود مدل صوتی"
          >
            <Pause size={18} aria-hidden="true" />
          </button>
        )}
        {state.installState === "paused" && (
          <button
            type="button"
            onClick={() => void desktop?.resumeAudioModelInstall?.().then(setState)}
            aria-label="ادامهٔ دانلود مدل صوتی"
          >
            <PlayArrow size={18} aria-hidden="true" />
          </button>
        )}
        {(isComplete || state.installState === "error") && (
          <button type="button" onClick={() => setDismissed(true)} aria-label="بستن وضعیت دانلود">
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </aside>
  );
}
