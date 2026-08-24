"use client";

import {
  AlertTriangle,
  FileText,
  History,
  ImagePlus,
  Link2,
  Save,
  Shield,
  Upload,
  X,
} from "@/app/icons/material-symbols";
import type { RefObject } from "react";
import { AccessibleModal } from "./accessible-modal";

export function ExternalLinkDialog({
  open,
  isTopLayer,
  candidate,
  dialogRef,
  confirmRef,
  onClose,
  onConfirm,
}: {
  open: boolean;
  isTopLayer: boolean;
  candidate: string;
  dialogRef: RefObject<HTMLDivElement | null>;
  confirmRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onConfirm: (candidate: string) => void;
}) {
  return (
    <AccessibleModal
      open={open}
      isTopLayer={isTopLayer}
      onClose={onClose}
      dialogRef={dialogRef}
      initialFocusRef={confirmRef}
      backdropClassName="save-modal-backdrop external-link-backdrop"
      dialogClassName="external-link-dialog"
      labelledBy="external-link-dialog-title"
      describedBy="external-link-dialog-description"
    >
      <div className="external-link-dialog-body">
        <Shield size={22} aria-hidden="true" />
        <div>
          <strong id="external-link-dialog-title">باز کردن لینک بیرونی؟</strong>
          <p id="external-link-dialog-description">
            این مقصد بیرون از راوی باز می‌شود. پیش از ادامه نشانی را بررسی کنید.
          </p>
          <code dir="ltr">{candidate}</code>
        </div>
      </div>
      <div className="external-link-dialog-actions">
        <button type="button" onClick={onClose}>انصراف</button>
        <button
          ref={confirmRef}
          type="button"
          className="is-primary"
          onClick={() => onConfirm(candidate)}
        >
          باز کردن
        </button>
      </div>
    </AccessibleModal>
  );
}

export function ImageInsertDialog({
  open,
  isTopLayer,
  sourceMode,
  url,
  error,
  dialogRef,
  closeRef,
  localPickerRef,
  urlInputRef,
  returnFocusRef,
  onClose,
  onSourceModeChange,
  onUrlChange,
  onChooseLocal,
  onInsertUrl,
}: {
  open: boolean;
  isTopLayer: boolean;
  sourceMode: "local" | "url";
  url: string;
  error: string;
  dialogRef: RefObject<HTMLDivElement | null>;
  closeRef: RefObject<HTMLButtonElement | null>;
  localPickerRef: RefObject<HTMLButtonElement | null>;
  urlInputRef: RefObject<HTMLInputElement | null>;
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSourceModeChange: (mode: "local" | "url") => void;
  onUrlChange: (value: string) => void;
  onChooseLocal: () => void;
  onInsertUrl: () => void;
}) {
  return (
    <AccessibleModal
      open={open}
      isTopLayer={isTopLayer}
      onClose={onClose}
      dialogRef={dialogRef}
      initialFocusRef={sourceMode === "url" ? urlInputRef : localPickerRef}
      returnFocusRef={returnFocusRef}
      backdropClassName="save-modal-backdrop image-insert-modal-backdrop"
      dialogClassName="save-modal image-insert-modal"
      labelledBy="image-insert-modal-title"
      describedBy="image-insert-modal-description"
    >
      <div className="save-modal-header">
        <span className="save-modal-mark" aria-hidden="true">
          <ImagePlus size={22} />
        </span>
        <div>
          <span>تصویرِ قابل‌حمل در سند</span>
          <strong id="image-insert-modal-title">افزودن تصویر</strong>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="بستن پنجرهٔ افزودن تصویر">
          <X size={19} aria-hidden="true" />
        </button>
      </div>

      <form
        className="save-modal-body image-insert-modal-body"
        onSubmit={(event) => {
          event.preventDefault();
          if (sourceMode === "url") onInsertUrl();
        }}
      >
        <p id="image-insert-modal-description">
          تصویر محلی در پوشهٔ سند نگه‌داری می‌شود؛ برای تصویر اینترنتی فقط
          خود نشانی در Markdown می‌ماند.
        </p>

        <div className="image-source-tabs" role="tablist" aria-label="منبع تصویر">
          <button
            id="image-source-local-tab"
            type="button"
            role="tab"
            aria-controls="image-source-local-panel"
            aria-selected={sourceMode === "local"}
            className={sourceMode === "local" ? "is-selected" : ""}
            onClick={() => onSourceModeChange("local")}
          >
            <Upload size={16} aria-hidden="true" />
            فایل محلی
          </button>
          <button
            id="image-source-url-tab"
            type="button"
            role="tab"
            aria-controls="image-source-url-panel"
            aria-selected={sourceMode === "url"}
            className={sourceMode === "url" ? "is-selected" : ""}
            onClick={() => {
              onSourceModeChange("url");
              requestAnimationFrame(() => urlInputRef.current?.focus());
            }}
          >
            <Link2 size={16} aria-hidden="true" />
            نشانی اینترنتی
          </button>
        </div>

        {sourceMode === "local" ? (
          <section
            id="image-source-local-panel"
            className="image-source-panel"
            role="tabpanel"
            aria-labelledby="image-source-local-tab"
          >
            <span className="image-source-panel-icon" aria-hidden="true">
              <ImagePlus size={22} />
            </span>
            <div>
              <strong>تصویر روی همین دستگاه</strong>
              <small>PNG، JPEG، WebP یا GIF تا سقف ۸ مگابایت</small>
            </div>
            <button ref={localPickerRef} type="button" className="button button--primary" onClick={onChooseLocal}>
              <Upload size={16} aria-hidden="true" />
              انتخاب فایل
            </button>
          </section>
        ) : (
          <section
            id="image-source-url-panel"
            className="image-source-panel image-url-source"
            role="tabpanel"
            aria-labelledby="image-source-url-tab"
          >
            <label className="save-name-field image-url-field">
              <span>نشانی مستقیم تصویر</span>
              <input
                ref={urlInputRef}
                type="url"
                value={url}
                onChange={(event) => onUrlChange(event.target.value)}
                placeholder="https://example.com/photo.png"
                inputMode="url"
                dir="ltr"
                required
                data-editable-kind="imageUrl"
              />
            </label>
            <p className="image-url-privacy-note">
              <Link2 size={15} aria-hidden="true" />
              فقط URL ذخیره می‌شود؛ فایل سبک می‌ماند. نمایش تصویر به اینترنت
              و در دسترس‌بودن نشانی وابسته است.
            </p>
            <div className="save-modal-actions image-url-actions">
              <button className="button button--primary" type="submit" disabled={!url.trim()}>
                <ImagePlus size={17} aria-hidden="true" />
                درج نشانی
              </button>
            </div>
          </section>
        )}

        {error && <p className="image-insert-error" role="alert">{error}</p>}
      </form>
    </AccessibleModal>
  );
}

