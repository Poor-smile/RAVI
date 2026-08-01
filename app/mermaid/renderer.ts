import {
  detectMermaidKind,
  MermaidDiagramKind,
  PersianMermaidInputError,
  prepareMermaidForRender,
} from "./persian-adapter";

export type MermaidTheme = "light" | "dark";

export type MermaidRenderError = {
  message: string;
  technical: string;
  line?: number;
  column?: number;
  suggestion?: string;
  kind: "syntax" | "limit" | "timeout" | "security" | "unknown";
};

export type MermaidRenderResult =
  | { ok: true; svg: string; fromCache: boolean }
  | { ok: false; error: MermaidRenderError };

export const MERMAID_LIMITS = {
  characters: 40_000,
  lines: 1_000,
  renderTimeoutMs: 5_000,
} as const;

const renderCache = new Map<string, string>();
const MAX_CACHE_ENTRIES = 80;
let renderSequence = 0;
let renderQueue = Promise.resolve();

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

async function renderWithSerializableElements<T>(
  enabled: boolean,
  render: () => Promise<T>,
): Promise<T> {
  if (!enabled || typeof Element === "undefined") return render();

  const prototype = Element.prototype as Element & {
    toJSON?: () => { tagName: string; id?: string };
  };
  const previousDescriptor = Object.getOwnPropertyDescriptor(
    prototype,
    "toJSON",
  );

  try {
    Object.defineProperty(prototype, "toJSON", {
      configurable: true,
      value(this: Element) {
        return {
          tagName: this.tagName.toLocaleLowerCase("en-US"),
          ...(this.id ? { id: this.id } : {}),
        };
      },
    });
    return await render();
  } finally {
    if (previousDescriptor) {
      Object.defineProperty(prototype, "toJSON", previousDescriptor);
    } else {
      delete prototype.toJSON;
    }
  }
}

export function mermaidRenderKey(code: string, theme: MermaidTheme) {
  return `${theme}:${hashText(code)}`;
}

function parseError(error: unknown, code: string): MermaidRenderError {
  if (error instanceof PersianMermaidInputError) {
    return {
      kind: "syntax",
      message: error.message,
      technical: error.message,
      suggestion: error.suggestion,
      line: error.line,
    };
  }
  const technical =
    error instanceof Error ? error.message : String(error || "Unknown error");
  const lineMatch =
    technical.match(/line\s+(\d+)(?::(\d+))?/iu) ??
    technical.match(/(\d+):(\d+)/u);
  const line = lineMatch?.[1] ? Number(lineMatch[1]) : undefined;
  const column = lineMatch?.[2] ? Number(lineMatch[2]) : undefined;
  const kind = detectMermaidKind(code);
  const location = line
    ? `ردیف ${line.toLocaleString("fa-IR")}${
        column ? `، ستون ${column.toLocaleString("fa-IR")}` : ""
      }`
    : "یکی از ردیف‌ها";
  const suggestion = /Expecting\s+'COMMA'|got\s+'EOF'/iu.test(technical)
    ? "هر ردیف را به سه بخش مبدأ، مقصد و مقدار تقسیم کنید. راوی ویرگول فارسی را هم می‌پذیرد."
    : /DQUOTE|ESCAPED_TEXT/iu.test(technical)
      ? "گیومهٔ باز و بستهٔ عنوان را بررسی کنید و برای متن‌های دارای ویرگول از گیومه استفاده کنید."
      : /Lexical error|Unrecognized text|unexpected character/iu.test(technical)
        ? "نویسهٔ مشخص‌شده با ساختار این نوع نمودار سازگار نیست؛ نمونهٔ صحیح همان نوع را باز کنید."
        : kind === "sankey"
          ? "هر مسیر سنکی باید سه بخش مبدأ، مقصد و مقدار داشته باشد."
          : "ردیف مشخص‌شده را با نمونهٔ صحیح همان نوع مقایسه کنید.";
  return {
    kind: "syntax",
    message: `${location} قابل خواندن نیست.`,
    technical,
    line,
    column,
    suggestion,
  };
}

