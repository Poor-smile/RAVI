"use client";

import {
  AlertTriangle,
  Check,
  FolderOpen,
  LoaderCircle,
} from "@/app/icons/material-symbols";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type {
  BackupProviderConnections,
  BackupProviderId,
  BackupStatus,
} from "../backup/policy";
import {
  chatGPTStateFromConnection,
  firstRunProviderSelection,
  type FirstRunChatGPTState,
  type FirstRunProviderState,
} from "../first-run-state";
import { useModalFocus } from "./accessible-modal";
import { ChatGPTConnectControl } from "./chatgpt-connect-control";
import { ChatGPTIcon } from "./chatgpt-icon";
import { chatGPTConnection } from "../ai/connection-monitor";

export const FIRST_RUN_STORAGE_KEY = "raavi:first-run-onboarding:v1";
const CHATGPT_PREVIEW_STATES: readonly FirstRunChatGPTState[] = [
  "checking",
  "cli_missing",
  "auth_required",
  "auth_waiting",
  "connected",
  "connection_error",
];

function initialChatGPTState(): FirstRunChatGPTState {
  if (typeof window === "undefined") return "checking";
  if (window.raaviDesktop?.getCodexConnectionStatus) return "checking";
  const preview = new URLSearchParams(window.location.search).get("onboardingChatGPT");
  return CHATGPT_PREVIEW_STATES.includes(preview as FirstRunChatGPTState)
    ? (preview as FirstRunChatGPTState)
    : "auth_required";
}

type FirstRunStep = 1 | 2 | 3 | 4;

const PROMPTS = [
  "خلاصه‌سازی کوتاه",
  "ساده‌نویسی برای مخاطب عمومی",
  "تغییر لحن",
  "ساخت خلاصهٔ مدیریتی",
  "پیشنهاد عنوان بهتر",
  "ترجمه به فارسی",
  "ترجمه به انگلیسی",
  "لحن رسمی",
  "لحن دوستانه",
  "استخراج نکات کلیدی",
  "بازنویسی روان",
  "پیشنهاد زیرعنوان",
] as const;

const PROVIDERS: ReadonlyArray<{
  id: BackupProviderId;
  name: string;
  description: string;
  logo: string;
  recommended?: boolean;
}> = [
  {
    id: "proton-drive",
    name: "Proton Drive",
    description: "فضای خصوصی با رمزنگاری سرتاسری",
    logo: "/brands/proton/proton-drive.svg",
    recommended: true,
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "ساده و سریع با فضای حساب Google شما",
    logo: "/brands/google/google-drive-2026.svg",
  },
];

const STEP_TRANSITION = {
  type: "spring" as const,
  stiffness: 310,
  damping: 34,
  mass: 0.84,
};

function FirstRunProgress({ step }: { step: FirstRunStep }) {
  const visibleStep = Math.min(step, 3);
  return (
    <div className="first-run-progress" aria-label={`مرحلهٔ ${visibleStep.toLocaleString("fa-IR")} از ۳`}>
      {[1, 2, 3].map((item) => (
        <span className="first-run-progress__track" key={item}>
          <motion.span
            className="first-run-progress__fill"
            initial={false}
            animate={{ scaleX: item <= visibleStep ? 1 : 0 }}
            transition={{ duration: 0.34, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </span>
      ))}
    </div>
  );
}

function RaaviLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      className={className}
      src="/brand/raavi-logo-transparent-128.png"
      alt=""
      width={128}
      height={128}
      unoptimized
      draggable={false}
    />
  );
}

function MarkdownIcon({ className = "" }: { className?: string }) {
  return (
    <Image
      className={className}
      src="/brand/raavi-markdown-transparent-128.png"
      alt=""
      width={128}
      height={128}
      unoptimized
      draggable={false}
    />
  );
}

function VaultArt({ resume }: { resume: boolean }) {
  return (
    <div className={`first-run-art first-run-art--vault${resume ? " is-resume" : ""}`} aria-hidden="true">
      <Image
        className="first-run-vault-wallpaper"
        src="/brand/onboarding-desktop-wallpaper.jpg"
        alt=""
        width={2780}
        height={1680}
        unoptimized
        priority
      />
      <div className="first-run-dock">
        {["a", "b", "c"].map((key) => <i key={key} />)}
        <span className="first-run-dock__raavi"><RaaviLogo /></span>
        {["d", "e", "f"].map((key) => <i key={key} />)}
      </div>
      <span className="first-run-cursor" />
      <div className="first-run-ambient" />
      <div className="first-run-orbit-ring" />
      <div className="first-run-orbit">
        {[0, 1, 2].map((item) => (
          <span className={`first-run-orbit__item is-${item + 1}`} key={item}>
            <MarkdownIcon />
          </span>
        ))}
      </div>
      <RaaviLogo className="first-run-hero-logo" />
    </div>
  );
}

