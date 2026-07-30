"use client";

import {
  BookOpen,
  FileArchive,
  History,
  Library,
  MessageSquareText,
  PanelLeftOpen,
  ShieldCheck,
  X,
} from "lucide-react";
import { RefObject, useRef } from "react";
import { AccessibleModal } from "./accessible-modal";

const UNIQUE_FEATURES = [
  {
    icon: BookOpen,
    title: "دو‌جهته، نه صرفاً معکوس",
    description:
      "راوی جهت هر سند و هر بلوک را جداگانه تشخیص می‌دهد؛ فارسی RTL می‌ماند و متن غالباً انگلیسی واقعاً LTR نمایش داده می‌شود.",
  },
  {
    icon: Library,
    title: "کتابخانه‌ای که از دستگاه خارج نمی‌شود",
    description:
      "پوشه‌های محلی با اجازهٔ کاربر اسکن می‌شوند و مسیر، نام و محتوای فایل‌ها به سرویس دیگری ارسال نمی‌شود.",
  },
  {
    icon: FileArchive,
    title: "یک فایل برای متن و گفت‌وگو",
    description:
      "قالب .ravi متن Markdown، هایلایت‌ها، کامنت‌ها، حاشیه‌ها و تاریخچهٔ نسخه‌ها را برای اشتراک یکجا نگه می‌دارد.",
  },
  {
    icon: PanelLeftOpen,
    title: "میز دوبرگی زنده",
    description:
      "ویرایش و پیش‌نمایش هم‌زمان، اسکرول هماهنگ، تقسیم قابل‌درگ و حالت مطالعه بدون مزاحمت در یک میز واحد کنار هم قرار گرفته‌اند.",
  },
  {
    icon: MessageSquareText,
    title: "یادداشت روی خود متن",
    description:
      "هایلایت، کامنت و حاشیه‌نویسی به بخش انتخاب‌شده متصل می‌مانند و با hover پیش‌نمایش و با کلیک پنل کامل خود را نشان می‌دهند.",
  },
] as const;

const RELEASES = [
  {
    version: "0.16.0",
    dateTime: "2026-07-31",
    dateLabel: "۹ مرداد ۱۴۰۵",
    changes: [
      "تبدیل لوگوی راوی به ورودی شناسنامهٔ محصول",
      "نمایش خودکار نسخهٔ جاری از اطلاعات بستهٔ برنامه",
      "افزودن معرفی راوی، ویژگی‌های متمایز و دفتر تغییرات نسخه‌ها",
      "افزودن مدیریت فوکوس، بستن با Escape و چیدمان واکنش‌گرا برای مودال",
    ],
  },
  {
    version: "0.15.0",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "تقسیم قابل‌درگ ویرایشگر و پیش‌نمایش",
      "جمع‌شدن پنل کوچک‌تر در آستانهٔ ۱۰٪",
      "پنهان‌کردن مستقل پنل‌ها و نگه‌داری نسبت آخر روی دستگاه",
    ],
  },
  {
    version: "0.14.0",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "مینی‌منوی پنج‌آیکنی قالب‌بندی در محل انتخاب ادیتور",
      "پشتیبانی از انتخاب با ماوس، لمس و صفحه‌کلید",
    ],
  },
  {
    version: "0.13.0",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "مینی‌منوی شناور هایلایت، کامنت و حاشیه‌نویسی",
      "جای‌گذاری هوشمند منو در بالا یا پایین انتخاب",
    ],
  },
  {
    version: "0.12.0",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "سنجاق‌کردن فایل‌های مهم کتابخانه",
      "نمایش مشترک فایل سنجاق‌شده در بخش مستقل و پوشهٔ اصلی",
    ],
  },
] as const;

