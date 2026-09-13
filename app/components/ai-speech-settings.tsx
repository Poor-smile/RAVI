"use client";

import "./ai-speech-settings.css";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  Download,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "@/app/icons/material-symbols";
import type {
  ChatGPTModelOption,
  CodexConnectionState,
} from "../ai/types";
import type { AudioModelState, AudioModelTierId } from "../audio/types";
import type { AiPreferences } from "../settings/ai-preferences";
import { ChatGPTConnectControl } from "./chatgpt-connect-control";
import { chatGPTConnection } from "../ai/connection-monitor";

const EMPTY_AUDIO_STATE: AudioModelState = {
  supported: false,
  activeTier: null,
  installState: "idle",
  installTier: null,
  installComponent: null,
  progress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  error: "",
  tiers: [],
};

function formatBytes(value: number) {
  return `${Math.round(value / 1024 / 1024).toLocaleString("fa-IR")} مگابایت`;
}

function tierLabel(id: AudioModelTierId, fallback: string) {
  return id === "accurate" ? "پیشرفته" : fallback;
}

export function AiSpeechSettings({
  preferences,
  onPreferencesChange,
}: {
  preferences: AiPreferences;
  onPreferencesChange: (preferences: AiPreferences) => void;
  onOpenExternal: (url: string) => void;
}) {
  const desktop = typeof window === "undefined" ? undefined : window.raaviDesktop;
  const [connectionState, setConnectionState] =
    useState<CodexConnectionState>("checking");
  const [connectionBusy, setConnectionBusy] = useState<
    "checking" | "login" | "reconnect" | null
  >("checking");
  const [connectionError, setConnectionError] = useState("");
  const [models, setModels] = useState<ChatGPTModelOption[]>([]);
  const [modelsBusy, setModelsBusy] = useState(true);
  const [modelError, setModelError] = useState("");
  const [audioState, setAudioState] = useState<AudioModelState>(EMPTY_AUDIO_STATE);
  const [audioBusyTier, setAudioBusyTier] = useState<AudioModelTierId | null>(null);

  const refreshConnection = async () => {
    if (!desktop?.getCodexConnectionStatus) {
      setConnectionState("unavailable");
      setConnectionBusy(null);
      return;
    }
    setConnectionBusy("checking");
    setConnectionError("");
    try {
      const status = await chatGPTConnection.check();
      setConnectionState(status.state);
    } catch {
      setConnectionState("connection_error");
      setConnectionError("اتصال ChatGPT بررسی نشد؛ اینترنت را بررسی و دوباره تلاش کنید.");
    } finally {
      setConnectionBusy(null);
    }
  };

  const refreshModels = async () => {
    if (!desktop?.getCodexModels) {
      setModels([]);
      setModelsBusy(false);
      return;
    }
    setModelsBusy(true);
    setModelError("");
    try {
      const catalog = await desktop.getCodexModels();
      setModels(catalog.models);
      const selectedStillAvailable = catalog.models.some(
        (model) => model.id === preferences.model,
      );
      if (!selectedStillAvailable) {
        onPreferencesChange({ model: catalog.defaultModel ?? "" });
      }
    } catch (error) {
      setModels([]);
      const detail = error instanceof Error ? error.message : "";
      if (!detail.includes("AUTH_REQUIRED") && !detail.includes("CLI_MISSING")) {
        setModelError("فهرست مدل‌های حساب دریافت نشد؛ از مدل پیش‌فرض ChatGPT استفاده می‌شود.");
      }
    } finally {
      setModelsBusy(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void refreshConnection();
      void refreshModels();
    });
    if (desktop?.getAudioModelState) {
      void desktop.getAudioModelState().then(setAudioState).catch(() => {});
    }
    const unsubscribe = desktop?.onAudioLocalEvent?.((event) => {
      if (event.type === "model") setAudioState(event.state);
    });
    return () => unsubscribe?.();
    // The preload bridge is frozen for the window lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => chatGPTConnection.subscribe(status => {
    setConnectionState(status.state);
    if (status.state === "connected") setConnectionError("");
  }), []);

  useEffect(() => {
    if (connectionState === "connected") queueMicrotask(() => void refreshModels());
    // Fetch the account's models when a connection is detected in any view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState]);

  const reconnect = async () => {
    if (!desktop?.resetCodexConnection || !desktop.startCodexLogin) return;
    if (
      !window.confirm(
        "اتصال فعلی ChatGPT قطع و صفحهٔ ورود دوباره باز شود؟ فایل‌ها، مدل‌های گفتاری و تنظیمات دیگر باقی می‌مانند.",
      )
    ) {
      return;
    }
    setConnectionBusy("reconnect");
    setConnectionError("");
    try {
      const reset = await desktop.resetCodexConnection();
      setConnectionState(reset.state);
      if (reset.state === "cli_missing") {
        setConnectionError("ابزار اتصال ChatGPT روی سیستم پیدا نشد.");
        return;
      }
      const loginResult = await desktop.startCodexLogin();
      if (!loginResult.started) {
        setConnectionState(loginResult.state);
        setConnectionError("اتصال قطع شد، اما ورود دوباره شروع نشد؛ دکمهٔ ورود را بزنید.");
        return;
      }
      chatGPTConnection.trackLogin();
      setConnectionState("auth_waiting");
    } catch {
      setConnectionState("connection_error");
      setConnectionError("اتصال دوباره کامل نشد؛ ChatGPT را ببندید و دوباره تلاش کنید.");
    } finally {
      setConnectionBusy(null);
    }
  };

  const installTier = async (id: AudioModelTierId) => {
    if (!desktop?.installAudioModel) return;
    setAudioBusyTier(id);
    try {
      setAudioState(await desktop.installAudioModel(id));
    } finally {
      setAudioBusyTier(null);
    }
  };

  const deleteTier = async (id: AudioModelTierId) => {
    if (!desktop?.deleteAudioModel) return;
    if (!window.confirm("این مدل گفتار از همین دستگاه حذف شود؟")) return;
    setAudioBusyTier(id);
    try {
      setAudioState(await desktop.deleteAudioModel(id));
    } finally {
      setAudioBusyTier(null);
    }
  };

  const connected = connectionState === "connected";
  const selectedModel = models.find((model) => model.id === preferences.model);

  return (
    <div className="ai-speech-settings">
      <section className="ai-settings-intro" aria-labelledby="chatgpt-connection-title">
        <div>
          <BrainCircuit size={22} aria-hidden="true" />
          <div>
            <strong id="chatgpt-connection-title">اتصال ChatGPT</strong>
            <p>راوی همهٔ درخواست‌های هوشمند را با حساب ChatGPT شما اجرا می‌کند.</p>
          </div>
        </div>
      </section>

      {!desktop && (
        <p className="ai-settings-notice">
          <ShieldCheck size={18} aria-hidden="true" /> اتصال ChatGPT و نصب مدل گفتار فقط در نسخهٔ دسکتاپ در دسترس است.
        </p>
      )}
      {connectionError && (
        <p className="ai-settings-error" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />{connectionError}
        </p>
      )}

      <article className={`chatgpt-connection is-${connectionState}`}>
        <ChatGPTConnectControl state={connectionState} />
        <div className="ai-engine-actions">
          <button type="button" onClick={() => void refreshConnection()} disabled={connectionBusy !== null}>
            <RefreshCw size={16} aria-hidden="true" /> بررسی دوباره
          </button>
          {connected && desktop?.resetCodexConnection && <button className="is-danger" type="button" disabled={connectionBusy !== null} onClick={() => void reconnect()}>
            {connectionBusy === "reconnect" ? "در حال اتصال دوباره…" : "قطع و اتصال دوباره"}
          </button>}
        </div>
        <label className="chatgpt-model-picker">
          <span>مدل ChatGPT</span>
          <select
            dir="ltr"
            value={preferences.model}
            disabled={!connected || modelsBusy || models.length === 0}
            onChange={(event) => onPreferencesChange({ model: event.target.value })}
            aria-describedby="chatgpt-model-detail"
          >
            {modelsBusy ? (
              <option value="">در حال دریافت مدل‌های حساب…</option>
            ) : models.length ? (
              <>
                <option value="">مدل پیشنهادی ChatGPT</option>
                {models.map((model) => (
                  <option value={model.id} key={model.id}>
                    {model.displayName}{model.isDefault ? " — پیشنهادی" : ""}
                  </option>
                ))}
              </>
            ) : (
              <option value="">مدل پیش‌فرض ChatGPT</option>
            )}
          </select>
          <small id="chatgpt-model-detail">
            {selectedModel?.description || "فهرست مدل‌ها مستقیماً از حساب متصل شما دریافت می‌شود."}
          </small>
        </label>
        {modelError && <p className="chatgpt-model-error" role="alert">{modelError}</p>}
      </article>

      <p className={`ai-default-summary${connected ? " is-ready" : ""}`}>
        {connected ? (
          <><Check size={16} aria-hidden="true" /> راوی هوشمند آماده است و با {selectedModel?.displayName || "مدل پیش‌فرض ChatGPT"} اجرا می‌شود.</>
        ) : (
          <><AlertTriangle size={16} aria-hidden="true" /> برای استفاده از راوی هوشمند، اتصال ChatGPT را کامل کنید.</>
        )}
      </p>

      <section className="speech-model-settings" aria-labelledby="speech-model-settings-title">
        <header>
          <div>
            <Download size={21} aria-hidden="true" />
            <div><h3 id="speech-model-settings-title">مدل گفتار محلی</h3><p>مدل انتخابی روی سیستم شما نصب می‌شود و فایل صوتی برای تبدیل از دستگاه خارج نمی‌شود.</p></div>
          </div>
          {audioState.activeTier && <span>فعال: {tierLabel(audioState.activeTier, audioState.tiers.find((tier) => tier.id === audioState.activeTier)?.label ?? "")}</span>}
        </header>

        <div className="speech-tier-list" role="list" aria-label="سطح مدل گفتار">
          {audioState.tiers.map((tier) => {
            const active = audioState.activeTier === tier.id;
            const installing = audioState.installTier === tier.id && audioState.installState !== "idle";
            return (
              <article className={`speech-tier-row${active ? " is-active" : ""}${tier.recommended ? " is-recommended" : ""}`} key={tier.id} role="listitem">
                <div className="speech-tier-copy">
                  <div><strong>{tierLabel(tier.id, tier.label)}</strong>{tier.recommended && <span>پیشنهاد راوی</span>}</div>
                  <p>{tier.suitableFor}</p>
                  <small>{formatBytes(tier.sizeBytes)} · {tier.detail}</small>
                </div>
                <div className="speech-tier-action">
                  {installing && (
                    <div className="speech-tier-progress" role="status">
                      <span>{Math.round(audioState.progress * 100).toLocaleString("fa-IR")}٪</span>
                      <progress max={1} value={audioState.progress} aria-label={`پیشرفت نصب مدل ${tierLabel(tier.id, tier.label)}`} />
                    </div>
                  )}
                  {tier.installed ? (
                    <>
                      <button type="button" disabled={active || audioBusyTier !== null} onClick={() => void installTier(tier.id)}>{active ? "فعال" : "فعال‌کردن"}</button>
                      <button className="is-icon" type="button" disabled={audioBusyTier !== null || installing} onClick={() => void deleteTier(tier.id)} aria-label={`حذف مدل ${tierLabel(tier.id, tier.label)}`}><Trash2 size={16} aria-hidden="true" /></button>
                    </>
                  ) : (
                    <button type="button" disabled={!audioState.supported || installing || audioBusyTier !== null} onClick={() => void installTier(tier.id)}>
                      <Download size={15} aria-hidden="true" /> {installing ? "در حال نصب…" : "دانلود و نصب"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {!audioState.tiers.length && <p className="ai-settings-empty">مدل‌های گفتار در نسخهٔ دسکتاپ نمایش داده می‌شوند.</p>}
        </div>
        {audioState.installState === "error" && <p className="ai-settings-error" role="alert"><AlertTriangle size={18} aria-hidden="true" />{audioState.error || "نصب مدل کامل نشد؛ دوباره تلاش کنید."}</p>}
      </section>
    </div>
  );
}