function limitError(code: string): MermaidRenderError | null {
  const lines = code.split(/\r?\n/u).length;
  if (code.length > MERMAID_LIMITS.characters) {
    return {
      kind: "limit",
      message: "این نمودار برای رندر امن بیش از اندازه بزرگ است.",
      technical: `حداکثر ${MERMAID_LIMITS.characters} نویسه مجاز است.`,
    };
  }
  if (lines > MERMAID_LIMITS.lines) {
    return {
      kind: "limit",
      message: "تعداد خط‌های نمودار از سقف امن بیشتر است.",
      technical: `حداکثر ${MERMAID_LIMITS.lines} خط مجاز است.`,
    };
  }
  return null;
}

const DIAGRAM_TITLES: Record<MermaidDiagramKind, string> = {
  flowchart: "نمودار فرایند",
  sequence: "نمودار توالی",
  class: "نمودار کلاس",
  state: "نمودار حالت",
  er: "نمودار رابطهٔ موجودیت",
  requirement: "نمودار نیازمندی",
  architecture: "نمودار معماری",
  c4: "نمودار زمینهٔ سامانه",
  mindmap: "نقشهٔ ذهنی",
  timeline: "خط زمانی",
  kanban: "نمودار کانبان",
  gitgraph: "نمودار شاخه‌های Git",
  pie: "نمودار دایره‌ای",
  sankey: "نمودار جریان سنکی",
  journey: "نمودار سفر کاربر",
  quadrant: "نمودار چهارخانه",
  xychart: "نمودار XY",
  gantt: "نمودار گانت",
  swimlane: "نمودار مسیر مسئولیت",
  block: "نمودار بلوکی",
  packet: "نمودار ساختار بسته",
  radar: "نمودار رادار",
  eventmodeling: "نمودار مدل‌سازی رویداد",
  treemap: "نقشهٔ درختی مساحتی",
  venn: "نمودار ون",
  ishikawa: "نمودار علت و معلول",
  wardley: "نقشهٔ واردلی",
  cynefin: "چارچوب کینفین",
  treeview: "نمای درختی",
  other: "نمودار Mermaid",
};

function accessibleTitle(code: string, kind: MermaidDiagramKind) {
  const explicit =
    code.match(/^\s*accTitle\s*:\s*(.+)$/imu)?.[1] ??
    code.match(/^\s*title\s+"?([^"\r\n]+)"?\s*$/imu)?.[1];
  return explicit?.trim().slice(0, 160) || DIAGRAM_TITLES[kind];
}

export function sanitizeMermaidSvg(
  svg: string,
  options: {
    title?: string;
    labelMap?: ReadonlyMap<string, string>;
  } = {},
) {
  const parser = new DOMParser();
  let documentNode = parser.parseFromString(svg, "image/svg+xml");
  let root = documentNode.documentElement;
  if (documentNode.querySelector("parsererror")) {
    const htmlDocument = parser.parseFromString(svg, "text/html");
    const htmlSvg = htmlDocument.querySelector("svg");
    if (!htmlSvg) throw new Error("خروجی SVG قابل پردازش نبود.");
    documentNode = htmlDocument;
    root = htmlSvg;
  }

  documentNode
    .querySelectorAll(
      "script, iframe, object, embed, audio, video, image, img",
    )
    .forEach((node) => node.remove());

  documentNode.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLocaleLowerCase("en-US");
      const value = attribute.value.trim();
      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (
        name === "href" ||
        name === "xlink:href" ||
        name === "src" ||
        name === "style"
      ) {
        const isSafeLocalUse =
          element.localName === "use" &&
          (name === "href" || name === "xlink:href") &&
          /^#[A-Za-z_][\w:.-]*$/u.test(value);
        const hasExternalOrExecutableValue =
          /(?:javascript:|data:|https?:|file:|\/\/)/iu.test(value);
        if (
          hasExternalOrExecutableValue ||
          name === "src" ||
          ((name === "href" || name === "xlink:href") && !isSafeLocalUse)
        ) {
          element.removeAttribute(attribute.name);
        }
      }
    }
  });

  if (options.labelMap?.size) {
    const replacements = Array.from(options.labelMap.entries()).sort(
      ([left], [right]) => right.length - left.length,
    );
    documentNode.querySelectorAll("text, tspan").forEach((element) => {
      if (element.children.length > 0) return;
      const current = element.textContent?.trim();
      if (!current) return;
      const restored = replacements.reduce(
        (value, [token, original]) => value.replaceAll(token, original),
        current,
      ).replace(/[0-9]/gu, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)] ?? digit);
      if (restored !== current) element.textContent = restored;
    });
  }

  const existingTitle = Array.from(root.children).find(
    (element) => element.localName === "title",
  );
  const title = options.title?.trim() || existingTitle?.textContent?.trim();
  if (!existingTitle && title) {
    const titleElement = documentNode.createElementNS(
      "http://www.w3.org/2000/svg",
      "title",
    );
    titleElement.textContent = title;
    root.insertBefore(titleElement, root.firstChild);
  }

  root.setAttribute("role", "img");
  if (title) root.setAttribute("aria-label", title);
  root.setAttribute("focusable", "false");
  root.setAttribute("preserveAspectRatio", "xMidYMid meet");
  root.removeAttribute("height");
  root.removeAttribute("width");
  root.setAttribute(
    "style",
    "max-width:100%;height:auto;font-family:IRANSansX,IRANSans,Vazirmatn,Tahoma,Arial,sans-serif;",
  );
  return new XMLSerializer().serializeToString(root);
}

