"use client";

import "./annotation-migration-dialogs.css";
import { AlertTriangle, Upgrade } from "@/app/icons/material-symbols";
import { useRef } from "react";
import { AccessibleModal } from "./accessible-modal";

export function LegacyAnnotationMigrationDialog({ open, onClose, onConvert }: { open: boolean; onClose: () => void; onConvert: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  return <AccessibleModal open={open} isTopLayer onClose={onClose} dialogRef={dialogRef} initialFocusRef={actionRef} backdropClassName="annotation-system-dialog-backdrop" dialogClassName="annotation-system-dialog" labelledBy="legacy-annotation-migration-title"><div className="annotation-system-dialog-body"><span className="annotation-system-dialog-icon is-upgrade"><Upgrade size={24} aria-hidden="true" /></span><h2 id="legacy-annotation-migration-title">سند قدیمی راوی آمادهٔ تبدیل است</h2><p>یک نسخهٔ Markdown جدید ساخته می‌شود؛ فایل اصلی بدون تغییر می‌ماند.</p></div><footer><button type="button" onClick={onClose}>بعداً</button><button ref={actionRef} className="is-primary" type="button" onClick={onConvert}>تبدیل به Markdown</button></footer></AccessibleModal>;
}

export function HiddenAnnotationDataWarningDialog({ open, onClose, onRecover }: { open: boolean; onClose: () => void; onRecover: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  return <AccessibleModal open={open} isTopLayer onClose={onClose} dialogRef={dialogRef} initialFocusRef={actionRef} backdropClassName="annotation-system-dialog-backdrop" dialogClassName="annotation-system-dialog" labelledBy="hidden-annotation-warning-title"><div className="annotation-system-dialog-body"><span className="annotation-system-dialog-icon is-error"><AlertTriangle size={24} aria-hidden="true" /></span><h2 id="hidden-annotation-warning-title">دادهٔ نشانه‌ها در فایل پیدا نشد</h2><p>برنامهٔ دیگری بلوک مخفی Markdown را حذف کرده است؛ متن اصلی سند سالم مانده.</p></div><footer><button type="button" onClick={onClose}>بدون نشانه باز کن</button><button ref={actionRef} className="is-danger" type="button" onClick={onRecover}>بازیابی از نسخه</button></footer></AccessibleModal>;
}
