"use client";

import {
  AlertTriangle,
  Check,
  FileArchive,
  FilePlus2,
  FileText,
  FolderOpen,
  Save,
  X,
} from "lucide-react";
import { RefObject, useMemo, useRef, useState } from "react";
import { AccessibleModal } from "./accessible-modal";

export type NewDocumentFileType = "markdown" | "ravi";

export type NewDocumentSpec = {
  baseName: string;
  fileName: string;
  fileType: NewDocumentFileType;
  includeTitle: boolean;
};

const WINDOWS_RESERVED_NAMES =
  /^(?:con|prn|aux|nul|clock\$|com[1-9]|lpt[1-9])(?:\.|$)/i;
const INVALID_FILE_NAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/u;
const MAX_BASE_NAME_LENGTH = 96;

export function validateNewDocumentName(value: string) {
  const normalized = value.normalize("NFC");
  const trimmed = normalized.trim();

  if (!trimmed) return "یک نام برای فایل وارد کنید.";
  if (normalized !== normalized.trimEnd() || /[.]$/u.test(trimmed)) {
    return "نام فایل نباید با فاصله یا نقطه تمام شود.";
  }
  if (trimmed === "." || trimmed === "..") {
    return "این نام برای فایل قابل استفاده نیست.";
  }
  if (INVALID_FILE_NAME_CHARACTERS.test(trimmed)) {
    return 'از نویسه‌های < > : " / \\ | ? * در نام فایل استفاده نکنید.';
  }
  if (WINDOWS_RESERVED_NAMES.test(trimmed)) {
    return "این نام در ویندوز رزرو شده است؛ نام دیگری انتخاب کنید.";
  }
  if (trimmed.length > MAX_BASE_NAME_LENGTH) {
    return `نام فایل باید حداکثر ${MAX_BASE_NAME_LENGTH.toLocaleString("fa-IR")} نویسه باشد.`;
  }
  return "";
}

function extensionForType(fileType: NewDocumentFileType) {
  return fileType === "ravi" ? ".ravi" : ".md";
}

export function titleFromDocumentName(baseName: string) {
  return (
    baseName
      .trim()
      .replace(/[-_]+/gu, " ")
      .replace(/\s+/gu, " ") || "نوشتهٔ تازه"
  );
}

type NewDocumentDialogProps = {
  open: boolean;
  isTopLayer: boolean;
  isDesktop: boolean;
  hasUnsavedChanges: boolean;
  creating: boolean;
  creationError: string;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onCreate: (spec: NewDocumentSpec) => void;
  onSaveCurrent: () => void;
};

export function NewDocumentDialog(props: NewDocumentDialogProps) {
  if (!props.open) return null;
  return <NewDocumentDialogContent {...props} />;
}

