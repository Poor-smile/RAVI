export const STARTUP_RECOVERY_TIMEOUT_MS = 15_000;

const COPY = Object.freeze({
  loading: {
    title: "راوی در حال آماده‌کردن سند است",
    description: "فایل را می‌خوانیم و آخرین وضعیت میز را بازیابی می‌کنیم…",
    status: "در حال آماده‌سازی",
  },
  error: {
    title: "بازکردن راوی بیشتر از حد معمول طول کشید",
    description:
      "فایل شما دست‌نخورده مانده است. دوباره تلاش کنید تا میز از نو بارگذاری شود.",
    status: "نیاز به تلاش دوباره",
  },
});

function normalizedTheme(theme) {
  return theme === "dark" ? "dark" : "light";
}

function normalizedState(state) {
  return state === "error" ? "error" : "loading";
}

export function startupOverlayHtml({
  theme = "light",
  state = "loading",
  logoDataUrl = "",
} = {}) {
  const safeTheme = normalizedTheme(theme);
  const safeState = normalizedState(state);
  const copy = COPY[safeState];
  const isError = safeState === "error";

  return `<!doctype html>
<html lang="fa" dir="rtl" data-theme="${safeTheme}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>راوی</title>
  <style>
    :root {
      color-scheme: light;
      --paper: #f5f6f0;
      --paper-strong: #fcfdf9;
      --ink: #171b18;
      --muted: #687168;
      --rule: #cbd0c6;
      --blue: #2557e5;
      --blue-soft: #e9efff;
      --danger: #b9382f;
      --danger-soft: #fff0ed;
    }
    :root[data-theme="dark"] {
      color-scheme: dark;
      --paper: #141a16;
      --paper-strong: #181e1a;
      --ink: #f2f5f1;
      --muted: #aeb8af;
      --rule: #354039;
      --blue: #86a8ff;
      --blue-soft: #202e50;
      --danger: #ff9c92;
      --danger-soft: #3b211e;
    }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    body {
      background: var(--paper);
      color: var(--ink);
      font-family: IRANSansX, IRANSans, Vazirmatn, Tahoma, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .window-bar {
      position: relative;
      height: 44px;
      display: grid;
      place-items: center;
      border-block-end: 1px solid var(--rule);
      background: var(--paper-strong);
      -webkit-app-region: drag;
      user-select: none;
    }
    .window-brand { font-size: 13px; font-weight: 700; }
    .window-controls {
      position: absolute;
      inset-block-start: 0;
      inset-inline-end: 0;
      height: 44px;
      display: flex;
      direction: ltr;
      -webkit-app-region: no-drag;
    }
    .window-control {
      width: 46px;
      height: 44px;
      display: grid;
      place-items: center;
      color: var(--ink);
      text-decoration: none;
      font-family: inherit;
      font-size: 16px;
      outline: none;
    }
    .window-control:hover, .window-control:focus-visible { background: var(--blue-soft); }
    .window-control.is-close:hover, .window-control.is-close:focus-visible {
      color: #fff;
      background: #c42b1c;
    }
    .stage {
      min-height: calc(100% - 44px);
      display: grid;
      place-items: center;
      padding: 36px;
    }
    .launch {
      width: min(520px, calc(100vw - 48px));
      display: grid;
      justify-items: center;
      text-align: center;
    }
    .brand-icon {
      width: 64px;
      height: 64px;
      display: block;
      object-fit: contain;
    }
    h1 {
      max-width: 26ch;
      margin: 22px 0 8px;
      font-size: clamp(20px, 2.4vw, 24px);
      line-height: 1.6;
      letter-spacing: -0.02em;
    }
    p {
      max-width: 46ch;
      margin: 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.9;
    }
    .progress {
      width: min(320px, 70vw);
      height: 3px;
      margin-block-start: 30px;
      overflow: hidden;
      background: var(--rule);
    }
    .progress > span {
      display: block;
      width: 36%;
      height: 100%;
      background: var(--blue);
      animation: proof 1.35s cubic-bezier(.2,.8,.2,1) infinite;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      margin-block-start: 14px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }
    .status::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${isError ? "var(--danger)" : "var(--blue)"};
    }
    .retry {
      min-height: 40px;
      margin-block-start: 24px;
      padding: 0 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      background: var(--blue);
      color: #fcfdf9;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      outline: none;
    }
    .retry:hover, .retry:focus-visible { filter: brightness(.92); }
    .error-note {
      margin-block-start: 12px;
      color: var(--danger);
      font-size: 12px;
    }
    @keyframes proof {
      from { transform: translateX(190%); }
      to { transform: translateX(-290%); }
    }
    @media (prefers-reduced-motion: reduce) {
      .progress > span { animation: none; width: 100%; opacity: .7; }
    }
  </style>
</head>
<body>
  <header class="window-bar">
    <strong class="window-brand">راوی</strong>
    <nav class="window-controls" aria-label="کنترل‌های پنجره">
      <a class="window-control" href="raavi-window://minimize" aria-label="کمینه‌کردن" title="کمینه‌کردن">−</a>
      <a class="window-control" href="raavi-window://maximize" aria-label="بزرگ‌کردن پنجره" title="بزرگ‌کردن پنجره">□</a>
      <a class="window-control is-close" href="raavi-window://close" aria-label="بستن" title="بستن">×</a>
    </nav>
  </header>
  <main class="stage">
    <section class="launch" role="${isError ? "alert" : "status"}" aria-live="polite">
      ${logoDataUrl ? `<img class="brand-icon" src="${logoDataUrl}" alt="" />` : ""}
      <h1>${copy.title}</h1>
      <p>${copy.description}</p>
      ${
        isError
          ? `<a class="retry" href="raavi-retry://reload">تلاش دوباره</a>
             <span class="error-note">در این فرایند محتوای فایل تغییر نمی‌کند.</span>`
          : `<div class="progress" aria-hidden="true"><span></span></div>`
      }
      <span class="status">${copy.status}</span>
    </section>
  </main>
</body>
</html>`;
}

export function startupOverlayDataUrl(options) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(startupOverlayHtml(options))}`;
}
