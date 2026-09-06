"use client";

import { BrainCircuit, Check, Download, LoaderCircle, Pause, PlayArrow, Trash2 } from "../icons/material-symbols";
import { useEffect, useRef, useState } from "react";
import type { CodexConnectionState } from "../ai/types";
import type { TtsEngineId, TtsModelState } from "../tts/types";
import { SpeakerIcon } from "./reading-listen-toolbar";

function formatBytes(value: number) {
  if (value <= 0) return "بدون دانلود";
  const megabytes = Math.max(0, value) / 1_000_000;
  if (megabytes < 1) return "کمتر از ۱ مگابایت";
  return `${megabytes.toLocaleString("fa-IR", {
    maximumFractionDigits: megabytes < 1 ? 2 : 0,
  })} مگابایت`;
}

function friendlyActionError(cause: unknown) {
  const rawMessage = cause instanceof Error ? cause.message : "";
  const raw = rawMessage.replace(
    /^Error invoking remote method '[^']+':\s*Error:\s*/iu,
    "",
  );
  const value = raw.toLocaleLowerCase("en-US");
  const looksLikeSafePersianCopy = raw.length <= 280 &&
    !/[\r\n]|traceback|(?:^|\s)at\s|[a-z]:\\|errno|spawn/iu.test(raw) &&
    /نصب|موتور|دانلود|دریافت|اینترنت|سرور|فایل|فضا|اجازه/u.test(raw);
  if (looksLikeSafePersianCopy) return raw;
  if (/network|fetch|econn|etime|socket|dns/u.test(value)) {
    return "ارتباط با موتور محلی برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید.";
  }
  return "این کار کامل نشد. راوی را یک بار ببندید و باز کنید، سپس دوباره تلاش کنید.";
}

function verificationLabel(value: TtsModelState["engines"][number]["verification"]) {
  if (value === "verified") return "یکپارچگی تأییدشده";
  if (value === "invalid") return "فایل ناقص یا نامعتبر؛ دریافت دوباره لازم است";
  if (value === "outdated") return "نسخهٔ تازه‌تر در دسترس است";
  return "هنوز دریافت نشده";
}

function directorConnectionCopy(state: CodexConnectionState) {
  if (state === "connected") return "ChatGPT متصل است؛ کارگردان برای خوانش بعدی آماده است.";
  if (state === "checking") return "در حال بررسی اتصال ChatGPT…";
  return "اگر ChatGPT در دسترس نباشد، راوی بی‌وقفه با آماده‌سازی محلی ادامه می‌دهد.";
}

