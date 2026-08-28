"use client";

import {
  BookOpen,
  FileArchive,
  Heart,
  History,
  ImagePlus,
  Library,
  MessageSquareText,
  Network,
  PanelLeftOpen,
  ShieldCheck,
  X,
} from "@/app/icons/material-symbols";
import { RefObject, useRef } from "react";
import { AccessibleModal } from "./accessible-modal";

const UNIQUE_FEATURES = [
  {
    icon: Network,
    title: "نمودار، بخشی از خود سند",
    description:
      "بلوک استاندارد Mermaid در Markdown دست‌نخورده می‌ماند، امن رندر می‌شود و با دوبارکلیک در استودیوی زندهٔ فارسی باز می‌گردد.",
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
      "فایل استاندارد Markdown متن، هایلایت‌ها و نظرها را به‌صورت قابل‌حمل نگه می‌دارد.",
  },
  {
    icon: ImagePlus,
    title: "تصویر، همراهِ خودِ سند",
    description:
      "تصویر محلی در پوشهٔ سند می‌ماند؛ تصویر اینترنتی فقط با URL ارجاع داده می‌شود تا فایل سبک بماند.",
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
      "هایلایت و نظر به بخش انتخاب‌شده متصل می‌مانند و با hover پیش‌نمایش و با کلیک پنل کامل خود را نشان می‌دهند.",
  },
] as const;

const SUPPORTERS = [
  "اندیشکده حکمرانی شریف",
  "مهدی میرزائی",
  "امیرمحمد شفیعی",
] as const;

