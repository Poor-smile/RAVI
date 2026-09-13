"use client";

import { AlertTriangle, Check, Download, FileText, X } from "@/app/icons/material-symbols";
import { useRef, type ReactNode, type CSSProperties, type RefObject } from "react";
import { AccessibleModal } from "./accessible-modal";

export type ExportFormat = "word" | "pdf";
export type ExportDialogStatus =
  | "preview"
  | "idle"
  | "preparing"
  | "review"
  | "saving"
  | "error"
  | "success";

export type ExportDialogWarning = {
  kind: "diagram" | "image" | "unsupported";
  message: string;
  sourceRange?: { start: number; end: number };
};

type ExportDialogProps = {
  open: boolean;
  isTopLayer: boolean;
  returnFocusRef: RefObject<HTMLElement | null>;
  format: ExportFormat;
  fileName: string;
  status: ExportDialogStatus;
  progress: number;
  progressLabel: string;
  warnings: ExportDialogWarning[];
  reviewConfirmed: boolean;
  error: string;
  resultPath: string;
  canRevealResult: boolean;
  directPdf: boolean;
  preview?: (header: ReactNode, footer: ReactNode) => ReactNode;
  previewReady?: boolean;
  browserPdf?: boolean;
  onFormatChange: (format: ExportFormat) => void;
  onClose: () => void;
  onStart: () => void;
  onContinue: () => void;
  onBack: () => void;
  onRevealResult: () => void;
  onInspectWarning?: (warning: ExportDialogWarning) => void;
  onReviewConfirmationChange: (confirmed: boolean) => void;
};

function pathDirectory(path: string) {
  const normalized = path.replaceAll("\\", " / ");
  const segments = normalized.split(" / ").filter(Boolean);
  return segments.length > 1 ? segments.slice(0, -1).join(" / ") : "Downloads";
}

