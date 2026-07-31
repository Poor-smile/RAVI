"use client";

import {
  ExternalLink,
  Globe2,
  Heart,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { RefObject, useRef } from "react";
import { AccessibleModal } from "./accessible-modal";

export const DONATE_URL = "https://daramet.com/poorsmile";
export const TELEGRAM_URL = "https://t.me/poorsmile_crafts";
export const WEBSITE_URL = "https://ravi.poorsmile.ir";

export function SupportDialog({
  open,
  isTopLayer,
  returnFocusRef,
  onClose,
}: {
  open: boolean;
  isTopLayer: boolean;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  return (
    <AccessibleModal
      open={open}
      isTopLayer={isTopLayer}
      onClose={onClose}
      dialogRef={dialogRef}
      initialFocusRef={titleRef}
      returnFocusRef={returnFocusRef}
      backdropClassName="support-modal-backdrop"
      dialogClassName="support-modal"
      labelledBy="support-modal-title"
      describedBy="support-modal-description"
    >
      <header className="support-modal-header">
        <span className="support-modal-seal" aria-hidden="true">
          <Heart size={24} fill="currentColor" />
        </span>
        <div className="support-modal-heading">
          <span>حمایت از توسعهٔ مستقل</span>
          <h2 id="support-modal-title" ref={titleRef} tabIndex={-1}>
            رایگان، همیشه
          </h2>
        </div>
        <button
          className="support-modal-close"
          type="button"
          onClick={onClose}
          aria-label="بستن صفحهٔ حمایت"
          title="بستن"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className="support-modal-scroll">
        <section className="support-promise" id="support-modal-description">
          <Sparkles size={22} aria-hidden="true" />
          <p>
            <strong>راوی تا همیشه رایگان می‌ماند.</strong>
            با دنبال‌کردن کانال تلگرام، همهٔ بروزرسانی‌ها را نیز همیشه رایگان
            دریافت می‌کنید.
          </p>
        </section>

        <div className="support-modal-body">
          <section
            className="support-story"
            aria-labelledby="support-story-title"
          >
            <h3 id="support-story-title">کمک شما کجا صرف می‌شود؟</h3>
            <p>
              نگه‌داری، توسعه، ساخت نسخه‌های ویندوز و هزینه‌های زیرساخت راوی با
              حمایت داوطلبانهٔ شما ادامه پیدا می‌کند. هر مبلغی، با انتخاب خودتان،
              بخشی از مسیر مستقل این پروژه را هموار می‌کند.
            </p>
            <div className="support-name-note">
              <Heart size={18} aria-hidden="true" />
              <p>
                <strong>نامتان را در پیام حمایت بنویسید.</strong>
                نامی را که دوست دارید در بخش «حامیان راوی» نمایش داده شود وارد
                کنید تا با رضایت شما در دربارهٔ نرم‌افزار ثبت شود.
              </p>
            </div>
          </section>

          <section
            className="support-actions"
            aria-labelledby="support-actions-title"
          >
            <h3 id="support-actions-title">همراه راوی بمانید</h3>
            <a
              className="support-action support-action--donate"
              href={DONATE_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span>
                <Heart size={20} fill="currentColor" aria-hidden="true" />
                <b>حمایت مالی در دارمت</b>
              </span>
              <ExternalLink size={17} aria-hidden="true" />
            </a>
            <small>
              مبلغ و متن پیام را خودتان در صفحهٔ امن دارمت وارد می‌کنید.
            </small>
            <a
              className="support-action support-action--telegram"
              href={TELEGRAM_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span>
                <Send size={19} aria-hidden="true" />
                <b>کانال بروزرسانی‌های راوی</b>
              </span>
              <ExternalLink size={17} aria-hidden="true" />
            </a>
          </section>
        </div>
      </div>

      <footer className="support-modal-footer">
        <a
          href={WEBSITE_URL}
          target="_blank"
          rel="noreferrer noopener"
          dir="ltr"
        >
          <Globe2 size={17} aria-hidden="true" />
          ravi.poorsmile.ir
        </a>
        <button type="button" onClick={onClose}>
          بازگشت به راوی
        </button>
      </footer>
    </AccessibleModal>
  );
}
