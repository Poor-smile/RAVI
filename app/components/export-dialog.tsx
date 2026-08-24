"use client";

import { AlertTriangle, Check, Download, X } from "@/app/icons/material-symbols";
import { useRef, type CSSProperties, type RefObject } from "react";
import { AccessibleModal } from "./accessible-modal";

export type ExportFormat = "word" | "pdf";
export type ExportDialogStatus =
  | "idle"
  | "preparing"
  | "review"
  | "saving"
  | "error"
  | "success";

export type ExportDialogWarning = {
  kind: "diagram" | "image" | "unsupported";
  message: string;
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
  onFormatChange: (format: ExportFormat) => void;
  onClose: () => void;
  onStart: () => void;
  onContinue: () => void;
  onBack: () => void;
  onRevealResult: () => void;
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
  directPdf,
  onFormatChange,
  onClose,
  onStart,
  onContinue,
  onBack,
  onRevealResult,
  onReviewConfirmationChange,
}: ExportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const wordOptionRef = useRef<HTMLInputElement>(null);
  const pdfOptionRef = useRef<HTMLInputElement>(null);
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
  const formatInformation =
    format === "word"
      ? {
          title: "DOCX · سند قابل ویرایش",
          description:
            "تیترها، فهرست‌ها و جدول‌ها حفظ می‌شوند؛ نمودارهای سازگار به تصویر تبدیل می‌شوند.",
        }
      : {
          title: "PDF · صفحه‌بندی ثابت",
          description: directPdf
            ? "خروجی A4 برای اشتراک و چاپ؛ در ویندوز مستقیماً ذخیره می‌شود."
            : "خروجی A4 برای اشتراک و چاپ؛ از پنجرهٔ چاپ ذخیره می‌شود.",
        };
  const title = {
    idle: "خروجی سند",
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
        if (!busy) onClose();
      }}
      dialogRef={dialogRef}
      initialFocusRef={initialFocusRef}
      returnFocusRef={returnFocusRef}
      backdropClassName="export-modal-backdrop"
      dialogClassName={`export-modal export-modal--${status} export-modal--${format}`}
      labelledBy="export-modal-title"
      describedBy="export-modal-description"
    >
      <div className="export-modal-header" dir="ltr">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
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

      {status === "idle" && (
        <div className="export-modal-body export-modal-body--idle">
          <p id="export-modal-description">
            فرمت خروجی را انتخاب کنید. فایل روی همین دستگاه ساخته می‌شود و سند
            اصلی بدون تغییر می‌ماند.
          </p>
          <fieldset className="export-format-options">
            <legend>فرمت خروجی</legend>
            <label>
              <input
                ref={wordOptionRef}
                type="radio"
                name="export-format"
                value="word"
                checked={format === "word"}
                onChange={() => onFormatChange("word")}
              />
              <strong>Word (.docx) — قابل ویرایش</strong>
            </label>
            <label>
              <input
                ref={pdfOptionRef}
                type="radio"
                name="export-format"
                value="pdf"
                checked={format === "pdf"}
                onChange={() => onFormatChange("pdf")}
              />
              <strong>PDF — صفحه‌بندی ثابت A4</strong>
            </label>
          </fieldset>
          <div className="export-format-information" aria-live="polite">
            <strong>{formatInformation.title}</strong>
            <span>{formatInformation.description}</span>
          </div>
          <div className="export-result-name" aria-label="نام فایل خروجی">
            <span>نام فایل</span>
            <strong dir="auto">{fileName}</strong>
          </div>
        </div>
      )}

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
                <li key={`${warning.kind}-${index}`}>{warning.message}</li>
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

      <div className="export-modal-divider" aria-hidden="true" />
      <div className={`export-modal-actions export-modal-actions--${status}`} dir="ltr">
        {status === "idle" && (
          <>
            <button className="button button--primary" type="button" onClick={onStart}>
              {format === "word" ? "خروجی DOCX" : "خروجی PDF"}
            </button>
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
    </AccessibleModal>
  );
}