type SaveVersionSummary = { number: number; savedAt: string };

export function CloseDocumentDialog({
  open,
  isTopLayer,
  title,
  dirtyCount,
  canSave,
  dialogRef,
  cancelRef,
  onClose,
  onDiscard,
  onSaveAndClose,
}: {
  open: boolean;
  isTopLayer: boolean;
  title: string;
  dirtyCount: number;
  canSave: boolean;
  dialogRef: RefObject<HTMLDivElement | null>;
  cancelRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onDiscard: () => void;
  onSaveAndClose: () => void;
}) {
  const multiple = dirtyCount > 1;
  return (
    <AccessibleModal
      open={open}
      isTopLayer={isTopLayer}
      onClose={onClose}
      dialogRef={dialogRef}
      initialFocusRef={cancelRef}
      backdropClassName="save-modal-backdrop close-document-backdrop"
      dialogClassName="close-document-dialog"
      labelledBy="close-document-dialog-title"
      describedBy="close-document-dialog-description"
      containerRole="alertdialog"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="close-document-dialog__body">
        <span className="close-document-dialog__mark" aria-hidden="true">
          <AlertTriangle size={22} />
        </span>
        <div>
          <strong id="close-document-dialog-title">
            {multiple
              ? `${dirtyCount.toLocaleString("fa-IR")} سند بدون ذخیره بسته شوند؟`
              : `«${title}» بدون ذخیره بسته شود؟`}
          </strong>
          <p id="close-document-dialog-description">
            {multiple
              ? "تغییرهای ذخیره‌نشدهٔ این سندها کنار گذاشته می‌شوند و قابل بازیابی نخواهند بود."
              : "تغییرهای پس از آخرین ذخیره کنار گذاشته می‌شوند و قابل بازیابی نخواهند بود."}
          </p>
        </div>
      </div>
      <div className="close-document-dialog__actions">
        <button ref={cancelRef} type="button" onClick={onClose}>
          انصراف
        </button>
        <button type="button" className="is-danger" onClick={onDiscard}>
          بستن بدون ذخیره
        </button>
        {canSave && (
          <button type="button" className="is-primary" onClick={onSaveAndClose}>
            <Save size={17} aria-hidden="true" />
            ذخیره و بستن
          </button>
        )}
      </div>
    </AccessibleModal>
  );
}