function NewDocumentDialogContent({
  open,
  isTopLayer,
  isDesktop,
  hasUnsavedChanges,
  creating,
  creationError,
  returnFocusRef,
  onClose,
  onCreate,
  onSaveCurrent,
}: NewDocumentDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [baseName, setBaseName] = useState("نوشته تازه");
  const [fileType, setFileType] =
    useState<NewDocumentFileType>("markdown");
  const [includeTitle, setIncludeTitle] = useState(true);
  const [nameTouched, setNameTouched] = useState(false);
  const nameError = useMemo(
    () => validateNewDocumentName(baseName),
    [baseName],
  );
  const trimmedBaseName = baseName.trim();
  const extension = extensionForType(fileType);
  const finalFileName = `${trimmedBaseName || "بدون‌نام"}${extension}`;

  const submit = () => {
    setNameTouched(true);
    if (nameError) {
      requestAnimationFrame(() => nameInputRef.current?.focus());
      return;
    }
    onCreate({
      baseName: trimmedBaseName,
      fileName: finalFileName,
      fileType,
      includeTitle,
    });
  };

  return (
    <AccessibleModal
      open={open}
      isTopLayer={isTopLayer}
      onClose={onClose}
      dialogRef={dialogRef}
      initialFocusRef={nameInputRef}
      returnFocusRef={returnFocusRef}
      backdropClassName="save-modal-backdrop new-document-modal-backdrop"
      dialogClassName="save-modal new-document-modal"
      labelledBy="new-document-modal-title"
      describedBy="new-document-modal-description"
    >
      <header className="save-modal-header new-document-modal-header">
        <span className="save-modal-mark" aria-hidden="true">
          <FilePlus2 size={23} />
        </span>
        <div>
          <span>برگ تازه روی میز راوی</span>
          <strong id="new-document-modal-title">ساخت فایل جدید</strong>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="بستن پنجرهٔ ساخت فایل"
          title="بستن"
        >
          <X size={19} aria-hidden="true" />
        </button>
      </header>

      <form
        className="save-modal-body new-document-modal-body"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p id="new-document-modal-description">
          نام و قالب سند را مشخص کنید. پسوند به‌صورت خودکار اضافه می‌شود تا
          فایل با قالب اشتباه ساخته نشود.
        </p>

        {hasUnsavedChanges && (
          <div className="new-document-unsaved-warning" role="status">
            <AlertTriangle size={19} aria-hidden="true" />
            <span>
              <strong>سند فعلی تغییر ذخیره‌نشده دارد</strong>
              <small>
                ساخت فایل جدید این تغییرات را ذخیره نمی‌کند. می‌توانید ابتدا
                سند فعلی را ذخیره کنید.
              </small>
            </span>
            <button type="button" onClick={onSaveCurrent}>
              <Save size={15} aria-hidden="true" />
              ذخیرهٔ سند فعلی
            </button>
          </div>
        )}

        <label className="save-name-field new-document-name-field">
          <span>نام فایل</span>
          <span
            className={`new-document-name-control ${
              nameTouched && nameError ? "has-error" : ""
            }`}
          >
            <input
              ref={nameInputRef}
              type="text"
              value={baseName}
              onChange={(event) => {
                setBaseName(
                  event.target.value.replace(
                    /\.(?:md|markdown|ravi)$/iu,
                    "",
                  ),
                );
                if (!nameTouched) setNameTouched(true);
              }}
              onBlur={() => setNameTouched(true)}
              dir="auto"
              maxLength={MAX_BASE_NAME_LENGTH + 1}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(nameTouched && nameError)}
              aria-describedby={
                nameTouched && nameError
                  ? "new-document-name-error"
                  : "new-document-name-help"
              }
              data-editable-kind="saveName"
            />
            <b dir="ltr" aria-hidden="true">
              {extension}
            </b>
          </span>
          {nameTouched && nameError ? (
            <small
              className="new-document-field-error"
              id="new-document-name-error"
              role="alert"
            >
              {nameError}
            </small>
          ) : (
            <small id="new-document-name-help">
              فقط نام را بنویسید؛ مسیر و پسوند را راوی مدیریت می‌کند.
            </small>
          )}
        </label>

        <fieldset
          className="save-type-options new-document-type-options"
          data-editable-kind="saveName"
        >
          <legend>نوع فایل</legend>
          <label className={fileType === "markdown" ? "is-selected" : ""}>
            <input
              type="radio"
              name="new-document-file-type"
              value="markdown"
              checked={fileType === "markdown"}
              onChange={() => setFileType("markdown")}
            />
            <FileText size={21} aria-hidden="true" />
            <span>
              <strong>Markdown (.md)</strong>
              <small>
                انتخاب سبک برای متن خالص؛ یادداشت‌ها و هایلایت‌ها داخل این
                فایل ذخیره نمی‌شوند.
              </small>
            </span>
          </label>
          <label className={fileType === "ravi" ? "is-selected" : ""}>
            <input
              type="radio"
              name="new-document-file-type"
              value="ravi"
              checked={fileType === "ravi"}
              onChange={() => setFileType("ravi")}
            />
            <FileArchive size={21} aria-hidden="true" />
            <span>
              <strong>سند راوی (.ravi)</strong>
              <small>
                مناسب اشتراک متن همراه با هایلایت، کامنت، حاشیه و تاریخچهٔ
                نسخه‌ها.
              </small>
            </span>
          </label>
        </fieldset>

        <label className="new-document-title-option">
          <input
            type="checkbox"
            checked={includeTitle}
            onChange={(event) => setIncludeTitle(event.target.checked)}
          />
          <span>
            <strong>عنوان فایل داخل متن نوشته شود</strong>
            <small>
              سند با عنوان «{titleFromDocumentName(trimmedBaseName)}» شروع
              می‌شود؛ هر زمان بخواهید می‌توانید آن را ویرایش کنید.
            </small>
          </span>
        </label>

        <div className="new-document-result" aria-live="polite">
          <span className="new-document-result-icon" aria-hidden="true">
            {fileType === "ravi" ? (
              <FileArchive size={20} />
            ) : (
              <FileText size={20} />
            )}
          </span>
          <span>
            <small>فایل آمادهٔ ساخت</small>
            <strong dir="auto">{finalFileName}</strong>
          </span>
          <span className="new-document-location-note">
            <FolderOpen size={16} aria-hidden="true" />
            {isDesktop
              ? "محل ذخیره را در گام بعد انتخاب می‌کنید"
              : "فایل در پوشهٔ دانلود مرورگر ذخیره می‌شود"}
          </span>
        </div>

        {fileType === "ravi" && (
          <div className="new-document-ravi-note">
            <Check size={17} aria-hidden="true" />
            <span>
              در برنامهٔ ویندوز، نسخهٔ خوانای Markdown نیز با همین نام کنار
              فایل راوی ساخته می‌شود.
            </span>
          </div>
        )}

        {creationError && (
          <p className="new-document-creation-error" role="alert">
            {creationError}
          </p>
        )}

        <div className="save-modal-actions new-document-modal-actions">
          <button
            className="button button--quiet"
            type="button"
            onClick={onClose}
            disabled={creating}
          >
            انصراف
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={creating || Boolean(nameError)}
          >
            <FilePlus2 size={17} aria-hidden="true" />
            {creating
              ? "در حال ساخت…"
              : hasUnsavedChanges
                ? "ساخت بدون ذخیرهٔ قبلی"
                : isDesktop
                  ? "ادامه و انتخاب محل"
                  : "ساخت فایل"}
          </button>
        </div>
      </form>
    </AccessibleModal>
  );
}
