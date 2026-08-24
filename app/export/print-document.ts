const PRINT_ROOT_ID = "raavi-print-root";
const PRINT_ACTIVE_ATTRIBUTE = "data-raavi-print-document";

const UI_ONLY_SELECTOR = [
  ".mermaid-diagram-action",
  ".mermaid-diagram-viewport-tools",
  ".mermaid-diagram-hint",
  ".selection-range-feedback",
  ".reading-document-kicker",
].join(",");

const ID_REFERENCE_ATTRIBUTES = [
  "aria-controls",
  "aria-describedby",
  "aria-details",
  "aria-errormessage",
  "aria-flowto",
  "aria-labelledby",
  "aria-owns",
] as const;

function remapCloneIds(root: HTMLElement) {
  const idMap = new Map<string, string>();
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];

  for (const [index, element] of elements.entries()) {
    if (!element.id) continue;
    const nextId = `raavi-print-${index + 1}`;
    idMap.set(element.id, nextId);
    element.id = nextId;
  }

  for (const element of elements) {
    for (const attribute of ID_REFERENCE_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const remapped = value
        .split(/\s+/u)
        .map((id) => idMap.get(id) ?? id)
        .join(" ");
      element.setAttribute(attribute, remapped);
    }

    const htmlFor = element.getAttribute("for");
    if (htmlFor && idMap.has(htmlFor)) {
      element.setAttribute("for", idMap.get(htmlFor)!);
    }

    const href = element.getAttribute("href");
    if (href?.startsWith("#")) {
      const target = href.slice(1);
      if (idMap.has(target)) element.setAttribute("href", `#${idMap.get(target)}`);
    }
  }
}

function waitForImage(image: HTMLImageElement) {
  return new Promise<void>((resolve) => {
    let timer = 0;
    const finish = () => {
      window.clearTimeout(timer);
      image.removeEventListener("load", finish);
      image.removeEventListener("error", finish);
      const decode = image.decode?.();
      if (!decode) {
        resolve();
        return;
      }
      void decode.catch(() => undefined).finally(resolve);
    };

    if (image.complete) {
      finish();
      return;
    }

    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
    timer = window.setTimeout(finish, 5_000);
  });
}

function normalizePrintableArticle(article: HTMLElement) {
  const documentHeading = article.querySelector(":scope > h1");
  const metadataHeading = documentHeading?.previousElementSibling;
  const thematicBreak = metadataHeading?.previousElementSibling;
  if (
    thematicBreak?.matches("hr") &&
    metadataHeading?.matches("h2") &&
    documentHeading?.matches("h1")
  ) {
    thematicBreak.remove();
    metadataHeading.remove();
  }
  article.removeAttribute("data-raavi-frontmatter");

  article
    .querySelectorAll<HTMLElement>(
      '[data-footnotes] h2, h2#footnote-label, h2[id$="footnote-label"]',
    )
    .forEach((heading) => heading.remove());

  article
    .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    .forEach((checkbox) => {
      const marker = document.createElement("span");
      marker.className = "raavi-print-checkbox";
      marker.textContent = checkbox.checked ? "☑" : "☐";
      marker.setAttribute("aria-hidden", "true");
      checkbox.replaceWith(marker);
    });
}

export type StagedPrintDocument = {
  root: HTMLElement;
  cleanup: () => void;
};

export async function stagePrintDocument(
  sourceArticle: HTMLElement | null,
  fileName: string,
): Promise<StagedPrintDocument> {
  if (!sourceArticle?.isConnected) throw new Error("PRINT_ARTICLE_UNAVAILABLE");

  document.getElementById(PRINT_ROOT_ID)?.remove();

  const root = document.createElement("main");
  root.id = PRINT_ROOT_ID;
  root.className = "raavi-print-document";
  root.dir = sourceArticle.dir || "auto";
  root.dataset.fileName = fileName;
  root.setAttribute("aria-hidden", "true");

  const article = sourceArticle.cloneNode(true) as HTMLElement;
  article.classList.remove("has-annotation-hover");
  article.classList.add("raavi-print-article");
  article.removeAttribute("tabindex");
  article.querySelectorAll(UI_ONLY_SELECTOR).forEach((element) => element.remove());
  normalizePrintableArticle(article);
  remapCloneIds(article);
  root.appendChild(article);

  document.body.appendChild(root);
  document.documentElement.setAttribute(PRINT_ACTIVE_ATTRIBUTE, "");

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    root.remove();
    document.documentElement.removeAttribute(PRINT_ACTIVE_ATTRIBUTE);
  };

  try {
    await document.fonts?.ready;
    const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
    await Promise.allSettled(images.map(waitForImage));
    return { root, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}