export function SaveFileDialog({
  open,
  isTopLayer,
  fileName,
  fileType,
  nextRevision,
  versions,
  saving,
  shortcut,
  dialogRef,
  fileNameRef,
  closeRef,
  returnFocusRef,
  onClose,
  onFileNameChange,
  onFileTypeChange,
  onRestore,
  onSubmit,
}: {
  open: boolean;
  isTopLayer: boolean;
  fileName: string;
  fileType: "markdown" | "ravi";
  nextRevision: number;
  versions: readonly SaveVersionSummary[];
  saving: boolean;
  shortcut?: string;
  dialogRef: RefObject<HTMLDivElement | null>;
  fileNameRef: RefObject<HTMLInputElement | null>;
  closeRef: RefObject<HTMLButtonElement | null>;
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onFileNameChange: (value: string) => void;
  onFileTypeChange: (type: "markdown" | "ravi") => void;
  onRestore: (number: number, savedAt: string) => void;
  onSubmit: () => void;
}) {
  return (
    <AccessibleModal
      open={open}
      isTopLayer={isTopLayer}
      onClose={onClose}
      dialogRef={dialogRef}
      initialFocusRef={fileNameRef}
      returnFocusRef={returnFocusRef}
      backdropClassName="save-modal-backdrop"
      dialogClassName="save-modal"
      labelledBy="save-modal-title"
      describedBy="save-modal-description"
    >
      <div className="save-modal-header">
        <span className="save-modal-mark" aria-hidden="true"><Save size={22} /></span>
        <div>
          <span>ثبت یک نسخه‌ی تازه</span>
          <strong id="save-modal-title">ذخیره فایل</strong>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="بستن پنجره‌ی ذخیره">
          <X size={19} aria-hidden="true" />
        </button>
      </div>

      <form
        className="save-modal-body"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <p id="save-modal-description">
          نام و نوع فایل را انتخاب کنید. با هر ذخیره، نسخه‌ی سند یک شماره جلو می‌رود.
        </p>
        <label className="save-name-field">
          <span>نام فایل</span>
          <input
            ref={fileNameRef}
            type="text"
            value={fileName}
            onChange={(event) => onFileNameChange(event.target.value)}
            dir="auto"
            required
            data-editable-kind="saveName"
          />
        </label>

        <fieldset className="save-type-options" data-editable-kind="saveName">
          <legend>نوع فایل</legend>
          <label className={fileType === "markdown" ? "is-selected" : ""}>
            <input
              type="radio"
              name="save-file-type"
              value="markdown"
              checked={fileType === "markdown"}
              onChange={() => onFileTypeChange("markdown")}
            />
            <FileText size={21} aria-hidden="true" />
            <span>
              <strong>Markdown (.md)</strong>
              <small>متن، هایلایت و نظرها در همین فایل استاندارد ذخیره می‌شوند.</small>
            </span>
          </label>
        </fieldset>

        <details className="version-history">
          <summary>
            <span><History size={16} aria-hidden="true" />تاریخچه‌ی نسخه‌ها</span>
            <small>نسخه‌ی بعدی {nextRevision.toLocaleString("fa-IR")}</small>
          </summary>
          {versions.length > 0 ? (
            <ol>
              {[...versions].reverse().map((version) => (
                <li key={`${version.number}-${version.savedAt}`}>
                  <span>
                    <strong>نسخه {version.number.toLocaleString("fa-IR")}</strong>
                    <time dateTime={version.savedAt}>
                      {new Date(version.savedAt).toLocaleString("fa-IR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </time>
                  </span>
                  <button type="button" onClick={() => onRestore(version.number, version.savedAt)}>بازیابی</button>
                </li>
              ))}
            </ol>
          ) : (
            <p>با اولین ذخیره، تاریخچه‌ی این سند ساخته می‌شود.</p>
          )}
        </details>

        <div className="save-modal-actions">
          <button className="button button--quiet" type="button" onClick={onClose}>انصراف</button>
          <button className="button button--primary" type="submit" disabled={saving} aria-keyshortcuts={shortcut}>
            <Save size={17} aria-hidden="true" />
            {saving ? "در حال ذخیره…" : "ذخیره فایل"}
          </button>
        </div>
      </form>
    </AccessibleModal>
  );
}
