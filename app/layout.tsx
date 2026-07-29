import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "راوی — ویور Markdown فارسی",
  description:
    "فایل Markdown فارسی را باز کنید، با پیش‌نمایش RTL ویرایش کنید و دوباره تحویل بگیرید.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
