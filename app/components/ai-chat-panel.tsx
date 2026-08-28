"use client";

import "./ai-chat-panel.css";

import {
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Check,
  ChevronLeft,
  Copy,
  Download,
  FactCheck,
  LockOpen,
  Plus,
  RefreshCw,
  PencilLine,
  ShieldCheck,
  Spellcheck,
  TextCursorInput,
  Undo2,
  Workflow,
} from "@/app/icons/material-symbols";
import {
  AI_WRITING_COMMAND_CATEGORIES,
  filterAiWritingCommands,
  getSuggestedAiWritingCommands,
  type AiWritingCommand,
  type AiWritingCommandCategory,
} from "../ai/writing-commands";
import type {
  AiFrozenContext,
  CodexConnectionState,
  CodexResult,
} from "../ai/types";
import { MagicWandIcon } from "./magic-wand-trigger";

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  replacement?: string | null;
};

export function AiChatPanel({
  context,
  connectionState,
  onCheckConnection,
  onStartLogin,
  onOpenInstallGuide,
  onSend,
  onCopy,
  onReplace,
  onInsertAfter,
  onUndo,
  canUndo,
  onOpenVersions,
}: {
  context: AiFrozenContext;
  connectionState: CodexConnectionState;
  onCheckConnection: () => Promise<void>;
  onStartLogin: () => Promise<void>;
  onOpenInstallGuide: () => void;
  onSend: (prompt: string) => Promise<CodexResult>;
  onCopy: (value: string) => Promise<void>;
  onReplace: (value: string) => Promise<boolean>;
  onInsertAfter: (value: string) => Promise<boolean>;
  onUndo: () => void;
  canUndo: boolean;
  onOpenVersions: () => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const commandMode = prompt.trimStart().startsWith("/");
  const commandQuery = commandMode
    ? prompt.trimStart().slice(1).trimStart()
    : "";
  const commandResults = useMemo(
    () => filterAiWritingCommands(commandQuery),
    [commandQuery],
  );
  const suggestedCommands = useMemo(
    () => getSuggestedAiWritingCommands(context.kind),
    [context.kind],
  );
  const scopeLabel =
    context.kind === "document"
      ? "کل سند"
      : context.kind === "block"
        ? "بلاک فعال"
        : "متن انتخاب‌شده";

  const moveCommandSelection = (nextIndex: number) => {
    setActiveCommandIndex(nextIndex);
    requestAnimationFrame(() => {
      document
        .getElementById(`${inputId}-command-${nextIndex}`)
        ?.scrollIntoView({ block: "nearest" });
    });
  };

  const applySuggestion = async (
    value: string,
    apply: (replacement: string) => Promise<boolean>,
  ) => {
    if (running || applying) return;
    setApplying(true);
    setError("");
    try {
      const applied = await apply(value);
      if (applied) {
        setMessages([]);
        setPrompt("");
      }
    } finally {
      setApplying(false);
      requestAnimationFrame(() =>
        inputRef.current?.focus({ preventScroll: true }),
      );
    }
  };

  const submit = async (value = prompt) => {
    const nextPrompt = value.trim();
    if (!nextPrompt || running || connectionState !== "connected") return;
    setRunning(true);
    setError("");
    setPrompt("");
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", text: nextPrompt },
    ]);
    try {
      const result = await onSend(nextPrompt);
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: result.answer,
          replacement: result.replacement,
        },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error && requestError.message
          ? requestError.message
          : "پاسخ آماده نشد؛ اتصال را بررسی و دوباره تلاش کنید.",
      );
    } finally {
      setRunning(false);
      requestAnimationFrame(() =>
        inputRef.current?.focus({ preventScroll: true }),
      );
    }
  };

  if (connectionState !== "connected") {
    return (
      <section
        className="ai-chat-panel ai-chat-panel--setup"
        aria-labelledby="sidebar-pane-title"
      >
        <div className="ai-context-chip">
          <MagicWandIcon size={16} />
          <span>{context.label}</span>
        </div>
        {connectionState === "checking" ? (
          <SetupState
            icon={
              <RefreshCw className="is-spinning" size={24} aria-hidden="true" />
            }
            title="در حال بررسی اتصال ChatGPT"
            detail="هیچ بخشی از سند در این مرحله ارسال نمی‌شود."
          />
        ) : connectionState === "cli_missing" ? (
          <SetupState
            icon={<Download size={24} aria-hidden="true" />}
            title="ChatGPT متصل نیست"
            detail="در تنظیمات وارد حساب ChatGPT شوید و اتصال را بررسی کنید."
            actionLabel="بازکردن تنظیمات"
            onAction={onOpenInstallGuide}
            secondaryLabel="بررسی دوباره"
            onSecondary={() => void onCheckConnection()}
          />
        ) : connectionState === "auth_required" ? (
          <SetupState
            icon={<LockOpen size={24} aria-hidden="true" />}
            title="ورود با ChatGPT کامل نشده است"
            detail="ورود در مرورگر و از مسیر رسمی OpenAI انجام می‌شود؛ راوی اعتبارنامهٔ شما را نمی‌خواند."
            actionLabel="ادامهٔ ورود"
            onAction={() => void onStartLogin()}
            secondaryLabel="بررسی دوباره"
            onSecondary={() => void onCheckConnection()}
          />
        ) : connectionState === "auth_waiting" ? (
          <SetupState
            icon={
              <RefreshCw className="is-spinning" size={24} aria-hidden="true" />
            }
            title="ورود را در مرورگر کامل کنید"
            detail="بعد از پایان ورود، به راوی برگردید و اتصال را دوباره بررسی کنید."
            actionLabel="بررسی اتصال"
            onAction={() => void onCheckConnection()}
          />
        ) : connectionState === "unavailable" ? (
          <SetupState
            icon={<ShieldCheck size={24} aria-hidden="true" />}
            title="این اتصال در نسخهٔ دسکتاپ فعال است"
            detail="نسخهٔ وب نمی‌تواند به ابزارهای نصب‌شده روی رایانه دسترسی داشته باشد."
          />
        ) : (
          <SetupState
            icon={<RefreshCw size={24} aria-hidden="true" />}
            title="اتصال برقرار نشد"
            detail="وضعیت اتصال ChatGPT را در تنظیمات بررسی کنید."
            actionLabel="تلاش دوباره"
            onAction={() => void onCheckConnection()}
          />
        )}
      </section>
    );
  }

  return (
    <section className="ai-chat-panel" aria-labelledby="sidebar-pane-title">
      <div className="ai-context-chip" title={context.content}>
        <span>{scopeLabel}</span>
        <small>زمینه ثابت</small>
      </div>

      <div className="ai-chat-scroll" aria-live="polite">
        {messages.length === 0 ? (
          <div className="ai-chat-welcome">
            <strong>چه کمکی از من برمی‌آید؟</strong>
            <span>
              درخواستتان را بنویسید یا از پیشنهادهای پایین استفاده کنید.
            </span>
          </div>
        ) : (
          messages.map((message) => (
            <article
              className={`ai-message is-${message.role}`}
              key={message.id}
            >
              <span>{message.role === "user" ? "شما" : "راوی هوشمند"}</span>
              <p dir="auto">{message.text}</p>
              {message.role === "assistant" &&
                message.replacement !== null &&
                message.replacement !== undefined && (
                  <>
                    <pre dir="auto">
                      <code>{message.replacement}</code>
                    </pre>
                    <div className="ai-result-actions">
                      <button
                        type="button"
                        disabled={applying}
                        onClick={() => void onCopy(message.replacement ?? "")}
                      >
                        <Copy size={15} aria-hidden="true" /> کپی
                      </button>
                      {context.kind !== "document" &&
                        context.source !== "table" &&
                        context.blockTo !== undefined && (
                          <button
                            type="button"
                            disabled={applying}
                            onClick={() =>
                              void applySuggestion(
                                message.replacement ?? "",
                                onInsertAfter,
                              )
                            }
                          >
                            <Plus size={15} aria-hidden="true" /> افزودن زیر
                            بلاک
                          </button>
                        )}
                      {context.kind !== "document" && (
                        <button
                          className="is-primary"
                          type="button"
                          disabled={applying}
                          onClick={() =>
                            void applySuggestion(
                              message.replacement ?? "",
                              onReplace,
                            )
                          }
                        >
                          <PencilLine size={15} aria-hidden="true" /> جایگزینی
                          در سند
                        </button>
                      )}
                    </div>
                  </>
                )}
            </article>
          ))
        )}
        {running && (
          <div className="ai-running" role="status">
            <MagicWandIcon size={18} />
            <span>در حال آماده‌کردن پیشنهاد…</span>
            <span className="ai-running-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
        {error && (
          <p className="ai-chat-error" role="alert">
            {error}
          </p>
        )}
        {canUndo && (
          <div className="ai-apply-confirmation" role="status">
            <Check size={16} aria-hidden="true" />
            <span>تغییر اعمال شد</span>
            <button type="button" onClick={onUndo}>
              <Undo2 size={15} aria-hidden="true" /> بازگردانی
            </button>
            <button type="button" onClick={onOpenVersions}>
              نسخه‌ها
            </button>
          </div>
        )}
      </div>

      <div className={`ai-composer-shell ${commandMode ? "is-command-mode" : ""}`}>
        <small className="ai-composer-scope">دامنه: {scopeLabel}</small>

        {messages.length === 0 && !commandMode && (
          <div className="ai-quick-prompts" aria-label="پیشنهادهای آماده">
            {suggestedCommands.map((item) => (
              <AiCommandButton
                command={item}
                key={item.id}
                onClick={() => void submit(item.prompt)}
              />
            ))}
          </div>
        )}

        {commandMode && (
          <div
            className="ai-command-results"
            id={`${inputId}-commands`}
            role="listbox"
            aria-label="فرمان‌های نوشتاری راوی"
          >
            {commandResults.length > 0 ? (
              commandResults.map((item, index) => (
                <AiCommandButton
                  active={index === activeCommandIndex}
                  command={item}
                  id={`${inputId}-command-${index}`}
                  key={item.id}
                  onClick={() => void submit(item.prompt)}
                  onPointerMove={() => setActiveCommandIndex(index)}
                  role="option"
                />
              ))
            ) : (
              <p className="ai-command-empty">فرمانی با این عبارت پیدا نشد.</p>
            )}
          </div>
        )}

        <form
          className="ai-composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (commandMode) {
              const selected = commandResults[activeCommandIndex];
              if (selected) void submit(selected.prompt);
              return;
            }
            void submit();
          }}
        >
          <label className="visually-hidden" htmlFor={inputId}>
            پیام به راوی هوشمند
          </label>
          <textarea
            ref={inputRef}
            id={inputId}
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
              setActiveCommandIndex(0);
            }}
            onKeyDown={(event) => {
              if (commandMode && event.key === "Escape") {
                event.preventDefault();
                setPrompt("");
                return;
              }
              if (commandMode && event.key === "ArrowDown") {
                event.preventDefault();
                moveCommandSelection(
                  Math.min(
                    activeCommandIndex + 1,
                    Math.max(commandResults.length - 1, 0),
                  ),
                );
                return;
              }
              if (commandMode && event.key === "ArrowUp") {
                event.preventDefault();
                moveCommandSelection(Math.max(activeCommandIndex - 1, 0));
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (commandMode) {
                  const selected = commandResults[activeCommandIndex];
                  if (selected) void submit(selected.prompt);
                  return;
                }
                void submit();
              }
            }}
            placeholder="درخواستتان را بنویسید…"
            rows={2}
            dir="rtl"
            disabled={running}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={commandMode}
            aria-controls={commandMode ? `${inputId}-commands` : undefined}
            aria-activedescendant={
              commandMode && commandResults.length > 0
                ? `${inputId}-command-${activeCommandIndex}`
                : undefined
            }
          />
          <div className="ai-composer-hint" aria-live="polite">
            {commandMode ? (
              <span>برای خروج، / را پاک کنید</span>
            ) : (
              <span>
                برای فرمان‌های بیشتر، <kbd>/</kbd> را بزنید
              </span>
            )}
          </div>
          <button
            type="submit"
            aria-label={commandMode ? "اجرای فرمان انتخاب‌شده" : "ارسال پیام"}
            disabled={
              running ||
              (commandMode
                ? commandResults.length === 0
                : !prompt.trim())
            }
          >
            <span aria-hidden="true">↑</span>
          </button>
        </form>
        <p className="ai-chat-privacy">
          <ShieldCheck size={14} aria-hidden="true" /> فقط زمینهٔ نمایش‌داده‌شده
          با تأیید شما ارسال می‌شود.
        </p>
      </div>
    </section>
  );
}