export function ReadingTtsSettings({
  smartNarration,
  onSmartNarrationChange,
}: {
  smartNarration: boolean;
  onSmartNarrationChange: (value: boolean) => void;
}) {
  const [state, setState] = useState<TtsModelState | null>(null);
  const [directorConnection, setDirectorConnection] =
    useState<CodexConnectionState>("checking");
  const [busy, setBusy] = useState<TtsEngineId | null>(null);
  const [previewing, setPreviewing] = useState<TtsEngineId | null>(null);
  const [error, setError] = useState("");
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const refresh = async () => {
    const next = await window.raaviDesktop?.getTtsModelState?.();
    if (next) setState(next);
  };

  useEffect(() => {
    let cancelled = false;
    const desktop = window.raaviDesktop;
    if (!desktop?.getCodexConnectionStatus) {
      void Promise.resolve().then(() => {
        if (!cancelled) setDirectorConnection("unavailable");
      });
    } else {
      void desktop.getCodexConnectionStatus().then(
        (next) => {
          if (!cancelled) setDirectorConnection(next.state);
        },
        () => {
          if (!cancelled) setDirectorConnection("connection_error");
        },
      );
    }
    void window.raaviDesktop?.getTtsModelState?.().then((next) => {
      if (!cancelled) setState(next);
    });
    const unsubscribe = window.raaviDesktop?.onTtsLocalEvent?.((event) => {
      if (event.type === "model") {
        setState(event.state);
        if (event.state.installState !== "error") setError("");
      }
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const run = async (engine: TtsEngineId, action: () => Promise<unknown>) => {
    setBusy(engine);
    setError("");
    try { await action(); await refresh(); }
    catch (cause) { setError(friendlyActionError(cause)); }
    finally { setBusy(null); }
  };

  const preview = async (engine: TtsEngineId) => {
    setPreviewing(engine);
    setError("");
    previewAudioRef.current?.pause();
    try {
      const result = await window.raaviDesktop?.previewTtsEngine?.(engine);
      if (!result) throw new Error("پیش‌نمایش در نسخهٔ دسکتاپ در دسترس است.");
      const audio = new Audio(result.source);
      previewAudioRef.current = audio;
      audio.addEventListener("ended", () => setPreviewing(null), { once: true });
      await audio.play();
    } catch (cause) {
      setPreviewing(null);
      setError(friendlyActionError(cause));
    }
  };

  if (typeof window === "undefined" || !window.raaviDesktop?.getTtsModelState) {
    return (
      <section className="settings-card reading-settings-section reading-tts-settings" aria-labelledby="reading-tts-title">
        <div className="settings-card-heading">
          <h3 id="reading-tts-title">شنیدن متن</h3>
          <p>صدا روی همین دستگاه ساخته می‌شود و موتورهای نصب‌شده بدون اینترنت هم کار می‌کنند.</p>
        </div>
        <p className="reading-tts-desktop-note">دانلود موتور شنیدن در نسخهٔ دسکتاپ راوی در دسترس است.</p>
      </section>
    );
  }

  return (
    <section className="settings-card reading-settings-section reading-tts-settings" aria-labelledby="reading-tts-title">
      <div className="settings-card-heading">
        <h3 id="reading-tts-title">شنیدن متن</h3>
        <p>صدا روی همین دستگاه ساخته می‌شود و موتورهای نصب‌شده بدون اینترنت هم کار می‌کنند.</p>
      </div>
      <div className={`reading-narration-director is-${directorConnection}`}>
        <span className="reading-narration-director-icon" aria-hidden="true">
          <BrainCircuit size={19} />
        </span>
        <div className="reading-narration-director-copy">
          <strong>کارگردان هوشمند فارسی</strong>
          <p>
            پیش از ساخت صدا، یک نسخهٔ موقت را برای تلفظ، اعراب و مکث بهتر آماده می‌کند؛
            متن اصلی سند هرگز تغییر نمی‌کند.
          </p>
          <small id="reading-narration-director-status">
            {directorConnectionCopy(directorConnection)}
          </small>
          <small className="reading-narration-director-privacy">
            با فعال‌سازی، فقط بخش‌های خواندنی متن برای پردازش به اتصال ChatGPT شما فرستاده می‌شود.
          </small>
        </div>
        <button
          type="button"
          className="settings-switch"
          role="switch"
          aria-label="کارگردان هوشمند فارسی"
          aria-describedby="reading-narration-director-status"
          aria-checked={smartNarration}
          onClick={() => onSmartNarrationChange(!smartNarration)}
        >
          <strong>{smartNarration ? "فعال" : "غیرفعال"}</strong>
          <span className="settings-switch-track" aria-hidden="true">
            <span />
          </span>
        </button>
      </div>
      {state?.engines.map((engine) => {
        const installing = state.installEngine === engine.id && state.installState !== "idle" && state.installState !== "error";
        const selected = state.activeEngine === engine.id && engine.installed;
        return (
          <div className={`reading-tts-engine ${selected ? "is-selected" : ""}`} key={engine.id}>
            <div className="reading-tts-engine-copy">
              <span className="reading-tts-engine-icon"><SpeakerIcon size={19} /></span>
              <span>
                <strong>{engine.label}</strong>
                <small>{engine.description}</small>
                <small>نسخهٔ {engine.version} · {engine.license}</small>
                {engine.restriction && (
                  <small className="reading-tts-license-note">{engine.restriction}</small>
                )}
                <small className={`reading-tts-verification is-${engine.verification}`}>
                  {verificationLabel(engine.verification)}
                  {engine.checksum && <> · <span title={`SHA-256: ${engine.checksum}`}>SHA-256 {engine.checksum.slice(0, 10)}…</span></>}
                </small>
              </span>
            </div>
            <dl className="reading-tts-size-breakdown" aria-label={`جزئیات حجم دریافت ${engine.label}`}>
              <div><dt>فایل اصلی مدل</dt><dd>{formatBytes(engine.sizeBreakdown.primaryModelBytes)}</dd></div>
              <div><dt>فایل‌های همراه</dt><dd>{formatBytes(engine.sizeBreakdown.supportFilesBytes)}</dd></div>
              <div><dt>موتور و کتابخانه‌ها</dt><dd>{formatBytes(engine.sizeBreakdown.runtimeBytes)}</dd></div>
              <div><dt>Python مشترک</dt><dd>{formatBytes(engine.sizeBreakdown.sharedPythonBytes)}</dd></div>
              <div className="is-total">
                <dt>دانلود موردنیاز اکنون</dt>
                <dd>{engine.installed ? "نصب شده" : formatBytes(engine.requiredDownloadBytes)}</dd>
                <small>کامل اولیه: {formatBytes(engine.downloadBytes)}</small>
              </div>
            </dl>
            {installing && (
              <div className="reading-tts-progress" role="status" aria-live="polite">
                <span><span style={{ width: `${Math.round(state.progress * 100)}%` }} /></span>
                <small>{
                  state.installState === "warming"
                    ? "در حال آماده‌سازی استفادهٔ آفلاین…"
                    : state.installState === "installing"
                      ? "در حال نصب موتور محلی؛ این مرحله ممکن است چند دقیقه طول بکشد…"
                      : state.downloadedBytes <= 0
                        ? "در حال برقراری اتصال امن…"
                        : `${Math.max(1, Math.round(state.progress * 100)).toLocaleString("fa-IR")}٪`
                }</small>
              </div>
            )}
            <div className="reading-tts-engine-actions">
              {!engine.installed ? (
                state.installEngine === engine.id && state.installState === "paused" ? (
                  <button type="button" onClick={() => void run(engine.id, async () => window.raaviDesktop!.resumeTtsEngineInstall!())}>
                    <PlayArrow size={17} aria-hidden="true" /> ادامهٔ دریافت
                  </button>
                ) : installing ? (
                  <button type="button" onClick={() => void run(engine.id, async () => window.raaviDesktop!.pauseTtsEngineInstall!())} disabled={state.installState !== "downloading"}>
                    {state.installState === "downloading" ? <Pause size={17} aria-hidden="true" /> : <LoaderCircle className="is-spinning" size={17} aria-hidden="true" />}
                    {state.installState === "downloading" ? "توقف" : "در حال نصب"}
                  </button>
                ) : (
                  <button className="is-primary" type="button" onClick={() => void run(engine.id, async () => window.raaviDesktop!.installTtsEngine!(engine.id))} disabled={busy !== null}>
                    <Download size={17} aria-hidden="true" /> {state.installEngine === engine.id && state.installState === "error" ? "تلاش دوباره" : "دریافت"}
                  </button>
                )
              ) : (
                <>
                  <button type="button" onClick={() => void preview(engine.id)} disabled={previewing !== null}>
                    {previewing === engine.id ? <LoaderCircle className="is-spinning" size={17} aria-hidden="true" /> : <PlayArrow size={17} aria-hidden="true" />}
                    شنیدن نمونه
                  </button>
                  <button className={selected ? "is-selected" : ""} type="button" onClick={() => void run(engine.id, async () => window.raaviDesktop!.selectTtsEngine!(engine.id))} disabled={selected || busy !== null}>
                    {selected && <Check size={16} aria-hidden="true" />}{selected ? "انتخاب‌شده" : "انتخاب"}
                  </button>
                  <button className="is-danger" type="button" onClick={() => void run(engine.id, async () => window.raaviDesktop!.deleteTtsEngine!(engine.id))} disabled={busy !== null} aria-label={`حذف ${engine.label}`} title="حذف فایل‌های محلی موتور">
                    <Trash2 size={16} aria-hidden="true" /> حذف
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
      {!state && <p className="reading-tts-desktop-note"><LoaderCircle className="is-spinning" size={17} aria-hidden="true" /> در حال بررسی موتورهای محلی…</p>}
      {state && !state.supported && <p className="settings-inline-error">نصب خودکار فعلاً برای Windows 64-bit آماده است.</p>}
      {(error || state?.error) && (
        <p className="settings-inline-error" role="alert">
          {friendlyActionError(new Error(error || state?.error || ""))}
        </p>
      )}
    </section>
  );
}
