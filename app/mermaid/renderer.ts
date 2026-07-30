export type MermaidTheme = "light" | "dark";

export type MermaidRenderError = {
  message: string;
  technical: string;
  line?: number;
  column?: number;
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

function parseError(error: unknown): MermaidRenderError {
  const technical =
    error instanceof Error ? error.message : String(error || "Unknown error");
  const lineMatch =
    technical.match(/line\s+(\d+)(?::(\d+))?/iu) ??
    technical.match(/(\d+):(\d+)/u);
  const line = lineMatch?.[1] ? Number(lineMatch[1]) : undefined;
  const column = lineMatch?.[2] ? Number(lineMatch[2]) : undefined;
  return {
    kind: "syntax",
    message: line
      ? `ساختار نمودار در خط ${line.toLocaleString("fa-IR")}${
          column ? `، ستون ${column.toLocaleString("fa-IR")}` : ""
        } نیاز به اصلاح دارد.`
      : "ساختار Mermaid کامل نیست؛ کد را بررسی کنید.",
    technical,
    line,
    column,
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

function sanitizeSvg(svg: string) {
  const documentNode = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (documentNode.querySelector("parsererror")) {
    throw new Error("خروجی SVG قابل پردازش نبود.");
  }

  documentNode
    .querySelectorAll(
      "script, foreignObject, iframe, object, embed, audio, video, image, use",
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
        if (
          /(?:javascript:|data:|https?:|file:|\/\/)/iu.test(value) ||
          name === "href" ||
          name === "xlink:href" ||
          name === "src"
        ) {
          element.removeAttribute(attribute.name);
        }
      }
    }
  });

  const root = documentNode.documentElement;
  root.setAttribute("role", "img");
  root.setAttribute("focusable", "false");
  root.setAttribute("preserveAspectRatio", "xMidYMid meet");
  root.removeAttribute("height");
  root.removeAttribute("width");
  root.setAttribute(
    "style",
    "max-width:100%;height:auto;font-family:IRANSansX,IRANSans,Tahoma,Arial,sans-serif;",
  );
  return new XMLSerializer().serializeToString(root);
}

async function renderUncached(code: string, theme: MermaidTheme) {
  const mermaidModule = await import("mermaid");
  const mermaid = mermaidModule.default;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: theme === "dark" ? "dark" : "default",
    fontFamily: "IRANSansX, IRANSans, Tahoma, Arial, sans-serif",
    suppressErrorRendering: true,
    deterministicIds: true,
    deterministicIDSeed: hashText(`${theme}:${code}`),
    flowchart: { htmlLabels: false, useMaxWidth: true },
  });
  await mermaid.parse(code, { suppressErrors: false });
  renderSequence += 1;
  const { svg } = await mermaid.render(
    `raavi-mermaid-${hashText(code)}-${renderSequence}`,
    code,
  );
  return sanitizeSvg(svg);
}

export async function renderMermaid(
  code: string,
  theme: MermaidTheme,
): Promise<MermaidRenderResult> {
  const limited = limitError(code);
  if (limited) return { ok: false, error: limited };
  const key = `${theme}:${hashText(code)}`;
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
    return { ok: false, error: parseError(error) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