const CATEGORY_ICONS = {
  selection: TextCursorInput,
  document: FactCheck,
  persian: Spellcheck,
  structured: Workflow,
} satisfies Record<AiWritingCommandCategory, typeof TextCursorInput>;

function AiCommandButton({
  command,
  active = false,
  ...buttonProps
}: {
  command: AiWritingCommand;
  active?: boolean;
} & Omit<React.ComponentPropsWithoutRef<"button">, "children">) {
  const CategoryIcon = CATEGORY_ICONS[command.category];
  const categoryLabel = AI_WRITING_COMMAND_CATEGORIES[command.category].label;

  return (
    <button
      {...buttonProps}
      className={`ai-command-button ${active ? "is-active" : ""}`}
      type="button"
      aria-selected={buttonProps.role === "option" ? active : undefined}
      title={`${categoryLabel}: ${command.title}`}
    >
      <CategoryIcon size={18} aria-hidden="true" />
      <span>{command.title}</span>
      <ChevronLeft size={15} aria-hidden="true" />
    </button>
  );
}

function SetupState({
  icon,
  title,
  detail,
  actionLabel,
  secondaryLabel,
  onAction,
  onSecondary,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  actionLabel?: string;
  secondaryLabel?: string;
  onAction?: () => void;
  onSecondary?: () => void;
}) {
  return (
    <div className="ai-setup-state">
      <span className="ai-setup-state__icon">{icon}</span>
      <strong>{title}</strong>
      <p>{detail}</p>
      <div>
        {actionLabel && onAction && (
          <button className="is-primary" type="button" onClick={onAction}>
            {actionLabel}
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button type="button" onClick={onSecondary}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
