"use client";

import {
  AlertCircle,
  Check,
  Download,
  Pause,
  RefreshCw,
  RestartAlt,
  SystemUpdateAlt,
  X,
} from "@/app/icons/material-symbols";
import type { SoftwareUpdateState } from "../software-update/types";

type UpdateActions = {
  onCheck: () => void;
  onDownload: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onInstall: () => void;
  onOpenNotes: () => void;
  onDirectDownload: () => void;
};

function fa(value: number) {
  return Math.max(0, Math.round(value)).toLocaleString("fa-IR");
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const megaBytes = bytes / (1024 * 1024);
  if (megaBytes < 1024) return `${fa(megaBytes)} مگابایت`;
  return `${(megaBytes / 1024).toLocaleString("fa-IR", {
    maximumFractionDigits: 1,
  })} گیگابایت`;
}

function formatVersion(version: string) {
  return version.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function formatCheckedAt(value: string) {
  if (!value) return "هنوز بررسی نشده";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "همین حالا";
  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function progressPercent(state: SoftwareUpdateState) {
  return Math.max(0, Math.min(100, Math.round(state.progress * 100)));
}

function UpdateGlyph({ phase }: { phase: SoftwareUpdateState["phase"] }) {
  if (phase === "ready") return <RestartAlt size={22} aria-hidden="true" />;
  if (phase === "error") return <AlertCircle size={22} aria-hidden="true" />;
  if (phase === "up-to-date") return <Check size={22} aria-hidden="true" />;
  if (phase === "downloading" || phase === "paused") {
    return <Download size={22} aria-hidden="true" />;
  }
  return <SystemUpdateAlt size={22} aria-hidden="true" />;
}

function updateCopy(state: SoftwareUpdateState) {
  const version = formatVersion(state.version || "2.2.1");
  switch (state.phase) {
    case "checking":
      return {
        title: "در حال بررسی به‌روزرسانی",
        body: "نسخهٔ پایدار را از سرور راوی بررسی می‌کنیم.",
        meta: "چند لحظه صبر کنید",
      };
    case "up-to-date":
      return {
        title: "راوی به‌روز است",
        body: `نسخهٔ ${formatVersion(state.currentVersion)} نصب شده و نسخهٔ جدیدتری پیدا نشد.`,
        meta: `آخرین بررسی: ${formatCheckedAt(state.checkedAt)}`,
      };
    case "available":
      return {
        title: `نسخهٔ ${version} آمادهٔ دریافت است`,
        body: "بهبودهای پایداری، راه‌اندازی سریع‌تر و اصلاح تجربهٔ First Run.",
        meta: `${formatBytes(state.totalBytes)} · کانال پایدار`,
      };
    case "downloading":
      return {
        title: `در حال دریافت نسخهٔ ${version}`,
        body: "می‌توانید هنگام دانلود به کارتان ادامه دهید. در صورت قطع میزبان، آینهٔ بعدی خودکار امتحان می‌شود.",
        meta: `${fa(progressPercent(state))}٪ · ${formatBytes(state.downloadedBytes)} از ${formatBytes(state.totalBytes)}`,
      };
    case "paused":
      return {
        title: "دریافت به‌روزرسانی مکث شده",
        body: "فایل دریافت‌شده حفظ شده و ادامهٔ دانلود از همین نقطه انجام می‌شود.",
        meta: `${fa(progressPercent(state))}٪ · ${formatBytes(state.downloadedBytes)} از ${formatBytes(state.totalBytes)}`,
      };
    case "ready":
      return {
        title: "نسخه آمادهٔ نصب است",
        body: state.message || "دانلود و اعتبارسنجی کامل شد. برنامه برای نصب و راه‌اندازی مجدد آماده است.",
        meta: `نسخهٔ ${version} · تأییدشده`,
      };
    case "error":
      return {
        title: "دریافت نسخه کامل نشد",
        body: "در حال حاضر هیچ‌کدام از مسیرهای دانلود در دسترس نیست. اطلاعات شما محفوظ است و برنامه بدون مشکل ادامه می‌دهد.",
        meta: state.message || "اتصال یا میزبان دانلود را بررسی کنید",
      };
    default:
      return {
        title: "به‌روزرسانی راوی",
        body: "نسخه‌های پایدار را خودکار بررسی کنید.",
        meta: `نسخهٔ نصب‌شده: ${formatVersion(state.currentVersion)}`,
      };
  }
}

function PrimaryAction({
  state,
  actions,
  compact = false,
}: {
  state: SoftwareUpdateState;
  actions: UpdateActions;
  compact?: boolean;
}) {
  if (state.phase === "available") {
    return <button type="button" onClick={actions.onDownload}>{compact ? "دانلود" : "دانلود به‌روزرسانی"}</button>;
  }
  if (state.phase === "downloading") {
    return <button type="button" onClick={actions.onPause}><Pause size={16} aria-hidden="true" />مکث</button>;
  }
  if (state.phase === "paused") {
    return <button type="button" onClick={actions.onResume}><Download size={16} aria-hidden="true" />ادامه</button>;
  }
  if (state.phase === "ready") {
    return <button type="button" onClick={actions.onInstall}>{compact ? "نصب و راه‌اندازی مجدد" : "نصب و راه‌اندازی مجدد"}</button>;
  }
  if (state.phase === "error") {
    return <button type="button" onClick={actions.onCheck}><RefreshCw size={16} aria-hidden="true" />تلاش دوباره</button>;
  }
  return <button type="button" onClick={actions.onCheck} disabled={state.phase === "checking"}><RefreshCw size={16} aria-hidden="true" />بررسی دوباره</button>;
}

export function SoftwareUpdateStatusCard({
  state,
  actions,
}: {
  state: SoftwareUpdateState;
  actions: UpdateActions;
}) {
  const copy = updateCopy(state);
  const showsProgress = state.phase === "downloading" || state.phase === "paused";
  return (
    <section
      className={`software-update-card is-${state.phase}`}
      aria-labelledby="software-update-title"
      aria-live="polite"
    >
      <div className="software-update-card__heading">
        <span className="software-update-card__icon"><UpdateGlyph phase={state.phase} /></span>
        <div>
          <h3 id="software-update-title">{copy.title}</h3>
          <p>{copy.body}</p>
        </div>
      </div>
      {showsProgress && (
        <div className="software-update-progress" aria-label={`پیشرفت دانلود ${fa(progressPercent(state))} درصد`}>
          <span style={{ width: `${progressPercent(state)}%` }} />
        </div>
      )}
      <div className="software-update-card__footer">
        <small>{copy.meta}</small>
        <div className="software-update-card__actions">
          {state.phase === "available" && state.notesUrl ? (
            <button type="button" className="is-secondary" onClick={actions.onOpenNotes}>تغییرات نسخه</button>
          ) : null}
          {(state.phase === "downloading" || state.phase === "paused") && (
            <button type="button" className="is-secondary" onClick={actions.onCancel}>لغو دانلود</button>
          )}
          {(state.phase === "error" || (state.phase === "ready" && state.message)) && (
            <button type="button" className="is-secondary" onClick={actions.onDirectDownload}>دانلود مستقیم</button>
          )}
          <PrimaryAction state={state} actions={actions} />
        </div>
      </div>
    </section>
  );
}

export function SoftwareUpdateBanner({
  state,
  actions,
  onClose,
}: {
  state: SoftwareUpdateState;
  actions: UpdateActions;
  onClose: () => void;
}) {
  const copy = updateCopy(state);
  const showsProgress = state.phase === "downloading" || state.phase === "paused";
  return (
    <aside className={`software-update-banner is-${state.phase}`} role="status" aria-live="polite">
      <div className="software-update-banner__heading">
        <button type="button" className="software-update-banner__close" onClick={onClose} aria-label="بستن اعلان به‌روزرسانی"><X size={18} /></button>
        <span className="software-update-banner__icon"><UpdateGlyph phase={state.phase} /></span>
        <div>
          <strong>{
            state.phase === "available" ? "نسخهٔ جدید آماده است" :
            state.phase === "downloading" || state.phase === "paused" ? "در حال دریافت به‌روزرسانی" :
            state.phase === "ready" ? "نسخه آمادهٔ نصب است" : "دانلود کامل نشد"
          }</strong>
          <p>{
            state.phase === "available" ? `راوی ${formatVersion(state.version)} برای دریافت آماده است.` :
            state.phase === "downloading" || state.phase === "paused" ? "می‌توانید هم‌زمان به کارتان ادامه دهید." :
            state.phase === "ready" ? (state.message || "دانلود و اعتبارسنجی با موفقیت کامل شد.") :
            "در حال حاضر مسیر دانلود در دسترس نیست."
          }</p>
        </div>
      </div>
      {showsProgress && (
        <div className="software-update-progress"><span style={{ width: `${progressPercent(state)}%` }} /></div>
      )}
      <div className="software-update-banner__footer">
        <small>{state.phase === "error" ? "اطلاعات شما محفوظ است" : copy.meta}</small>
        <PrimaryAction state={state} actions={actions} compact />
      </div>
    </aside>
  );
}

export type { UpdateActions as SoftwareUpdateActions };
