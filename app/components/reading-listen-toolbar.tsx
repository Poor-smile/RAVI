"use client";

import { ChevronDown, ChevronUp, LoaderCircle, Pause, PlayArrow, Stop } from "../icons/material-symbols";
import type { ReadingNarrationSpeed } from "../settings/reading-preferences";
import type {
  NarrationPreparation,
  NarrationStatus,
} from "../tts/use-reading-narration";

export function SpeakerIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9.25h3.2L12 5.4v13.2l-4.8-3.85H4v-5.5Z" fill="currentColor" />
      <path d="M15.4 8.15a5.2 5.2 0 0 1 0 7.7M17.85 5.8a8.4 8.4 0 0 1 0 12.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ReadingListenToolbar({
  status,
  preparation,
  engineLabel,
  speed,
  canPrevious,
  canNext,
  onPrevious,
  onPauseOrResume,
  onRetry,
  onNext,
  onSpeedChange,
  onStop,
}: {
  status: NarrationStatus;
  preparation: NarrationPreparation | null;
  engineLabel: string;
  speed: ReadingNarrationSpeed;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onPauseOrResume: () => void;
  onRetry: () => void;
  onNext: () => void;
  onSpeedChange: (speed: ReadingNarrationSpeed) => void;
  onStop: () => void;
}) {
  const paused = status === "paused";
  const ready = status === "ready";
  const preparing = ["directing", "buffering", "preparing"].includes(status);
  const failed = status === "error";
  const shortEngineLabel = engineLabel.split("/")[0]?.trim() || engineLabel;
  return (
    <div className="reading-listen-toolbar" role="region" aria-label="کنترل شنیدن متن" dir="rtl">
      {preparation && (
        <span className="reading-listen-preparation" role="status" aria-live="polite">
          <span className="reading-listen-preparation-copy">
            <strong>
              {preparation.mode === "smart"
                ? "کارگردان هوشمند فارسی"
                : "آماده‌سازی محلی"}
            </strong>
            <small>{preparation.message}</small>
          </span>
          <span
            className={`reading-listen-preparation-progress ${
              preparation.progress === null ? "is-indeterminate" : ""
            }`}
            aria-hidden="true"
          >
            <span
              style={
                preparation.progress === null
                  ? undefined
                  : { width: `${Math.round(preparation.progress * 100)}%` }
              }
            />
          </span>
        </span>
      )}
      <span className="reading-listen-engine" title={engineLabel} aria-label={`${engineLabel}، موتور فعال`}>
        <SpeakerIcon size={17} />
        <span className="reading-listen-engine-full">{engineLabel}</span>
        <span className="reading-listen-engine-short">{shortEngineLabel}</span>
      </span>
      <span className="reading-listen-divider" aria-hidden="true" />
      <button type="button" onClick={onPrevious} disabled={!canPrevious} aria-label="پاراگراف قبل" title="پاراگراف قبل (↑)">
        <ChevronUp size={19} aria-hidden="true" />
      </button>
      <button className={`is-primary ${failed ? "is-retry" : ""}`} type="button" onClick={failed ? onRetry : onPauseOrResume} disabled={preparing} aria-label={failed ? "تلاش دوباره برای خواندن" : paused ? "ادامهٔ خواندن" : ready ? "شروع خواندن" : preparing ? "در حال آماده‌سازی خوانش" : "مکث"} title={failed ? "تلاش دوباره" : paused ? "ادامه" : ready ? "شروع خواندن" : preparing ? "در حال آماده‌سازی" : "مکث"}>
        {preparing ? <LoaderCircle className="is-spinning" size={19} aria-hidden="true" /> : failed || paused || ready ? <PlayArrow size={21} aria-hidden="true" /> : <Pause size={20} aria-hidden="true" />}
      </button>
      <button type="button" onClick={onNext} disabled={!canNext} aria-label="پاراگراف بعد" title="پاراگراف بعد (↓)">
        <ChevronDown size={19} aria-hidden="true" />
      </button>
      <label className="reading-listen-speed">
        <span className="visually-hidden">سرعت خواندن</span>
        <select value={speed} onChange={(event) => onSpeedChange(Number(event.target.value) as ReadingNarrationSpeed)} aria-label="سرعت خواندن">
          <option value={0.75}>۰٫۷۵×</option>
          <option value={1}>۱×</option>
          <option value={1.25}>۱٫۲۵×</option>
          <option value={1.5}>۱٫۵×</option>
          <option value={2}>۲×</option>
        </select>
      </label>
      <span className="reading-listen-divider" aria-hidden="true" />
      <button type="button" onClick={onStop} aria-label="توقف شنیدن" title="توقف و بستن">
        <Stop size={18} aria-hidden="true" />
      </button>
      <span className="visually-hidden" role="status" aria-live="polite">
        {failed ? "خواندن جمله با خطا روبه‌رو شد؛ تلاش دوباره در دسترس است" : preparing ? "در حال آماده‌سازی خوانش" : ready ? "خوانش آماده است" : paused ? "خواندن متوقف شده است" : "در حال خواندن متن"}
      </span>
    </div>
  );
}
