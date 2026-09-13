import type { Metadata, Viewport } from "next";
import { BackLayerProvider } from "./components/back-layer-provider";
import "./globals.css";
import "./components/corrective-fidelity.css";

const themeBootScript = `
(() => {
  const storageKey = "raavi:theme:v1";
  const appearanceKey = "raavi:appearance-preferences:v1";
  try {
    const storedTheme = window.localStorage.getItem(storageKey);
    let appearance = {};
    try {
      appearance = JSON.parse(window.localStorage.getItem(appearanceKey) || "{}") || {};
    } catch {}
    const preference =
      appearance.theme === "system" || appearance.theme === "light" || appearance.theme === "dark"
        ? appearance.theme
        : storedTheme === "system" || storedTheme === "light" || storedTheme === "dark"
          ? storedTheme
          : "system";
    const theme = preference === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.dataset.accent = typeof appearance.accent === "string" ? appearance.accent : "raavi-blue";
    document.documentElement.dataset.motion = appearance.motion === "normal" || appearance.motion === "reduced" ? appearance.motion : "system";
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.themePreference = "system";
    document.documentElement.dataset.accent = "raavi-blue";
    document.documentElement.dataset.motion = "system";
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

export const metadata: Metadata = {
  title: "راوی — ویور Markdown فارسی",
  description:
    "فایل Markdown فارسی را باز کنید، با پیش‌نمایش RTL ویرایش کنید و دوباره تحویل بگیرید.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link
          rel="icon"
          href="/brand/raavi-icon-light.png"
          media="(prefers-color-scheme: light)"
        />
        <link
          rel="icon"
          href="/brand/raavi-icon-dark.png"
          media="(prefers-color-scheme: dark)"
        />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <BackLayerProvider>{children}</BackLayerProvider>
      </body>
    </html>
  );
}
