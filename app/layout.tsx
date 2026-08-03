import type { Metadata } from "next";
import { BackLayerProvider } from "./components/back-layer-provider";
import "./globals.css";

const themeBootScript = `
(() => {
  const storageKey = "raavi:theme:v1";
  try {
    const storedTheme = window.localStorage.getItem(storageKey);
    const theme =
      storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

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
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <BackLayerProvider>{children}</BackLayerProvider>
      </body>
    </html>
  );
}