function AiBackdrop({ resume }: { resume: boolean }) {
  return (
    <div className={`first-run-art first-run-art--ai${resume ? " is-resume" : ""}`} aria-hidden="true">
      <div className="first-run-gradient-base" />
      <i className="first-run-gradient-orb is-blue" />
      <i className="first-run-gradient-orb is-pink" />
      <i className="first-run-gradient-orb is-amber" />
      <div className="first-run-ai-glass" />
      <div className="first-run-ai-pair">
        <RaaviLogo className="first-run-ai-raavi" />
        <span className="first-run-chatgpt-hero"><ChatGPTIcon /></span>
      </div>
      <div className="first-run-ai-leaving-markdown">
        {[0, 1, 2].map((item) => <MarkdownIcon className={`is-${item + 1}`} key={item} />)}
      </div>
      <div className="first-run-prompt-cloud">
        {PROMPTS.map((prompt, index) => (
          <span
            className="first-run-prompt-bubble"
            key={prompt}
            style={{
              "--bubble-delay": `${(index * 0.62).toFixed(2)}s`,
              "--bubble-lane": `${[16, 176, 314, 78][index % 4]}px`,
              "--bubble-duration": `${7.2 + (index % 3) * 0.45}s`,
            } as CSSProperties}
          >
            {prompt}
          </span>
        ))}
      </div>
    </div>
  );
}

function BackupArt({ resume }: { resume: boolean }) {
  return (
    <div className={`first-run-art first-run-art--backup${resume ? " is-resume" : ""}`} aria-hidden="true">
      <div className="first-run-gradient-base" />
      <i className="first-run-gradient-orb is-blue" />
      <i className="first-run-gradient-orb is-pink" />
      <i className="first-run-gradient-orb is-amber" />
      <div className="first-run-cloud-shape">
        <RaaviLogo className="first-run-cloud-raavi" />
        <div className="first-run-cloud-services">
          <span className="first-run-cloud-chatgpt"><ChatGPTIcon /></span>
          <Image src="/brands/google/google-drive-2026.svg" alt="" width={64} height={64} unoptimized />
          <Image src="/brands/proton/proton-drive.svg" alt="" width={64} height={64} unoptimized />
        </div>
      </div>
    </div>
  );
}

function WelcomeArt() {
  return (
    <div className="first-run-art first-run-art--welcome" aria-hidden="true">
      <div className="first-run-welcome-ambient" />
      <div className="first-run-orbit-ring" />
      <div className="first-run-orbit is-welcome">
        {[0, 1, 2].map((item) => (
          <span className={`first-run-orbit__item is-${item + 1}`} key={item}>
            <MarkdownIcon />
          </span>
        ))}
      </div>
      <RaaviLogo className="first-run-hero-logo" />
    </div>
  );
}

function providerStateLabel(state: FirstRunProviderState) {
  if (state === "connecting") return "در حال اتصال";
  if (state === "connected") return "متصل";
  if (state === "selected") return "مقصد بکاپ";
  if (state === "error") return "ناموفق";
  if (state === "disconnected") return "قطع شده";
  return "";
}

function BackupProviderCard({
  provider,
  state,
  onClick,
}: {
  provider: (typeof PROVIDERS)[number];
  state: FirstRunProviderState;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`first-run-provider is-${state}`}
      onClick={onClick}
      disabled={state === "connecting"}
      aria-pressed={state === "selected"}
    >
      <span className="first-run-provider__copy">
        <span className="first-run-provider__title">
          <strong dir="ltr">{provider.name}</strong>
          {provider.recommended ? <em>پیشنهاد راوی</em> : null}
        </span>
        <small>{provider.description}</small>
      </span>
      {providerStateLabel(state) ? (
        <span className={`first-run-provider__status is-${state}`}>
          {state === "connecting" ? <LoaderCircle size={13} /> : state === "error" || state === "disconnected" ? <AlertTriangle size={13} /> : <Check size={13} />}
          {providerStateLabel(state)}
        </span>
      ) : null}
      <Image
        className="first-run-provider__logo"
        src={provider.logo}
        alt=""
        width={64}
        height={64}
        unoptimized
      />
    </button>
  );
}