export function ExportDialog({
  open,
  isTopLayer,
  returnFocusRef,
  format,
  fileName,
  status,
  progress,
  progressLabel,
  warnings,
  reviewConfirmed,
  error,
  resultPath,
  canRevealResult,
  preview,
  previewReady = false,
  browserPdf = false,
  onFormatChange,
  onClose,
  onStart,
  onContinue,
  onBack,
  onRevealResult,
  onInspectWarning,
  onReviewConfirmationChange,
}: ExportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const wordOptionRef = useRef<HTMLButtonElement>(null);
  const pdfOptionRef = useRef<HTMLButtonElement>(null);
  const reviewConfirmationRef = useRef<HTMLInputElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const revealRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const busy = status === "preparing" || status === "saving";
  const reviewConfirmationRequired = status === "review" && warnings.length > 0;
  const boundedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const reviewCountLabel =
    warnings.length === 2 ? "دو" : warnings.length.toLocaleString("fa-IR");
  const progressStyle = {
    "--export-progress": `${boundedProgress}%`,
  } as CSSProperties;
  const title = {
    idle: "خروجی سند",
    preview: "پیش‌نمایش PDF",
    review: "بازبینی خروجی",
    preparing: "در حال ساخت خروجی",
    saving: "در حال ساخت خروجی",
    error: "خروجی ساخته نشد",
    success: "خروجی آماده است",
  }[status];
  const initialFocusRef =
    status === "idle"
      ? format === "word"
        ? wordOptionRef
        : pdfOptionRef
      : status === "review"
        ? reviewConfirmationRef
        : busy
          ? dialogRef
          : status === "error"
            ? retryRef
            : canRevealResult
              ? revealRef
              : doneRef;

  return (
    <AccessibleModal
      open={open}
      isTopLayer={isTopLayer}
      onClose={() => {
        if (status !== "saving" && (!busy || format === "pdf")) onClose();
      }}
      dialogRef={dialogRef}
      initialFocusRef={initialFocusRef}
      returnFocusRef={returnFocusRef}
      backdropClassName={`export-modal-backdrop export-backdrop--${status}`}
      dialogClassName={`export-modal export-modal--${status} export-modal--${format}`}
      labelledBy="export-modal-title"
      describedBy="export-modal-description"
    >
      {status !== "preview" && <><div className="export-modal-header" dir="ltr">
        <button
          type="button"
          onClick={onClose}
          disabled={status === "saving" || (busy && format !== "pdf")}
          aria-label="بستن پنجره‌ی خروجی"
        >
          <X size={20} aria-hidden="true" />
        </button>
        <strong id="export-modal-title" dir="rtl">
          {title}
        </strong>
        <span className="export-modal-mark" aria-hidden="true">
          <Download size={18} />
        </span>
      </div>
      <div className="export-modal-divider" aria-hidden="true" />
      </>}

      {status === "idle" && (
        <div className="export-modal-body export-modal-body--idle">
          <p id="export-modal-description" className="visually-hidden">
            فرمت خروجی را انتخاب کنید. فایل روی همین دستگاه ساخته می‌شود و سند
            اصلی بدون تغییر می‌ماند.
          </p>
          <div className="export-format-choice" role="group" aria-label="فرمت خروجی">
            <button ref={wordOptionRef} type="button" onClick={() => onFormatChange("word")}><FileText size={18} aria-hidden="true" /><span>Word</span></button>
            <button ref={pdfOptionRef} type="button" onClick={() => onFormatChange("pdf")}><span className="export-pdf-icon" aria-hidden="true" /><span>PDF</span></button>
          </div>
        </div>
      )}

      {status === "preview" && preview?.(<><strong id="export-modal-title">پیش‌نمایش PDF <span className="export-pdf-icon" aria-hidden="true" /></strong><strong dir="auto">{fileName}</strong></>, <>
        {warnings.length > 0 && <ul className="pdf-preview-warnings">{warnings.map((warning, index) => <li key={index}>{warning.message}</li>)}</ul>}
        {warnings.length > 0 && <label className="pdf-preview-consent"><input type="checkbox" checked={reviewConfirmed} onChange={event => onReviewConfirmationChange(event.target.checked)} />با این تغییرها موافقم</label>}
        <button className="button button--primary" type="button" onClick={onContinue} disabled={!previewReady || (warnings.length > 0 && !reviewConfirmed)}>{browserPdf ? "پیش‌نمایش و ذخیره در مرورگر" : "ذخیرهٔ PDF"}</button>
        <button className="button button--quiet" type="button" onClick={onClose}>بازگشت به سند</button>
        <button className="pdf-change-format" type="button" onClick={onBack}>انتخاب فرمت دیگر</button>
      </>)}
      {status === "review" && (
        <div className="export-modal-body export-modal-body--review">
          <p id="export-modal-description">
            پیش از ذخیره، {reviewCountLabel} مورد را بررسی کنید. این تغییرها فقط در فایل خروجی اعمال می‌شوند.
          </p>
          <section className="export-review" aria-labelledby="export-review-title">
            <div className="export-review-heading">
              <AlertTriangle size={18} aria-hidden="true" />
              <strong id="export-review-title">
                {warnings.length.toLocaleString("fa-IR")} مورد نیاز به بازبینی است
              </strong>
            </div>
            <ul>
              {warnings.map((warning, index) => (
                <li key={`${warning.kind}-${index}`}>{warning.message}{warning.sourceRange && onInspectWarning && <button className="export-warning-locate" type="button" onClick={() => onInspectWarning(warning)}>دیدن در سند</button>}</li>
              ))}
            </ul>
          </section>
          <div className="export-review-target" dir="auto">
            خروجی: {fileName}
          </div>
          <label className="export-review-confirmation" dir="rtl">
            <input
              ref={reviewConfirmationRef}
              type="checkbox"
              name="confirm-export-review"
              checked={reviewConfirmed}
              onChange={(event) =>
                onReviewConfirmationChange(event.currentTarget.checked)
              }
            />
            <span className="export-review-confirmation-mark" aria-hidden="true">
              {reviewConfirmed && <Check size={18} />}
            </span>
            <strong>با این تغییرها موافقم</strong>
          </label>
        </div>
      )}

      {busy && (
        <div className="export-modal-body export-modal-body--preparing">
          <p id="export-modal-description">
            راوی در حال آماده‌سازی نسخهٔ {format === "word" ? "DOCX" : "PDF"} است. این پردازش کاملاً روی دستگاه شما انجام می‌شود.
          </p>
          <div
            className="export-preparing-progress"
            role="status"
            aria-live="polite"
            style={progressStyle}
          >
            <div>
              <strong>{progressLabel || "در حال آماده‌سازی…"}</strong>
              <span className="export-progress-row" dir="ltr">
                <small>{boundedProgress.toLocaleString("fa-IR")}٪</small>
                <span className="export-progress-track" aria-hidden="true">
                  <span />
                </span>
              </span>
            </div>
          </div>
          <div className="export-processing-note">
            <strong>سند اصلی تغییری نمی‌کند</strong>
            <span>پس از پایان، مسیر ذخیره‌سازی نمایش داده می‌شود.</span>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="export-modal-body export-modal-body--error">
          <section className="export-error-card" role="alert">
            <span className="export-error-icon" aria-hidden="true">
              <AlertTriangle size={18} />
            </span>
            <div>
              <strong id="export-modal-description">ذخیرهٔ فایل ممکن نشد</strong>
              <span>{error}</span>
            </div>
          </section>
          <div className="export-failed-target" dir="auto">
            مقصد: {resultPath || `مسیر انتخاب‌شده / ${fileName}`}
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="export-modal-body export-modal-body--success">
          <p id="export-modal-description">
            فایل با موفقیت ساخته و در مسیر انتخاب‌شده ذخیره شد.
          </p>
          <section className="export-success-card" aria-label="فایل خروجی ذخیره‌شده">
            <div className="export-success-heading">
              <Check size={18} aria-hidden="true" />
              <strong dir="auto">{fileName}</strong>
            </div>
            <code dir="auto">{pathDirectory(resultPath)}</code>
          </section>
          <p className="export-success-note">
            سند اصلی باز می‌ماند و هیچ تغییری در آن ثبت نشده است.
          </p>
        </div>
      )}

      {status !== "preview" && <><div className="export-modal-divider" aria-hidden="true" />
      <div className={`export-modal-actions export-modal-actions--${status}`} dir="ltr">
        {status === "idle" && (
          <>

            <button className="button button--quiet" type="button" onClick={onClose}>
              انصراف
            </button>
          </>
        )}
        {status === "review" && (
          <>
            <button
              className="button button--primary export-review-continue"
              type="button"
              onClick={onContinue}
              disabled={reviewConfirmationRequired && !reviewConfirmed}
            >
              ادامه و ذخیره
            </button>
            <button className="button button--quiet" type="button" onClick={() => onFormatChange("pdf")}>پیش‌نمایش PDF</button>
            <button className="button button--quiet" type="button" onClick={onBack}>
              بازگشت
            </button>
          </>
        )}
        {busy && (
          <button className="button button--primary export-preparing-action" type="button" disabled>
            در حال ساخت…
          </button>
        )}
        {status === "error" && (
          <>
            <button ref={retryRef} className="button button--primary export-retry-action" type="button" onClick={onStart}>
              تلاش دوباره
            </button>
            <button className="button button--quiet" type="button" onClick={onClose}>
              انصراف
            </button>
          </>
        )}
        {status === "success" && (
          <>
            {canRevealResult && (
              <button ref={revealRef} className="button button--primary export-reveal-action" type="button" onClick={onRevealResult}>
                نمایش در پوشه
              </button>
            )}
            <button ref={doneRef} className="button button--quiet export-done-action" type="button" onClick={onClose}>
              تمام
            </button>
          </>
        )}
      </div>
      </>}
    </AccessibleModal>
  );
}
