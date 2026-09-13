"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { isMobileWebDevice } from "../platform/desktop-access";

const subscribe = () => () => {};
const serverAccess = () => "pending" as const;
function browserAccess() {
  return isMobileWebDevice(navigator, Boolean(window.raaviDesktop)) ? "mobile" : "desktop";
}

export function DesktopAccessGate({ children }: { children: ReactNode }) {
  // Server and first hydration render agree. The workspace never mounts on mobile,
  // so it cannot restore, migrate or overwrite an existing local document there.
  const access = useSyncExternalStore(subscribe, browserAccess, serverAccess);
  if (access === "desktop") return children;
  if (access === "pending") return (
    <main className="desktop-access-notice" dir="rtl" data-device-access="pending">
      <p role="status">در حال باز کردن راوی…</p>
      <noscript>راوی یک نرم‌افزار دسکتاپ است. برای استفاده، همین نشانی را با جاوااسکریپت فعال در مرورگر رایانه باز کنید.</noscript>
    </main>
  );
  return (
    <main className="desktop-access-notice" dir="rtl" data-device-access={access}>
      <div className="desktop-access-copy">
        <span className="desktop-access-brand">راوی</span>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="2.5" y="3.5" width="19" height="13" rx="1.5" />
          <path d="M12 16.5v4m-4 0h8" />
        </svg>
        <h1>راوی یک نرم‌افزار دسکتاپ است</h1>
        <p>برای استفاده از راوی، همین نشانی را در مرورگر رایانه یا لپ‌تاپ خود باز کنید.</p>
        <p>ویرایشگر راوی در موبایل و تبلت در دسترس نیست.</p>
        <noscript>برای باز کردن ویرایشگر در رایانه، جاوااسکریپت مرورگر را فعال کنید.</noscript>
      </div>
    </main>
  );
}