function stageCopy(step: FirstRunStep, vaultPath: string) {
  if (step === 1) {
    return {
      eyebrow: "مرحلهٔ ۱ از ۳",
      title: "پوشهٔ مخزن را انتخاب کنید",
      description:
        "راوی همهٔ فایل‌های Markdown را از همین پوشه می‌خواند و در آن نگه می‌دارد؛ اگر پشتیبان‌گیری ابری را فعال کنید، همین مخزن به‌صورت خودکار بکاپ می‌شود.",
      selected: vaultPath,
    };
  }
  if (step === 2) {
    return {
      eyebrow: "مرحلهٔ ۲ از ۳ · اختیاری",
      title: "راوی را به ChatGPT متصل کنید",
      description:
        "ورود امن در مرورگر انجام می‌شود؛ بعد از ورود، خودکار به راوی برمی‌گردید.",
      selected: "",
    };
  }
  if (step === 3) {
    return {
      eyebrow: "مرحلهٔ ۳ از ۳ · اختیاری",
      title: "نسخهٔ پشتیبان را کجا نگه داریم؟",
      description:
        "اگر دستگاهتان عوض شد، نوشته‌ها را با چند کلیک برگردانید.",
      selected: "",
    };
  }
  return {
    eyebrow: "آمادهٔ شروع",
    title: "به راوی خوش آمدید",
    description:
      "مخزن آماده است. یک نوشتهٔ تازه بسازید یا فایل Markdown خود را باز کنید.",
    selected: "",
  };
}

