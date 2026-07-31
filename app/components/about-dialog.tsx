"use client";

import {
  BookOpen,
  FileArchive,
  History,
  ImagePlus,
  Library,
  MessageSquareText,
  Network,
  PanelLeftOpen,
  ShieldCheck,
  X,
} from "lucide-react";
import { RefObject, useRef } from "react";
import { AccessibleModal } from "./accessible-modal";

const UNIQUE_FEATURES = [
  {
    icon: Network,
    title: "نمودار، بخشی از خود سند",
    description:
      "بلوک استاندارد Mermaid در Markdown و ravi دست‌نخورده می‌ماند، امن رندر می‌شود و با دوبارکلیک در استودیوی زندهٔ فارسی باز می‌گردد.",
  },
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
      "قالب .ravi متن Markdown، هایلایت‌ها، کامنت‌ها، حاشیه‌ها، تصویرهای درج‌شده و تاریخچهٔ نسخه‌ها را برای اشتراک یکجا نگه می‌دارد.",
  },
  {
    icon: ImagePlus,
    title: "تصویر، همراهِ خودِ سند",
    description:
      "تصویرهای PNG، JPEG، WebP و GIF از دستگاه یا URL انتخاب می‌شوند و در فایل .ravi به‌عنوان محمولهٔ داخلی ذخیره می‌مانند؛ بدون نیاز به مسیر یا اینترنت.",
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
    version: "0.20.0",
    dateTime: "2026-07-31",
    dateLabel: "۹ مرداد ۱۴۰۵",
    changes: [
      "افزودن مدال درج تصویر از فایل محلی یا URL با آیکن اختصاصی و میان‌بر Alt+I مستقل از زبان صفحه‌کلید",
      "پشتیبانی از PNG، JPEG، WebP و GIF با پیش‌نمایش فوری در سند و دریافت URL فقط با تأیید صریح کاربر",
      "بسته‌بندی تصویرهای درج‌شده داخل فایل .ravi و تولید Markdown خودکفا در فایل همراه",
      "تکمیل دفتر تغییرات از همهٔ نسخه‌های پیشین راوی",
    ],
  },
  {
    version: "0.19.1",
    dateTime: "2026-07-31",
    dateLabel: "۹ مرداد ۱۴۰۵",
    changes: [
      "تجمیع همهٔ کنترل‌های تمام‌صفحه در یک Dock مرکزی و در دسترس",
      "افزایش هدف کلیک ابزارهای Canvas به حداقل ۴۴ پیکسل",
      "انتقال کنترل بستن تمام‌صفحه به همان گروه زوم، دست و جا‌دادن",
      "سازگاری Dock با نمایشگرهای عریض و عرض‌های کوچک",
    ],
  },
  {
    version: "0.19.0",
    dateTime: "2026-07-31",
    dateLabel: "۹ مرداد ۱۴۰۵",
    changes: [
      "افزودن زوم نقطه‌محور با Wheel و کنترل‌های دقیق به تمام‌صفحهٔ مطالعه",
      "افزودن جابه‌جایی نمودار با درگ و ابزار دست فعال در تمام‌صفحه",
      "اصلاح کامل Hand Tool استودیو برای درگ از نمودار یا فضای خالی Canvas",
      "افزودن جا‌دادن هوشمند طول و عرض کامل نمودار در کادر Canvas",
    ],
  },
  {
    version: "0.18.1",
    dateTime: "2026-07-31",
    dateLabel: "۹ مرداد ۱۴۰۵",
    changes: [
      "حفظ عنوان‌های فارسی داخل گره‌های فلوچارت و سایر نمودارهای Mermaid",
      "تضمین برابری SVG استودیو و سند با آزمون خودکار هر ۱۸ نمونه",
      "پشتیبانی امن از عنوان‌های HTML-in-SVG و خروجی نمودار C4",
      "افزودن نمای تمام‌صفحهٔ نمودار در حالت مطالعه به‌جای کنترل ویرایش",
    ],
  },
  {
    version: "0.18.0",
    dateTime: "2026-07-31",
    dateLabel: "۹ مرداد ۱۴۰۵",
    changes: [
      "پشتیبانی امن و lazy از بلوک‌های استاندارد Mermaid",
      "افزودن استودیوی تمام‌صفحه با کد، پیش‌نمایش زنده، نمونه‌ها و کنترل نما",
      "ویرایش دقیق همان بلوک با تشخیص تعارض و بازیابی پیش‌نویس",
      "افزودن Alt+M مستقل از زبان صفحه‌کلید و سازگاری تم، چاپ، md و ravi",
    ],
  },
  {
    version: "0.17.0",
    dateTime: "2026-07-31",
    dateLabel: "۹ مرداد ۱۴۰۵",
    changes: [
      "افزودن جریان کامل ساخت فایل جدید",
      "اعتبارسنجی نام و مدیریت خودکار پسوندهای md و ravi",
      "هشدار تغییرات ذخیره‌نشده و عنوان اولیهٔ اختیاری",
      "ساخت فایل واقعی و بازکردن مستقیم آن در نمای ویرایش",
    ],
  },
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
      "افزودن تم روشن و تاریک ماندگار با تغییر نرم و میان‌بر مستقل از زبان",
    ],
  },
  {
    version: "0.11.0",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "تمرکز نمای مطالعه روی نام فایل و بازگشت سریع به میز",
      "پنهان‌شدن هدر هنگام خواندن رو به پایین و بازگشت آن هنگام اسکرول رو به بالا",
    ],
  },
  {
    version: "0.10.0",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "تشخیص جهت سند و نمایش کامل متن انگلیسی به‌صورت LTR",
      "تشخیص جهت هر بلوک در سندهای ترکیبی با آستانهٔ ۷۰٪ متن لاتین",
    ],
  },
  {
    version: "0.9.0",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "افزودن نمای مطالعه و فهرست فصل‌های استخراج‌شده از تیترهای Markdown",
      "جمع‌کردن کامل فهرست و بازکردن دوبارهٔ آن از کنار نام فایل",
    ],
  },
  {
    version: "0.8.0",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "قفل اسکرول نسبی و دوطرفه میان ویرایشگر و پیش‌نمایش",
      "امکان اسکرول مستقل هر دو برگ در میز کار",
    ],
  },
  {
    version: "0.7.0",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "تبدیل کتابخانه به سایدبار جمع‌شونده با تب‌های تاریخچه و کتابخانه",
      "افزودن پوشه با یک آیکن و دسترسی سریع به فایل‌های محلی md و ravi",
    ],
  },
  {
    version: "0.6.0",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "ساده‌سازی نوار بالای میز و یکپارچه‌سازی عمل‌های اصلی فایل",
      "نمایش وضعیت ذخیره و تمرکز بیشتر بر متن و پیش‌نمایش",
    ],
  },
  {
    version: "0.5.0",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "سامانهٔ میان‌بر مرکزی با پشتیبانی از کیبورد فارسی و انگلیسی",
      "نمایش راهنمای میان‌برها و جلوگیری از تداخل کلیدهای مرورگر",
    ],
  },
  {
    version: "0.4.0",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "نسخه‌دهی سند هنگام ذخیره و نگه‌داری تاریخچهٔ نسخه‌ها",
      "تکمیل کتابخانهٔ محلی و نمایش فایل‌های قبلاً بازشده",
    ],
  },
  {
    version: "0.3.3",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "تعاملی‌شدن هایلایت، کامنت و حاشیه‌نویسی در خود متن",
      "بازشدن پنل یادداشت با کلیک و نمایش پیش‌نمایش با hover",
    ],
  },
  {
    version: "0.3.2",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "افزودن هایلایت، کامنت و حاشیه‌نویسی قابل‌اشتراک در قالب .ravi",
      "ذخیرهٔ Markdown و یادداشت‌ها در یک سند محلی",
    ],
  },
  {
    version: "0.3.1",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "افزودن راهنمای اشتراک‌گذاری سند با پسوند .ravi داخل رابط",
    ],
  },
  {
    version: "0.3.0",
    dateTime: "2026-07-29",
    dateLabel: "۷ مرداد ۱۴۰۵",
    changes: [
      "ساخت نسخهٔ دسکتاپ ویندوز و نصب‌کنندهٔ آفلاین راوی",
      "بازشدن فایل‌های .md، .markdown و .ravi با راوی از Explorer",
    ],
  },
  {
    version: "0.2.0",
    dateTime: "2026-07-29",
    dateLabel: "۷ مرداد ۱۴۰۵",
    changes: [
      "افزودن اسکن پوشهٔ محلی و مرور سریع کتابخانهٔ Markdown",
    ],
  },
  {
    version: "0.1.0",
    dateTime: "2026-07-29",
    dateLabel: "۷ مرداد ۱۴۰۵",
    changes: [
      "نخستین نسخهٔ راوی: ویرایش و پیش‌نمایش زندهٔ Markdown فارسی با چیدمان RTL",
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