async function renderUncached(code: string, theme: MermaidTheme) {
  const prepared = prepareMermaidForRender(code);
  const mermaidModule = await import("mermaid");
  const mermaid = mermaidModule.default;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: theme === "dark" ? "dark" : "default",
    fontFamily: "IRANSansX, IRANSans, Vazirmatn, Tahoma, Arial, sans-serif",
    htmlLabels: false,
    suppressErrorRendering: true,
    deterministicIds: true,
    deterministicIDSeed: hashText(`${theme}:${prepared.code}`),
    flowchart: { htmlLabels: false, useMaxWidth: true },
  });
  await mermaid.parse(prepared.code, { suppressErrors: false });
  renderSequence += 1;
  // Mermaid 11.16's experimental Block renderer serializes its layout tree
  // while that tree still contains DOM nodes. React adds circular Fiber links
  // to those nodes, so protect only this queued render and restore the native
  // prototype immediately afterwards.
  const { svg } = await renderWithSerializableElements(
    prepared.kind === "block",
    () =>
      mermaid.render(
        `raavi-mermaid-${hashText(code)}-${renderSequence}`,
        prepared.code,
      ),
  );
  return sanitizeMermaidSvg(svg, {
    title: accessibleTitle(code, prepared.kind),
    labelMap: prepared.labelMap,
  });
}

export async function renderMermaid(
  code: string,
  theme: MermaidTheme,
): Promise<MermaidRenderResult> {
  const limited = limitError(code);
  if (limited) return { ok: false, error: limited };
  const key = mermaidRenderKey(code, theme);
  const cached = renderCache.get(key);
  if (cached) return { ok: true, svg: cached, fromCache: true };

  const queued = renderQueue.then(() => renderUncached(code, theme));
  renderQueue = queued.then(
    () => undefined,
    () => undefined,
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const svg = await Promise.race([
      queued,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("RAAVI_MERMAID_RENDER_TIMEOUT")),
          MERMAID_LIMITS.renderTimeoutMs,
        );
      }),
    ]);
    if (renderCache.size >= MAX_CACHE_ENTRIES) {
      const oldest = renderCache.keys().next().value;
      if (oldest) renderCache.delete(oldest);
    }
    renderCache.set(key, svg);
    return { ok: true, svg, fromCache: false };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "RAAVI_MERMAID_RENDER_TIMEOUT"
    ) {
      return {
        ok: false,
        error: {
          kind: "timeout",
          message: "رندر نمودار بیش از حد طول کشید و متوقف شد.",
          technical: `مهلت رندر ${MERMAID_LIMITS.renderTimeoutMs} میلی‌ثانیه است.`,
        },
      };
    }
    return { ok: false, error: parseError(error, code) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