export function FirstRunOnboarding({
  open,
  isTopLayer,
  backupStatus,
  initialVaultPath,
  onChooseVault,
  onConnectBackupProvider,
  onSelectBackupProvider,
  onFinish,
}: {
  open: boolean;
  isTopLayer: boolean;
  backupStatus: BackupStatus;
  initialVaultPath?: string;
  onChooseVault: () => Promise<string | null | undefined>;
  onConnectBackupProvider: (providerId: BackupProviderId) => Promise<BackupStatus | void>;
  onSelectBackupProvider: (providerId: BackupProviderId) => Promise<BackupStatus | void>;
  onFinish: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState<FirstRunStep>(1);
  const [direction, setDirection] = useState(1);
  const [visitedSteps, setVisitedSteps] = useState<ReadonlySet<FirstRunStep>>(
    () => new Set(),
  );
  const [vaultPath, setVaultPath] = useState("");
  const [vaultBusy, setVaultBusy] = useState(false);
  const [chatGPTState, setChatGPTState] =
    useState<FirstRunChatGPTState>(initialChatGPTState);
  const initialProviderSelection = useMemo(
    () => firstRunProviderSelection(backupStatus),
    [backupStatus],
  );
  const [providerStates, setProviderStates] = useState<
    Record<BackupProviderId, FirstRunProviderState>
  >(() => initialProviderSelection.states);
  const [selectedProvider, setSelectedProvider] = useState<BackupProviderId | null>(
    () => initialProviderSelection.selectedProvider,
  );

  useModalFocus({
    open,
    isTopLayer,
    containerRef: dialogRef,
    initialFocusRef: firstActionRef,
  });

  useEffect(() => {
    if (!open || chatGPTState !== "checking") return;
    let cancelled = false;
    void chatGPTConnection.check()
      .then((status) => {
        if (!cancelled) setChatGPTState(chatGPTStateFromConnection(status));
      })
      .catch(() => {
        if (!cancelled) setChatGPTState("connection_error");
      });
    return () => {
      cancelled = true;
    };
  }, [chatGPTState, open]);

  useEffect(() => {
    if (!open || !window.raaviDesktop?.getBackupProviderConnections) return;
    let cancelled = false;
    void window.raaviDesktop
      .getBackupProviderConnections()
      .then((connections: BackupProviderConnections) => {
        if (cancelled) return;
        const detected = firstRunProviderSelection(backupStatus, connections);
        setProviderStates(detected.states);
        setSelectedProvider(detected.selectedProvider);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [backupStatus, open]);

  useEffect(() => {
    if (!open) return;
    return chatGPTConnection.subscribe(status => setChatGPTState(chatGPTStateFromConnection(status)));
  }, [open]);

  const effectiveVaultPath = vaultPath || initialVaultPath || "";
  const resume = visitedSteps.has(step);
  const copy = stageCopy(step, effectiveVaultPath);

  const goTo = (next: FirstRunStep, nextDirection: 1 | -1) => {
    setVisitedSteps((current) => {
      const updated = new Set(current);
      updated.add(step);
      return updated;
    });
    setDirection(nextDirection);
    setStep(next);
  };

  const chooseVault = async () => {
    setVaultBusy(true);
    try {
      const selected = await onChooseVault();
      if (selected) setVaultPath(selected);
    } finally {
      setVaultBusy(false);
    }
  };

  const connectProvider = async (providerId: BackupProviderId) => {
    if (providerStates[providerId] === "connecting") return;
    if (providerStates[providerId] === "connected" || providerStates[providerId] === "selected") {
      const status = await onSelectBackupProvider(providerId);
      if (status?.connection.state === "connected") {
        setSelectedProvider(providerId);
        setProviderStates((current) => ({
          ...current,
          "google-drive": current["google-drive"] === "idle" ? "idle" : "connected",
          "proton-drive": current["proton-drive"] === "idle" ? "idle" : "connected",
          [providerId]: "selected",
        }));
      }
      return;
    }
    setProviderStates((current) => ({ ...current, [providerId]: "connecting" }));
    try {
      const status = await onConnectBackupProvider(providerId);
      if (status?.providerId === providerId && status.connection.state === "connected") {
        setSelectedProvider(providerId);
        setProviderStates((current) => ({
          ...current,
          "google-drive": current["google-drive"] === "selected" ? "connected" : current["google-drive"],
          "proton-drive": current["proton-drive"] === "selected" ? "connected" : current["proton-drive"],
          [providerId]: "selected",
        }));
      } else {
        setProviderStates((current) => ({ ...current, [providerId]: "error" }));
      }
    } catch {
      setProviderStates((current) => ({ ...current, [providerId]: "error" }));
    }
  };

  const backupHeading = useMemo(() => {
    const google = providerStates["google-drive"];
    const proton = providerStates["proton-drive"];
    const connecting = google === "connecting" ? "Google Drive" : proton === "connecting" ? "Proton Drive" : "";
    const failed = google === "error" ? "Google Drive" : proton === "error" ? "Proton Drive" : "";
    const other = connecting === "Google Drive" || failed === "Google Drive" ? "Proton Drive" : "Google Drive";
    const otherActive = selectedProvider && selectedProvider !== (connecting === "Google Drive" || failed === "Google Drive" ? "google-drive" : "proton-drive");
    if (connecting && otherActive) {
      return ["در حال اتصال سرویس دوم", `${other} فعال می‌ماند تا ورود ${connecting} کامل شود.`];
    }
    if (failed && otherActive) {
      return [`اتصال ${failed} انجام نشد`, `${other} همچنان فعال است؛ می‌توانید دوباره تلاش کنید.`];
    }
    if (google !== "idle" && proton !== "idle" && selectedProvider) {
      const target = selectedProvider === "google-drive" ? "Google Drive" : "Proton Drive";
      return ["مقصد نسخهٔ پشتیبان را انتخاب کنید", `هر دو سرویس متصل‌اند؛ ${target} به‌عنوان مقصد بکاپ انتخاب شده است.`];
    }
    if (connecting) return [`ورود به ${connecting} را کامل کنید`, "مرورگر باز شده است؛ وارد حساب شوید و دسترسی‌های لازم را تأیید کنید."];
    if (failed) return [`اتصال به ${failed} انجام نشد`, "اینترنت یا دسترسی حساب را بررسی کنید و دوباره تلاش کنید."];
    if (selectedProvider) {
      const target = selectedProvider === "google-drive" ? "Google Drive" : "Proton Drive";
      return [`${target} با موفقیت متصل شد`, "نسخه‌های پشتیبان از این پس به‌صورت خودکار در فضای انتخاب‌شده ذخیره می‌شوند."];
    }
    return [copy.title, copy.description];
  }, [copy.description, copy.title, providerStates, selectedProvider]);

  if (!open) return null;

  return (
    <div className="first-run-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="first-run-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-run-title"
        aria-describedby="first-run-description"
        tabIndex={-1}
      >
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            className="first-run-stage"
            key={step}
            custom={direction}
            variants={{
              enter: (value: number) => ({ x: reduceMotion ? 0 : value > 0 ? 72 : -72, opacity: reduceMotion ? 1 : 0 }),
              center: { x: 0, opacity: 1 },
              exit: (value: number) => ({ x: reduceMotion ? 0 : value > 0 ? -72 : 72, opacity: reduceMotion ? 1 : 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduceMotion ? { duration: 0 } : STEP_TRANSITION}
          >
            {step === 1 ? <VaultArt resume={resume || Boolean(reduceMotion)} /> : step === 2 ? <AiBackdrop resume={resume || Boolean(reduceMotion)} /> : step === 3 ? <BackupArt resume={resume || Boolean(reduceMotion)} /> : <WelcomeArt />}

            <motion.section
              className="first-run-content"
              dir="rtl"
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.055, delayChildren: 0.08 } },
              }}
            >
              <motion.header className="first-run-brand" variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
                <span>راوی</span>
              </motion.header>
              <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
                <FirstRunProgress step={step} />
              </motion.div>
              <motion.p className="first-run-eyebrow" variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
                {copy.eyebrow}
              </motion.p>
              <motion.h1 id="first-run-title" variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                {step === 3 ? backupHeading[0] : copy.title}
              </motion.h1>
              <motion.p id="first-run-description" className="first-run-description" variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                {step === 3 ? backupHeading[1] : copy.description}
              </motion.p>

              <motion.div className="first-run-main-action" variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
                {step === 1 ? (
                  <button
                    ref={firstActionRef}
                    type="button"
                    className={`first-run-action-row first-run-vault-picker${effectiveVaultPath ? " is-selected" : ""}`}
                    onClick={() => void chooseVault()}
                    disabled={vaultBusy}
                  >
                    <span className="first-run-action-row__copy">
                      <strong>{effectiveVaultPath ? "پوشهٔ مخزن انتخاب شده است" : "انتخاب پوشهٔ مخزن"}</strong>
                      <small dir="auto">{effectiveVaultPath || "محل نگه‌داری فایل‌های Markdown را انتخاب کنید"}</small>
                    </span>
                    <span className="first-run-folder-mark" aria-hidden="true">
                      {vaultBusy ? <LoaderCircle className="is-spinning" size={22} /> : effectiveVaultPath ? <Check size={22} /> : <FolderOpen size={22} />}
                    </span>
                  </button>
                ) : step === 2 ? (
                  <ChatGPTConnectControl state={chatGPTState} />
                ) : step === 3 ? (
                  <div className="first-run-provider-list">
                    {PROVIDERS.map((provider) => (
                      <BackupProviderCard
                        key={provider.id}
                        provider={provider}
                        state={providerStates[provider.id]}
                        onClick={() => void connectProvider(provider.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="first-run-ready-summary">
                    <span><Check size={16} aria-hidden="true" /> مخزن آماده شد</span>
                    <small>فایل‌ها به‌صورت محلی ذخیره می‌شوند.</small>
                  </div>
                )}
              </motion.div>

              <motion.footer className="first-run-footer" variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
                {step <= 3 ? (
                  <>
                    <button type="button" className="first-run-button is-quiet" onClick={() => step === 1 ? goTo(2, 1) : step === 2 ? goTo(3, 1) : goTo(4, 1)}>
                      رد کردن
                    </button>
                    <button
                      type="button"
                      className="first-run-button is-primary"
                      disabled={step === 1 ? !effectiveVaultPath : step === 2 ? chatGPTState !== "connected" : !selectedProvider}
                      onClick={() => step === 1 ? goTo(2, 1) : step === 2 ? goTo(3, 1) : goTo(4, 1)}
                    >
                      {step === 3 ? "تأیید و ادامه" : "بعدی"}
                    </button>
                    {step > 1 ? (
                      <button type="button" className="first-run-button is-secondary" onClick={() => goTo((step - 1) as FirstRunStep, -1)}>
                        {step === 3 ? "برگشت" : "قبلی"}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <button type="button" className="first-run-button is-secondary">بازکردن راهنمای کوتاه</button>
                    <button ref={firstActionRef} type="button" className="first-run-button is-primary is-wide" onClick={onFinish}>
                      ورود به راوی
                    </button>
                  </>
                )}
              </motion.footer>
            </motion.section>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
