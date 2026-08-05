"use client";

import {
  AlertTriangle,
  Check,
  FileDown,
  FileText,
  LoaderCircle,
  Printer,
  X,
} from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";
import { AccessibleModal } from "./accessible-modal";

export type ExportFormat = "word" | "pdf";
export type ExportDialogStatus =
  | "idle"
  | "preparing"
  | "review"
  | "saving"
  | "error";

export type ExportDialogWarning = {
  kind: "diagram" | "image" | "unsupported";
  message: string;
};

type ExportDialogProps = {
  open: boolean;
  isTopLayer: boolean;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  format: ExportFormat;
  fileName: string;
  status: ExportDialogStatus;
  progressLabel: string;
  warnings: ExportDialogWarning[];
  diagramConfirmed: boolean;
  error: string;
  directPdf: boolean;
  onFormatChange: (format: ExportFormat) => void;
  onClose: () => void;
  onStart: () => void;
  onContinue: () => void;
  onDiagramConfirmationChange: (confirmed: boolean) => void;
};

export function ExportDialog({
  open,
  isTopLayer,
  returnFocusRef,
  format,
  fileName,
  status,
  progressLabel,
  warnings,
  diagramConfirmed,
  error,
  directPdf,
  onFormatChange,
  onClose,
  onStart,
  onContinue,
  onDiagramConfirmationChange,
}: ExportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wordOptionRef = useRef<HTMLInputElement>(null);
  const busy = status === "preparing" || status === "saving";
  const diagramConfirmationRequired =
    status === "review" && warnings.some((warning) => warning.kind === "diagram");

  useEffect(() => {
    if (!open || status !== "idle") return;
    const frame = requestAnimationFrame(() => wordOptionRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, status]);

  return (
    <AccessibleModal
      open={open}
      isTopLayer={isTopLayer}
      onClose={() => {
        if (!busy) onClose();
      }}
      dialogRef={dialogRef}
      initialFocusRef={closeRef}
      returnFocusRef={returnFocusRef}
      backdropClassName="export-modal-backdrop"
      dialogClassName="export-modal"
      labelledBy="export-modal-title"
      describedBy="export-modal-description"
    >
      <div className="export-modal-header">
        <span className="export-modal-mark" aria-hidden="true">
          <FileDown size={22} />
        </span>
        <div>
          <span>نسخه‌ای برای تحویل</span>
          <strong id="export-modal-title">خروجی گرفتن</strong>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="بستن پنجره‌ی خروجی"
        >
          <X size={19} aria-hidden="true" />
        </button>
      </div>

      <div className="export-modal-body">
        <p id="export-modal-description">
          این فایل یک نسخه‌ی تحویلی است؛ ساخت آن سند اصلی یا تاریخچه‌ی ذخیره را
          تغییر نمی‌دهد.
        </p>

        {status === "review" ? (
          <section className="export-review" aria-labelledby="export-review-title">
            <div className="export-review-heading">
              <AlertTriangle size={20} aria-hidden="true" />
              <div>
                <strong id="export-review-title">خروجی آماده است، با چند یادآوری</strong>
                <span>
                  متن اصلی حفظ شده است؛ موارد زیر در نسخه‌ی تحویلی ساده‌تر نمایش
                  داده می‌شوند.
                </span>
              </div>
            </div>
            <ul>
              {warnings.map((warning, index) => (
                <li key={`${warning.kind}-${index}`}>{warning.message}</li>
              ))}
            </ul>
            {diagramConfirmationRequired && (
              <label className="export-diagram-confirmation">
                <input
                  type="checkbox"
                  name="confirm-diagram-loss"
                  checked={diagramConfirmed}
                  onChange={(event) =>
                    onDiagramConfirmationChange(event.currentTarget.checked)
                  }
                />
                <span>
                  <strong>
                    می‌پذیرم که نمودارهای ناموفق در خروجی کامل دیده نمی‌شوند.
                  </strong>
                  <small>فقط با تأیید من ساخت فایل ادامه پیدا کند.</small>
                </span>
              </label>
            )}
          </section>
        ) : (
          <>
            <fieldset className="export-format-options" disabled={busy}>
              <legend>قالب خروجی</legend>
              <label className={format === "word" ? "is-selected" : ""}>
                <input
                  ref={wordOptionRef}
                  type="radio"
                  name="export-format"
                  value="word"
                  checked={format === "word"}
                  onChange={() => onFormatChange("word")}
                />
                <span className="export-format-icon" aria-hidden="true">
                  <FileText size={23} />
                  <b>W</b>
                </span>
                <span>
                  <strong>Word (.docx)</strong>
                  <small>قابل‌ویرایش؛ مناسب ادامه‌ی کار در Microsoft Word</small>
                </span>
              </label>
              <label className={format === "pdf" ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="export-format"
                  value="pdf"
                  checked={format === "pdf"}
                  onChange={() => onFormatChange("pdf")}
                />
                <span className="export-format-icon" aria-hidden="true">
                  <Printer size={23} />
                  <b>P</b>
                </span>
                <span>
                  <strong>PDF</strong>
                  <small>
                    {directPdf
                      ? "ظاهر ثابت A4؛ ذخیره‌ی مستقیم در برنامه‌ی ویندوز"
                      : "ظاهر ثابت A4؛ از پنجره‌ی چاپ، Save as PDF را انتخاب کنید"}
                  </small>
                </span>
              </label>
            </fieldset>

            <div className="export-result-name" aria-label="نام فایل خروجی">
              <span>نام نسخه</span>
              <strong dir="auto">{fileName}</strong>
              <Check size={17} aria-hidden="true" />
            </div>
          </>
        )}

        {busy && (
          <div className="export-progress" role="status" aria-live="polite">
            <LoaderCircle size={20} aria-hidden="true" />
            <span>
              <strong>{status === "saving" ? "در حال ساخت فایل" : "در حال آماده‌سازی"}</strong>
              <small>{progressLabel}</small>
            </span>
          </div>
        )}

        {status === "error" && (
          <p className="export-error" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}

        <div className="export-modal-actions">
          <button
            className="button button--quiet"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            انصراف
          </button>
          <button
            className="button button--primary"
            type="button"
            onClick={status === "review" ? onContinue : onStart}
            disabled={
              busy || (diagramConfirmationRequired && !diagramConfirmed)
            }
          >
            {busy ? (
              <LoaderCircle size={17} aria-hidden="true" />
            ) : status === "review" ? (
              <FileDown size={17} aria-hidden="true" />
            ) : format === "word" ? (
              <FileText size={17} aria-hidden="true" />
            ) : (
              <Printer size={17} aria-hidden="true" />
            )}
            {status === "review"
              ? diagramConfirmationRequired
                ? "تأیید و ساخت خروجی"
                : "ادامه و ذخیره"
              : status === "error"
                ? "تلاش دوباره"
                : format === "word"
                  ? "ساخت فایل Word"
                  : directPdf
                    ? "ساخت فایل PDF"
                    : "بازکردن پنجره‌ی چاپ"}
          </button>
        </div>
      </div>
    </AccessibleModal>
  );
}