export function AboutDialog({
  open,
  isTopLayer,
  version,
  returnFocusRef,
  onClose,
}: {
  open: boolean;
  isTopLayer: boolean;
  version: string;
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
      backdropClassName="about-modal-backdrop"
      dialogClassName="about-modal"
      labelledBy="about-modal-title"
      describedBy="about-modal-description"
    >
      <header className="about-modal-header">
        <span className="about-modal-seal" aria-hidden="true">
          ر
        </span>
        <div className="about-modal-heading">
          <span>شناسنامهٔ محصول</span>
          <h2 id="about-modal-title" ref={titleRef} tabIndex={-1}>
            دربارهٔ راوی
          </h2>
        </div>
        <span className="about-current-version" aria-label={`نسخهٔ ${version}`}>
          نسخه
          <b dir="ltr">{version}</b>
        </span>
        <button
          className="about-modal-close"
          type="button"
          onClick={onClose}
          aria-label="بستن دربارهٔ راوی"
          title="بستن"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className="about-modal-scroll">
        <section className="about-intro" id="about-modal-description">
          <p className="about-intro-lead">
            راوی یک میز محلی برای خواندن، ویرایش و گفت‌وگو روی Markdown است؛
            ساخته‌شده برای متنی که فارسی و انگلیسی را کنار هم و درست می‌خواهد.
          </p>
          <p>
            نوشته، یادداشت و مسیر فایل‌های شما روی همان دستگاه می‌ماند. رابط
            فقط زمانی خودش را نشان می‌دهد که برای ویرایش، مرور فصل‌ها یا
            حاشیه‌نویسی به آن نیاز دارید.
          </p>
        </section>

        <section className="about-section" aria-labelledby="about-features-title">
          <div className="about-section-heading">
            <span className="about-section-mark" aria-hidden="true" />
            <div>
              <h3 id="about-features-title">ویژگی‌های متمایز راوی</h3>
              <p>چیزهایی که تجربهٔ راوی را از یک Markdown viewer معمولی جدا می‌کنند.</p>
            </div>
          </div>
          <ul className="about-feature-list">
            {UNIQUE_FEATURES.map((feature) => {
              const FeatureIcon = feature.icon;
              return (
                <li key={feature.title}>
                  <FeatureIcon size={19} aria-hidden="true" />
                  <span>
                    <strong>{feature.title}</strong>
                    <small>{feature.description}</small>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          className="about-section about-changelog"
          aria-labelledby="about-changelog-title"
        >
          <div className="about-section-heading">
            <History size={19} aria-hidden="true" />
            <div>
              <h3 id="about-changelog-title">دفتر تغییرات</h3>
              <p>آخرین قابلیت‌های افزوده‌شده و مسیر رشد نسخه‌های اخیر.</p>
            </div>
          </div>

          <ol className="about-release-list">
            {RELEASES.map((release, index) => {
              const isCurrent = index === 0;
              return (
                <li
                  className={isCurrent ? "is-current" : ""}
                  key={release.version}
                >
                  {isCurrent ? (
                    <article aria-current="true">
                      <div className="about-release-heading">
                        <span>
                          <strong dir="ltr">v{version}</strong>
                          <b>نسخهٔ جاری</b>
                        </span>
                        <time dateTime={release.dateTime}>
                          {release.dateLabel}
                        </time>
                      </div>
                      <ul>
                        {release.changes.map((change) => (
                          <li key={change}>{change}</li>
                        ))}
                      </ul>
                    </article>
                  ) : (
                    <details>
                      <summary>
                        <span>
                          <strong dir="ltr">v{release.version}</strong>
                          <small>{release.changes[0]}</small>
                        </span>
                        <time dateTime={release.dateTime}>
                          {release.dateLabel}
                        </time>
                      </summary>
                      <ul>
                        {release.changes.map((change) => (
                          <li key={change}>{change}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <footer className="about-modal-footer">
        <span>
          <ShieldCheck size={17} aria-hidden="true" />
          بدون حساب کاربری و بدون ارسال محتوای سند
        </span>
        <button type="button" onClick={onClose}>
          بازگشت به راوی
        </button>
      </footer>
    </AccessibleModal>
  );
}