const RELEASES = [
  {
    version: "2.2.0",
    dateTime: "2026-08-28",
    dateLabel: "۶ شهریور ۱۴۰۵",
    changes: [
      "بروزرسانی داخلی Windows و macOS با انتخاب خودکار معماری، دانلود پس‌زمینه، مکث و ادامه، اعتبارسنجی امضا و بنر وضعیت پایین راست",
      "راه‌اندازی هوشمند مخزن، ChatGPT/Codex CLI و Google Drive یا Proton Drive",
      "پشتیبان‌گیری و بازیابی انتخابی مخزن و بهبود تنظیمات، پیمایش بلاکی و مینی‌منوی ویرایش",
    ],
  },
  {
    version: "2.1.13",
    dateTime: "2026-08-27",
    dateLabel: "۵ شهریور ۱۴۰۵",
    changes: [
      "بررسی واقعی اتصال ChatGPT و سرویس بکاپ هنگام اجرای First Run، حتی پس از به‌روزرسانی",
      "پنهان‌شدن راه‌اندازی خودکار فقط وقتی ChatGPT و دست‌کم یکی از Google Drive یا Proton Drive متصل باشند",
    ],
  },
  {
    version: "2.1.4",
    dateTime: "2026-08-25",
    dateLabel: "۳ شهریور ۱۴۰۵",
    changes: [
      "ساده‌سازی راوی هوشمند به یک اتصال ChatGPT با ورود، بررسی و اتصال دوباره",
      "نمایش فهرست واقعی مدل‌های قابل استفادهٔ حساب و ذخیرهٔ مدل انتخابی",
      "حذف کامل زیرساخت اجرایی Claude، Gemini، Cursor و Copilot",
    ],
  },
  {
    version: "2.1.3",
    dateTime: "2026-08-25",
    dateLabel: "۳ شهریور ۱۴۰۵",
    changes: [
      "افزودن قطع و بازنشانی امن اتصال هر موتور برای ورود و آزمون دوباره",
      "بهبود تشخیص Cursor، لینک نصب Gemini و گزارش روشن محدودیت دسترسی Copilot",
    ],
  },
  {
    version: "2.1.2",
    dateTime: "2026-08-25",
    dateLabel: "۳ شهریور ۱۴۰۵",
    changes: [
      "ماندگارشدن موتور هوش مصنوعی پیش‌فرض و مدل انتخابی پس از بستن تنظیمات یا اجرای دوبارهٔ برنامه",
    ],
  },
  {
    version: "2.1.1",
    dateTime: "2026-08-25",
    dateLabel: "۳ شهریور ۱۴۰۵",
    changes: [
      "افزودن Cursor Agent و GitHub Copilot CLI به شناسایی، آزمون اتصال و انتخاب موتور پیش‌فرض",
      "اجرای درخواست‌های راوی با مدل انتخابی Cursor یا Copilot در حالت محدود و بدون دسترسی نوشتن",
    ],
  },
  {
    version: "2.1.0",
    dateTime: "2026-08-25",
    dateLabel: "۳ شهریور ۱۴۰۵",
    changes: [
      "افزودن بلاک صوت قابل‌حمل با پخش محلی و نگه‌داری فایل در دارایی‌های استاندارد سند",
      "تبدیل گفتار کاملاً محلی با سه سطح مدل، دانلود امن و نمایش پیشرفت قابل توقف",
      "ارائهٔ متن خام زمان‌دار و خروجی ساختاریافته برای جلسه، درس، مصاحبه و محتوای عمومی",
      "بازطراحی استودیوی نمودار با ۲۹ نوع، جست‌وجو، پیش‌نمایش زنده و سه مسیر ساخت آسان، کد و راوی هوشمند",
      "افزودن انیمیشن شش‌ثانیه‌ای تأییدشدهٔ فیگما به بوم ساخت نمودار",
      "پشتیبانی از directiveهای ابتدایی Mermaid هنگام تشخیص و ویرایش نمودارهای موجود",
      "انتشار رسمی Windows با Electron و فایل‌های استاندارد Markdown",
    ],
  },
  {
    version: "1.5.3",
    dateTime: "2026-08-21",
    dateLabel: "۳۰ مرداد ۱۴۰۵",
    changes: [
      "حذف کامل نقش Enter در ساخت بلاک و حفظ ویرایش چندخطی در همان بلاک",
      "افزودن فهرست‌های تو‌در‌تو با Tab و Shift+Tab برای Bullet، Numbered و Todo",
      "یکپارچه‌شدن انتخاب، تکثیر، جابه‌جایی و Drag برای کل بلاک فعال",
    ],
  },
  {
    version: "1.5.2",
    dateTime: "2026-08-08",
    dateLabel: "۱۷ مرداد ۱۴۰۵",
    changes: [
      "مرکزشدن برگ مطالعه پس از جمع‌کردن فهرست فصل‌ها",
      "فعال‌ماندن ویرایش و پیش‌نمایش لندینگ در صورت در دسترس نبودن landing.md",
      "تازه‌شدن نسخهٔ وب، صفحهٔ معرفی و بسته‌های Windows و cPanel",
    ],
  },
  {
    version: "1.5.0",
    dateTime: "2026-08-05",
    dateLabel: "۱۴ مرداد ۱۴۰۵",
    changes: [
      "افزودن خروجی Word قابل‌ویرایش و PDF همسان با پیش‌نمایش خواندن",
      "چاپ PDF در سند مستقل، بدون رابط کاربری و بدون سربرگ و پابرگ مرورگر",
      "صفحهٔ A4، انتقال frontmatter و حفظ ساختار عنوان‌ها، جدول‌ها و فهرست‌ها در Word",
      "Mermaid برداری یا ۴۸۰ DPI با کنترل شکست نمودار پیش از ساخت خروجی",
    ],
  },
  {
    version: "1.4.1",
    dateTime: "2026-08-03",
    dateLabel: "۱۲ مرداد ۱۴۰۵",
    changes: [
      "جداسازی وضعیت موبایل و دسکتاپ و بازطراحی هدر برای جلوگیری از مسیرهای مسدود",
      "بازکردن مطمئن فایل از منوی موبایل و بستن لایه‌ها به‌ترتیب با Back",
      "رفع بیرون‌زدگی چیدمان، هدف‌های لمسی حداقل ۴۴×۴۴ و متن‌های عملیاتی خواناتر",
      "حفظ جای خواندن پس از تمام‌صفحه و پایدارتر شدن رندر Mermaid در سندهای بزرگ",
    ],
  },
  {
    version: "1.3.1",
    dateTime: "2026-08-03",
    dateLabel: "۱۲ مرداد ۱۴۰۵",
    changes: [
      "پایدار شدن حالت مطالعه هنگام آماده‌شدن تعداد زیادی نمودار Mermaid",
      "رندر تنبل نمودارهای دور از دید برای بازکردن و پیمایش روان‌تر سندهای بزرگ",
      "محاسبهٔ مهلت رندر از زمان اجرای واقعی هر نمودار به‌جای زمان انتظار در صف",
      "ثابت ماندن ارتفاع صفحه و جای خواندن در سندهای سنگین نموداری",
    ],
  },
  {
    version: "1.3.0",
    dateTime: "2026-08-01",
    dateLabel: "۱۰ مرداد ۱۴۰۵",
    changes: [
      "بازیابی دقیق‌تر جای خواندن پس از reload، بازکردن فایل و آماده‌شدن تصویر یا نمودار",
      "بهبود استودیوی Mermaid با سازندهٔ سادهٔ فارسی، نمونه‌های بیشتر و خطاهای روشن‌تر",
      "پایدارتر شدن رندر نمودارها و جلوگیری از تکثیر یا بازسازی ناخواستهٔ SVG هنگام اسکرول",
      "ذخیرهٔ مطمئن‌تر وضعیت مطالعه در نسخه‌های دسکتاپ Electron و Tauri",
    ],
  },
  {
    version: "1.1.0",
    dateTime: "2026-07-31",
    dateLabel: "۹ مرداد ۱۴۰۵",
    changes: [
      "بهبود ویرایشگر Markdown با فونت کدنویسی خواناتر و تجربهٔ پایدارتر برای متن‌های طولانی",
      "یکدست‌تر شدن میان‌برهای صفحه‌کلید در ویرایشگر، کتابخانه، ذخیره و درج تصویر",
      "آماده‌سازی بستهٔ تازهٔ نسخهٔ وب برای انتشار ایستا و بارگذاری روی هاست",
      "انتشار نسخهٔ دسکتاپ Windows با مسیر Tauri کم‌حجم، نصب‌کننده و فایل قابل‌حمل تازه",
    ],
  },
  {
    version: "1.0.0",
    dateTime: "2026-07-31",
    dateLabel: "۹ مرداد ۱۴۰۵",
    changes: [
      "انتشار نخستین نسخهٔ پایدار راوی برای وب و ویندوز",
      "افزودن صفحهٔ حمایت با دسترسی مستقیم به دارمت، کانال بروزرسانی‌ها و وب‌سایت رسمی",
      "افزودن فهرست حامیان در شناسنامهٔ محصول و آماده‌سازی نصب‌کنندهٔ ویندوز نسخهٔ ۱.۰.۰",
      "افزودن خروجی AppImage، DEB و آرشیو portable برای Linux و پیکربندی DMG/ZIP Universal برای macOS",
    ],
  },
  {
    version: "0.20.1",
    dateTime: "2026-07-31",
    dateLabel: "۹ مرداد ۱۴۰۵",
    changes: [
      "تبدیل مسیر URL تصویر به ارجاع مستقیم، بدون دانلود یا افزودن دادهٔ اضافه به سند",
      "نمایش تصویر اینترنتی با بارگذاری تنبل و بدون ارسال referrer",
      "ساده‌سازی متن و دکمهٔ مدال به «درج نشانی» با توضیح وابستگی به اینترنت",
    ],
  },
  {
    version: "0.20.0",
    dateTime: "2026-07-31",
    dateLabel: "۹ مرداد ۱۴۰۵",
    changes: [
      "افزودن مدال درج تصویر از فایل محلی یا URL با آیکن اختصاصی و میان‌بر Alt+I مستقل از زبان صفحه‌کلید",
      "پشتیبانی از PNG، JPEG، WebP و GIF با پیش‌نمایش فوری در سند و دریافت URL فقط با تأیید صریح کاربر",
      "مدیریت تصویرهای درج‌شده در پوشهٔ سند و حفظ ارجاع استاندارد Markdown",
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
      "افزودن Alt+M مستقل از زبان صفحه‌کلید و سازگاری تم، چاپ و Markdown",
    ],
  },
  {
    version: "0.17.0",
    dateTime: "2026-07-31",
    dateLabel: "۹ مرداد ۱۴۰۵",
    changes: [
      "افزودن جریان کامل ساخت فایل جدید",
      "اعتبارسنجی نام و مدیریت خودکار پسوندهای Markdown",
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
      "مینی‌منوی شناور هایلایت و نظر",
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
      "افزودن پوشه با یک آیکن و دسترسی سریع به فایل‌های محلی Markdown",
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
      "تعاملی‌شدن هایلایت و نظر در خود متن",
      "بازشدن پنل نظر با کلیک و نمایش پیش‌نمایش با hover",
    ],
  },
  {
    version: "0.3.2",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "افزودن هایلایت و نظر قابل‌اشتراک در فایل استاندارد Markdown",
      "ذخیرهٔ Markdown و یادداشت‌ها در یک سند محلی",
    ],
  },
  {
    version: "0.3.1",
    dateTime: "2026-07-30",
    dateLabel: "۸ مرداد ۱۴۰۵",
    changes: [
      "افزودن راهنمای اشتراک‌گذاری نشانه‌ها در Markdown داخل رابط",
    ],
  },
  {
    version: "0.3.0",
    dateTime: "2026-07-29",
    dateLabel: "۷ مرداد ۱۴۰۵",
    changes: [
      "ساخت نسخهٔ دسکتاپ ویندوز و نصب‌کنندهٔ آفلاین راوی",
      "بازشدن فایل‌های .md و .markdown با راوی از Explorer",
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
  returnFocusRef: RefObject<HTMLElement | null>;
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
            بازبینی متن به آن نیاز دارید.
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
          className="about-section about-supporters"
          aria-labelledby="about-supporters-title"
        >
          <div className="about-section-heading">
            <Heart size={19} fill="currentColor" aria-hidden="true" />
            <div>
              <h3 id="about-supporters-title">حامیان راوی</h3>
              <p>
                همراهانی که به ادامهٔ توسعهٔ رایگان و مستقل راوی کمک کرده‌اند.
              </p>
            </div>
          </div>
          <ul className="about-supporter-list">
            {SUPPORTERS.map((supporter) => (
              <li key={supporter}>
                <span aria-hidden="true">{supporter.slice(0, 1)}</span>
                <strong>{supporter}</strong>
              </li>
            ))}
          </ul>
          <p className="about-supporter-note">
            برای ثبت نامتان در این فهرست، نام دلخواه را در پیام حمایت دارمت
            بنویسید.
          </p>
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
