"use client";

import {
  FilePlus2,
  FolderPlus,
  Move,
  Pencil,
  Trash2,
  X,
} from "@/app/icons/material-symbols";
import { useRef, useState } from "react";
import {
  libraryBaseName,
  parentLibraryPath,
  validateLibraryDocumentRename,
  validateLibraryEntryName,
} from "../filesystem/contract";
import { AccessibleModal } from "./accessible-modal";
import type { FileExplorerActionEntry } from "./file-explorer";

export type FileOperationMode =
  | "menu"
  | "create-file"
  | "create-folder"
  | "rename"
  | "move"
  | "delete";

export function FileOperationDialog({
  open,
  entry,
  initialMode,
  folderOptions,
  busy,
  error,
  activeDirtyAffected,
  isTopLayer,
  onClose,
  onSubmit,
}: {
  open: boolean;
  entry: FileExplorerActionEntry | null;
  initialMode: FileOperationMode;
  folderOptions: string[];
  busy: boolean;
  error: string;
  activeDirtyAffected: boolean;
  isTopLayer: boolean;
  onClose: () => void;
  onSubmit: (mode: Exclude<FileOperationMode, "menu">, value: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const [mode, setMode] = useState<FileOperationMode>(initialMode);
  const [value, setValue] = useState(() =>
    initialMode === "rename"
      ? entry?.name ?? ""
      : initialMode === "move"
        ? parentLibraryPath(entry?.relativePath ?? "")
        : initialMode === "create-file"
          ? "نوشتهٔ تازه.md"
          : initialMode === "create-folder"
            ? "پوشهٔ تازه"
            : "",
  );

  if (!open || !entry) return null;

  const needsName =
    mode === "create-file" || mode === "create-folder" || mode === "rename";
  const targetKind =
    mode === "create-file"
      ? "file"
      : mode === "create-folder"
        ? "folder"
        : entry.kind;
  const nameError = needsName
    ? mode === "rename" && entry.kind === "file"
      ? validateLibraryDocumentRename(entry.name, value)
      : validateLibraryEntryName(value, {
          kind: targetKind,
          markdownOnly: mode === "create-file",
        })
    : "";
  const title =
    mode === "menu"
      ? `عملیات «${entry.name}»`
      : mode === "create-file"
        ? "ساخت فایل Markdown"
        : mode === "create-folder"
          ? "ساخت پوشه"
          : mode === "rename"
            ? "تغییر نام"
            : mode === "move"
              ? "انتقال"
              : "حذف امن";
  const dirtyBlocked =
    activeDirtyAffected &&
    (mode === "rename" || mode === "move" || mode === "delete");

  return (
    <AccessibleModal
      open
      isTopLayer={isTopLayer}
      onClose={onClose}
      dialogRef={dialogRef}
      initialFocusRef={
        mode === "menu" ? undefined : mode === "move" ? selectRef : inputRef
      }
      backdropClassName="save-modal-backdrop file-operation-backdrop"
      dialogClassName="file-operation-dialog"
      labelledBy="file-operation-title"
      describedBy="file-operation-description"
    >
      <header className="file-operation-header">
        <div>
          <strong id="file-operation-title">{title}</strong>
          <span id="file-operation-description" dir="auto">
            {entry.relativePath || entry.name}
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label="بستن عملیات فایل">
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      {mode === "menu" ? (
        <div className="file-operation-menu">
          {entry.kind === "folder" && (
            <>
              <button type="button" onClick={() => {
                setValue("نوشتهٔ تازه.md");
                setMode("create-file");
              }}>
                <FilePlus2 size={17} aria-hidden="true" />
                <span><strong>فایل تازه</strong><small>درون همین پوشه</small></span>
              </button>
              <button type="button" onClick={() => {
                setValue("پوشهٔ تازه");
                setMode("create-folder");
              }}>
                <FolderPlus size={17} aria-hidden="true" />
                <span><strong>پوشهٔ تازه</strong><small>برای مرتب‌کردن نوشته‌ها</small></span>
              </button>
            </>
          )}
          {entry.relativePath && (
            <>
              <button type="button" onClick={() => {
                setValue(entry.name);
                setMode("rename");
              }}>
                <Pencil size={17} aria-hidden="true" />
                <span><strong>تغییر نام</strong><small>بدون جایگزینی فایل موجود</small></span>
              </button>
              <button type="button" onClick={() => {
                setValue(parentLibraryPath(entry.relativePath));
                setMode("move");
              }}>
                <Move size={17} aria-hidden="true" />
                <span><strong>انتقال</strong><small>درون همین پوشهٔ متصل</small></span>
              </button>
              <button className="is-danger" type="button" onClick={() => setMode("delete")}>
                <Trash2 size={17} aria-hidden="true" />
                <span><strong>حذف امن</strong><small>پس از حذف امکان بازگردانی دارید</small></span>
              </button>
            </>
          )}
        </div>
      ) : (
        <form
          className="file-operation-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!nameError && !dirtyBlocked) {
              onSubmit(mode, value);
            }
          }}
        >
          {needsName && (
            <label>
              <span>{mode === "rename" ? "نام تازه" : "نام"}</span>
              <input
                ref={inputRef}
                value={value}
                dir="auto"
                maxLength={240}
                onChange={(event) => setValue(event.target.value)}
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? "file-operation-name-error" : undefined}
              />
              {nameError && <small id="file-operation-name-error" className="field-error">{nameError}</small>}
            </label>
          )}
          {mode === "move" && (
            <label>
              <span>پوشهٔ مقصد</span>
              <select
                ref={selectRef}
                value={value}
                dir="auto"
                onChange={(event) => setValue(event.target.value)}
              >
                {folderOptions.map((folder) => (
                  <option key={folder || "root"} value={folder}>
                    {folder || "ریشهٔ پوشه"}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === "delete" && (
            <div className="file-operation-warning">
              <Trash2 size={19} aria-hidden="true" />
              <p>
                «{libraryBaseName(entry.relativePath)}» از پوشه برداشته می‌شود.
                پس از انجام، اعلان «بازگردانی» برای مدت کوتاه نمایش داده خواهد شد.
              </p>
            </div>
          )}
          {dirtyBlocked && (
            <p className="file-operation-dirty" role="alert">
              این فایل تغییرات ذخیره‌نشده دارد. ابتدا سند را ذخیره کنید؛ متن فعلی تا آن زمان دست‌نخورده می‌ماند.
            </p>
          )}
          {error && <p className="file-operation-error" role="alert">{error}</p>}
          <footer>
            <button type="button" className="button button--quiet" onClick={() => setMode("menu")}>
              بازگشت
            </button>
            <button
              type="submit"
              className={`button ${mode === "delete" ? "button--danger" : "button--primary"}`}
              disabled={busy || Boolean(nameError) || dirtyBlocked}
            >
              {busy ? "در حال انجام…" : mode === "delete" ? "حذف و امکان بازگردانی" : "انجام"}
            </button>
          </footer>
        </form>
      )}
    </AccessibleModal>
  );
}
