"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, RefreshCw } from "@/app/icons/material-symbols";
import { chatGPTConnection } from "../ai/connection-monitor";
import type { CodexConnectionState, CodexSetupProgress } from "../ai/types";
import { ChatGPTIcon } from "./chatgpt-icon";
import "./chatgpt-connect-control.css";

const errors: Record<string, string> = {
  CODEX_PACKAGE_MISMATCH: "صحت فایل دریافت‌شده تأیید نشد؛ دوباره دریافت می‌کنیم.",
  CODEX_DOWNLOAD_FAILED: "دریافت ابزار کامل نشد. اتصال اینترنت را بررسی و دوباره تلاش کنید.",
  CODEX_EXTRACT_FAILED: "نصب کامل نشد. فضای خالی و دسترسی پوشهٔ راوی را بررسی کنید.",
  CODEX_INSTALL_CONFLICT: "فایل نصب قبلی کامل نیست؛ برای بازیابی ابزار با پشتیبانی تماس بگیرید.",
  CODEX_UNSUPPORTED_PLATFORM: "نصب خودکار ابزار اتصال برای این سیستم در دسترس نیست.",
  CODEX_LOGIN_FAILED: "صفحهٔ ورود باز نشد. دوباره تلاش کنید.",
};

export function ChatGPTConnectControl({ state }: { state: CodexConnectionState }) {
  const [progress, setProgress] = useState<CodexSetupProgress>({ phase: "idle" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const desktop = window.raaviDesktop;
    let active = true;
    let eventReceived = false;
    const unsubscribe = desktop?.onCodexSetupProgress?.(value => { eventReceived = true; if (active) setProgress(value); });
    void desktop?.getCodexSetupProgress?.().then(value => { if (active && !eventReceived) setProgress(value); }).catch(() => {});
    const unsubscribeConnection = chatGPTConnection.subscribe(status => {
      if (status.state === "connected") setProgress({ phase: "connected" });
      else setProgress(current =>
        current.phase === "connected" || (current.phase === "authorizing" && status.state === "auth_required")
          ? { phase: "idle" } : current);
    });
    return () => { active = false; unsubscribe?.(); unsubscribeConnection(); };
  }, []);
  const connect = async () => {
    const desktop = window.raaviDesktop;
    if (!desktop?.connectCodex) {
      setProgress({ phase: "error", code: "CODEX_UNSUPPORTED_PLATFORM" });
      return;
    }
    setBusy(true);
    setProgress({ phase: "checking" });
    try {
      const result = await desktop.connectCodex();
      if (result.started) {
        chatGPTConnection.trackLogin();
        setProgress({ phase: "authorizing" });
      } else if (result.state === "connected") {
        await chatGPTConnection.check();
        setProgress({ phase: "connected" });
      } else setProgress({ phase: "error", code: result.code });
    } catch { setProgress({ phase: "error", code: "CODEX_CONNECT_FAILED" }); }
    finally { setBusy(false); }
  };
  const connected = state === "connected";
  const preparing = busy || ["checking", "downloading", "verifying", "installing"].includes(progress.phase);
  const waiting = !connected && (state === "auth_waiting" || progress.phase === "authorizing");
  const failed = !connected && (progress.phase === "error" || state === "connection_error");
  const descriptions: Partial<Record<CodexSetupProgress["phase"], string>> = {
    checking: "در حال بررسی اتصال…",
    downloading: `در حال دریافت ابزار اتصال${progress.percent === undefined ? "" : ` · ${progress.percent.toLocaleString("fa-IR")}٪`}…`,
    verifying: "در حال بررسی صحت فایل…",
    installing: "در حال آماده‌سازی ابزار اتصال…",
  };
  const description = connected ? "راوی هوشمند آماده است."
    : failed ? errors[progress.code || ""] || "اتصال کامل نشد؛ اینترنت را بررسی و دوباره تلاش کنید."
    : preparing ? descriptions[progress.phase] || "در حال آماده‌سازی…"
    : waiting ? "در مرورگر وارد حساب شوید؛ اتصال اینجا خودکار به‌روز می‌شود."
    : "ابزارهای لازم خودکار آماده می‌شوند؛ سپس در مرورگر وارد حساب می‌شوید.";
  return <div className={`chatgpt-connect-control${connected ? " is-connected" : ""}`}>
    <div className="chatgpt-connect-summary"><ChatGPTIcon /><strong>{connected ? "ChatGPT متصل است" : "اتصال به ChatGPT"}</strong></div>
    <p role={failed ? "alert" : "status"} aria-live="polite">{description}</p>
    {progress.phase === "downloading" && !connected && <progress aria-label="دریافت ابزار اتصال" max={100} value={progress.percent} />}
    <button type="button" onClick={() => void connect()} disabled={preparing || connected}>
      {connected ? <Check size={20} aria-hidden="true" /> : preparing ? <LoaderCircle className="is-spinning" size={20} aria-hidden="true" /> : failed || waiting ? <RefreshCw size={20} aria-hidden="true" /> : <ChatGPTIcon />}
      {connected ? "متصل شد" : preparing ? "در حال آماده‌سازی…" : failed ? "تلاش دوباره" : waiting ? "ادامهٔ ورود" : "اتصال به ChatGPT"}
    </button>
  </div>;
}
