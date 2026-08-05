import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
  type FileChild,
  type ParagraphChild,
} from "docx";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { RaaviImageAsset } from "../raavi";
import { raaviImageAssetId } from "../raavi";
import { findMermaidBlocks } from "../mermaid/blocks";
import { scheduleMermaidRender } from "../mermaid/render-service";
import { extractWordFrontmatter } from "./frontmatter";

type AstNode = {
  type: string;
  value?: string;
  url?: string;
  alt?: string;
  lang?: string | null;
  depth?: number;
  ordered?: boolean | null;
  checked?: boolean | null;
  children?: AstNode[];
  position?: { start?: { offset?: number } };
};

type TextDirection = "ltr" | "rtl";

type InlineStyle = {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  code?: boolean;
};

type WordImageBase = {
  data: Uint8Array;
  width: number;
  height: number;
  name: string;
  description: string;
};

type RasterWordImage = WordImageBase & {
  type: "png" | "jpg" | "gif";
};

type SvgWordImage = WordImageBase & {
  type: "svg";
  fallback: {
    type: "png";
    data: Uint8Array;
  };
};

type WordImage = RasterWordImage | SvgWordImage;

export type WordExportStage =
  | "reading"
  | "diagrams"
  | "images"
  | "document";

export type WordExportWarning = {
  kind: "diagram" | "image" | "unsupported";
  message: string;
};

export type WordExportResult = {
  bytes: ArrayBuffer;
  warnings: WordExportWarning[];
  stats: {
    diagrams: number;
    embeddedImages: number;
  };
};

type WordExportOptions = {
  markdown: string;
  fileName: string;
  imageAssets: RaaviImageAsset[];
  onProgress?: (stage: WordExportStage, completed: number, total: number) => void;
};

const PAPER_TEXT = "171B18";
const MUTED_TEXT = "50584F";
const PROOF_BLUE = "2557E5";
const PROOF_BLUE_SOFT = "E9EFFF";
const RULE = "CBD0C6";
const CODE_BACKGROUND = "F1F3EE";
const MAX_IMAGE_WIDTH = 620;
const MAX_IMAGE_HEIGHT = 780;
const CSS_PIXELS_PER_INCH = 96;
const WORD_DIAGRAM_FALLBACK_DPI = 480;
const MAX_DIAGRAM_RASTER_SIDE = 6_144;
const MAX_DIAGRAM_RASTER_PIXELS = 20_000_000;
const TWIPS_PER_INCH = 1_440;
const MILLIMETERS_PER_INCH = 25.4;

function millimetersToTwip(millimeters: number) {
  return Math.round((millimeters / MILLIMETERS_PER_INCH) * TWIPS_PER_INCH);
}

const A4_PAGE_SIZE = {
  width: millimetersToTwip(210),
  height: millimetersToTwip(297),
} as const;
const PAGE_MARGIN = millimetersToTwip(18);

function countDirectionalLetters(value: string) {
  return {
    latin: value.match(/\p{Script=Latin}/gu)?.length ?? 0,
    arabic: value.match(/\p{Script=Arabic}/gu)?.length ?? 0,
  };
}

function documentDirection(markdown: string): TextDirection {
  const { latin, arabic } = countDirectionalLetters(markdown);
  return latin > 0 && arabic === 0 ? "ltr" : "rtl";
}

function nodeText(node: AstNode | undefined): string {
  if (!node) return "";
  if (typeof node.value === "string") return node.value;
  if (node.type === "image") return node.alt ?? "";
  return (node.children ?? []).map(nodeText).join("");
}

function blockDirection(value: string, fallback: TextDirection): TextDirection {
  if (fallback === "ltr") return "ltr";
  const { latin, arabic } = countDirectionalLetters(value);
  const total = latin + arabic;
  if (!total) return "rtl";
  return latin / total > 0.7 ? "ltr" : "rtl";
}

function alignmentFor(direction: TextDirection) {
  return direction === "rtl" ? AlignmentType.RIGHT : AlignmentType.LEFT;
}

function paragraphDirection(direction: TextDirection) {
  return {
    bidirectional: direction === "rtl",
    alignment: alignmentFor(direction),
  } as const;
}

function safeBaseName(fileName: string) {
  return (
    fileName
      .trim()
      .replace(/\.(?:md|markdown|ravi|docx|pdf)$/iu, "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "-")
      .replace(/[ .]+$/gu, "") || "نوشته-راوی"
  );
}

export function wordExportFileName(fileName: string) {
  return `${safeBaseName(fileName)}.docx`;
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function fittedDimensions(width = 1200, height = 675) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const scale = Math.min(
    1,
    MAX_IMAGE_WIDTH / safeWidth,
    MAX_IMAGE_HEIGHT / safeHeight,
  );
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("IMAGE_LOAD_FAILED")), {
      once: true,
    });
    image.src = source;
  });
}

async function imageToPngBytes(
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (nextBlob) =>
        nextBlob ? resolve(nextBlob) : reject(new Error("PNG_ENCODING_FAILED")),
      "image/png",
    ),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

async function imageToPng(source: string, name: string, description: string) {
  const image = await loadImage(source);
  const naturalWidth = image.naturalWidth || 1200;
  const naturalHeight = image.naturalHeight || 675;
  const renderScale = Math.min(2, 2200 / naturalWidth, 2200 / naturalHeight);
  return {
    type: "png" as const,
    data: await imageToPngBytes(
      image,
      naturalWidth * renderScale,
      naturalHeight * renderScale,
    ),
    ...fittedDimensions(naturalWidth, naturalHeight),
    name,
    description,
  };
}

function numericSvgLength(value: string | null) {
  if (!value) return undefined;
  const match = value.trim().match(/^([+-]?(?:\d+\.?\d*|\.\d+))/u);
  const parsed = match?.[1] ? Number(match[1]) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function prepareMermaidSvgForWord(svg: string) {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(svg, "image/svg+xml");
  if (documentNode.querySelector("parsererror")) {
    throw new Error("SVG_PARSE_FAILED");
  }
  const root = documentNode.documentElement;
  const viewBoxValues = (root.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/u)
    .map(Number);
  const hasViewBox =
    viewBoxValues.length === 4 &&
    viewBoxValues.every(Number.isFinite) &&
    viewBoxValues[2] > 0 &&
    viewBoxValues[3] > 0;
  const x = hasViewBox ? viewBoxValues[0] : 0;
  const y = hasViewBox ? viewBoxValues[1] : 0;
  const width = hasViewBox
    ? viewBoxValues[2]
    : numericSvgLength(root.getAttribute("width")) ?? 1200;
  const height = hasViewBox
    ? viewBoxValues[3]
    : numericSvgLength(root.getAttribute("height")) ?? 675;
  const safePadding = Math.max(16, Math.min(48, Math.min(width, height) * 0.05));
  const paddedWidth = width + safePadding * 2;
  const paddedHeight = height + safePadding * 2;

  root.setAttribute(
    "viewBox",
    [x - safePadding, y - safePadding, paddedWidth, paddedHeight]
      .map((value) => Number(value.toFixed(3)))
      .join(" "),
  );
  root.setAttribute("width", String(Number(paddedWidth.toFixed(3))));
  root.setAttribute("height", String(Number(paddedHeight.toFixed(3))));
  root.setAttribute("preserveAspectRatio", "xMidYMid meet");

  return {
    svg: new XMLSerializer().serializeToString(root),
    width: paddedWidth,
    height: paddedHeight,
  };
}

function wrappedSvgText(value: string, maximumLineLength = 34) {
  const words = value.trim().split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > maximumLineLength) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines.slice(0, 6);
}

function rasterSafeMermaidSvg(svg: string) {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(svg, "image/svg+xml");
  if (documentNode.querySelector("parsererror")) {
    throw new Error("SVG_PARSE_FAILED");
  }
  const namespace = "http://www.w3.org/2000/svg";
  for (const foreignObject of Array.from(
    documentNode.querySelectorAll("foreignObject"),
  )) {
    const label = (foreignObject.textContent ?? "").replace(/\s+/gu, " ").trim();
    const group = documentNode.createElementNS(namespace, "g");
    const transform = foreignObject.getAttribute("transform");
    if (transform) group.setAttribute("transform", transform);
    if (label) {
      const x = Number(foreignObject.getAttribute("x") ?? 0);
      const y = Number(foreignObject.getAttribute("y") ?? 0);
      const width = numericSvgLength(foreignObject.getAttribute("width")) ?? 0;
      const height = numericSvgLength(foreignObject.getAttribute("height")) ?? 20;
      const lines = wrappedSvgText(label);
      const text = documentNode.createElementNS(namespace, "text");
      const centerX = x + width / 2;
      const lineHeight = 16;
      const firstY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
      text.setAttribute("x", String(centerX));
      text.setAttribute("y", String(firstY));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "central");
      text.setAttribute("font-family", "IRANSansX, IRANSans, Vazirmatn, Tahoma, Arial, sans-serif");
      text.setAttribute("font-size", "14");
      text.setAttribute("fill", "#172033");
      text.setAttribute("style", "direction:rtl;unicode-bidi:plaintext");
      for (const [index, line] of lines.entries()) {
        const tspan = documentNode.createElementNS(namespace, "tspan");
        tspan.setAttribute("x", String(centerX));
        tspan.setAttribute("dy", index === 0 ? "0" : String(lineHeight));
        tspan.textContent = line;
        text.appendChild(tspan);
      }
      group.appendChild(text);
    }
    foreignObject.replaceWith(group);
  }
  return new XMLSerializer().serializeToString(documentNode.documentElement);
}

function adaptiveDiagramRasterDimensions(width: number, height: number) {
  const desiredScale = WORD_DIAGRAM_FALLBACK_DPI / CSS_PIXELS_PER_INCH;
  const desiredWidth = Math.max(1, width * desiredScale);
  const desiredHeight = Math.max(1, height * desiredScale);
  const limitScale = Math.min(
    1,
    MAX_DIAGRAM_RASTER_SIDE / desiredWidth,
    MAX_DIAGRAM_RASTER_SIDE / desiredHeight,
    Math.sqrt(MAX_DIAGRAM_RASTER_PIXELS / (desiredWidth * desiredHeight)),
  );
  return {
    width: Math.max(1, Math.round(desiredWidth * limitScale)),
    height: Math.max(1, Math.round(desiredHeight * limitScale)),
  };
}

async function svgToWordImage(svg: string, index: number) {
  const prepared = prepareMermaidSvgForWord(svg);
  const display = fittedDimensions(prepared.width, prepared.height);
  const raster = adaptiveDiagramRasterDimensions(display.width, display.height);
  const blob = new Blob([rasterSafeMermaidSvg(prepared.svg)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    return {
      type: "svg" as const,
      data: new TextEncoder().encode(prepared.svg),
      fallback: {
        type: "png" as const,
        data: await imageToPngBytes(image, raster.width, raster.height),
      },
      ...display,
      name: `نمودار-${index + 1}`,
      description: `نمودار Mermaid شماره ${index + 1}`,
    } satisfies SvgWordImage;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function raaviAssetToWordImage(asset: RaaviImageAsset) {
  const description = asset.name || "تصویر همراه سند";
  if (asset.mimeType === "image/webp") {
    return imageToPng(
      `data:${asset.mimeType};base64,${asset.data}`,
      asset.name,
      description,
    );
  }

  const type =
    asset.mimeType === "image/jpeg"
      ? "jpg"
      : asset.mimeType === "image/gif"
        ? "gif"
        : "png";
  return {
    type,
    data: decodeBase64(asset.data),
    ...fittedDimensions(asset.width, asset.height),
    name: asset.name,
    description,
  } satisfies WordImage;
}

function imageRun(image: WordImage) {
  const common = {
    transformation: { width: image.width, height: image.height },
    altText: {
      name: image.name || "تصویر سند",
      title: image.name || "تصویر سند",
      description: image.description,
    },
  } as const;
  if (image.type === "svg") {
    return new ImageRun({
      type: "svg",
      data: image.data,
      fallback: image.fallback,
      ...common,
    });
  }
  return new ImageRun({
    type: image.type,
    data: image.data,
    ...common,
  });
}

function runOptions(style: InlineStyle, direction: TextDirection) {
  return {
    bold: style.bold,
    boldComplexScript: style.bold,
    italics: style.italics,
    italicsComplexScript: style.italics,
    strike: style.strike,
    rightToLeft: style.code ? false : direction === "rtl",
    ...(style.code
      ? {
          font: "Cascadia Code",
          color: PROOF_BLUE,
          shading: { type: ShadingType.CLEAR, fill: CODE_BACKGROUND },
        }
      : {}),
  };
}

async function inlineChildren(
  nodes: AstNode[],
  direction: TextDirection,
  images: Map<string, WordImage>,
  warnings: WordExportWarning[],
  style: InlineStyle = {},
): Promise<ParagraphChild[]> {
  const output: ParagraphChild[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      output.push(
        new TextRun({ text: node.value ?? "", ...runOptions(style, direction) }),
      );
      continue;
    }
    if (node.type === "strong" || node.type === "emphasis" || node.type === "delete") {
      output.push(
        ...(await inlineChildren(
          node.children ?? [],
          direction,
          images,
          warnings,
          {
            ...style,
            bold: style.bold || node.type === "strong",
            italics: style.italics || node.type === "emphasis",
            strike: style.strike || node.type === "delete",
          },
        )),
      );
      continue;
    }
    if (node.type === "inlineCode") {
      output.push(
        new TextRun({
          text: node.value ?? "",
          ...runOptions({ ...style, code: true }, "ltr"),
        }),
      );
      continue;
    }
    if (node.type === "break") {
      output.push(new TextRun({ break: 1 }));
      continue;
    }
    if (node.type === "link") {
      const children = await inlineChildren(
        node.children ?? [],
        direction,
        images,
        warnings,
        style,
      );
      output.push(
        new ExternalHyperlink({
          link: node.url ?? "",
          children: children.length
            ? children
            : [new TextRun({ text: node.url ?? "", color: PROOF_BLUE })],
        }),
      );
      continue;
    }
    if (node.type === "image") {
      const assetId = raaviImageAssetId(node.url ?? "");
      const image = assetId ? images.get(assetId) : undefined;
      if (image) {
        output.push(imageRun(image));
      } else {
        const description = node.alt?.trim() || "تصویر";
        const address = node.url?.trim();
        output.push(
          new TextRun({
            text: address ? `[${description}: ${address}]` : `[${description}]`,
            color: MUTED_TEXT,
            italics: true,
            italicsComplexScript: true,
            rightToLeft: direction === "rtl",
          }),
        );
        warnings.push({
          kind: "image",
          message: `تصویر «${description}» در فایل Word جاسازی نشد.`,
        });
      }
      continue;
    }

    if (node.children?.length) {
      output.push(
        ...(await inlineChildren(node.children, direction, images, warnings, style)),
      );
    } else if (node.value) {
      output.push(new TextRun({ text: node.value, ...runOptions(style, direction) }));
    }
  }

  return output;
}

function headingLevel(depth = 1) {
  return (
    {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
      5: HeadingLevel.HEADING_5,
      6: HeadingLevel.HEADING_6,
    }[Math.min(6, Math.max(1, depth))] ?? HeadingLevel.HEADING_1
  );
}

type ConvertContext = {
  fallbackDirection: TextDirection;
  images: Map<string, WordImage>;
  diagrams: Map<number, WordImage>;
  warnings: WordExportWarning[];
};

async function convertList(
  node: AstNode,
  context: ConvertContext,
  depth = 0,
): Promise<FileChild[]> {
  const output: FileChild[] = [];
  for (const item of node.children ?? []) {
    const itemChildren = item.children ?? [];
    const firstParagraph = itemChildren.find((child) => child.type === "paragraph");
    const text = nodeText(firstParagraph ?? item);
    const direction = blockDirection(text, context.fallbackDirection);
    const taskPrefix =
      typeof item.checked === "boolean" ? (item.checked ? "☒ " : "☐ ") : "";
    const children = firstParagraph
      ? await inlineChildren(
          firstParagraph.children ?? [],
          direction,
          context.images,
          context.warnings,
        )
      : [new TextRun({ text, rightToLeft: direction === "rtl" })];
    if (taskPrefix) {
      children.unshift(
        new TextRun({
          text: taskPrefix,
          color: item.checked ? "299452" : MUTED_TEXT,
          rightToLeft: direction === "rtl",
        }),
      );
    }
    output.push(
      new Paragraph({
        children,
        ...paragraphDirection(direction),
        spacing: { after: 90, line: 380 },
        ...(node.ordered
          ? {
              numbering: {
                reference: `raavi-numbered-${direction}`,
                level: Math.min(depth, 8),
              },
            }
          : { bullet: { level: Math.min(depth, 8) } }),
      }),
    );

    for (const child of itemChildren) {
      if (child.type === "list") {
        output.push(...(await convertList(child, context, depth + 1)));
      } else if (child !== firstParagraph && child.type !== "paragraph") {
        output.push(...(await convertBlock(child, context)));
      }
    }
  }
  return output;
}

async function convertTable(node: AstNode, context: ConvertContext) {
  const rows = await Promise.all(
    (node.children ?? []).map(async (row, rowIndex) => {
      const cells = await Promise.all(
        (row.children ?? []).map(async (cell) => {
          const text = nodeText(cell);
          const direction = blockDirection(text, context.fallbackDirection);
          return new TableCell({
            children: [
              new Paragraph({
                children: await inlineChildren(
                  cell.children ?? [],
                  direction,
                  context.images,
                  context.warnings,
                ),
                ...paragraphDirection(direction),
                spacing: { before: 40, after: 40, line: 330 },
              }),
            ],
            shading:
              rowIndex === 0
                ? { type: ShadingType.CLEAR, fill: PROOF_BLUE_SOFT }
                : undefined,
            margins: { top: 90, bottom: 90, left: 110, right: 110 },
          });
        }),
      );
      return new TableRow({ children: cells, tableHeader: rowIndex === 0 });
    }),
  );
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.AUTOFIT,
    visuallyRightToLeft: context.fallbackDirection === "rtl",
    alignment: alignmentFor(context.fallbackDirection),
    borders: {
      top: { style: BorderStyle.SINGLE, color: RULE, size: 6 },
      bottom: { style: BorderStyle.SINGLE, color: RULE, size: 6 },
      left: { style: BorderStyle.SINGLE, color: RULE, size: 6 },
      right: { style: BorderStyle.SINGLE, color: RULE, size: 6 },
      insideHorizontal: { style: BorderStyle.SINGLE, color: RULE, size: 4 },
      insideVertical: { style: BorderStyle.SINGLE, color: RULE, size: 4 },
    },
  });
}

async function convertBlock(node: AstNode, context: ConvertContext): Promise<FileChild[]> {
  const text = nodeText(node);
  const direction = blockDirection(text, context.fallbackDirection);

  if (node.type === "paragraph") {
    return [
      new Paragraph({
        children: await inlineChildren(
          node.children ?? [],
          direction,
          context.images,
          context.warnings,
        ),
        ...paragraphDirection(direction),
        spacing: { after: 180, line: 430 },
        widowControl: true,
      }),
    ];
  }
  if (node.type === "heading") {
    return [
      new Paragraph({
        children: await inlineChildren(
          node.children ?? [],
          direction,
          context.images,
          context.warnings,
        ),
        heading: headingLevel(node.depth),
        ...paragraphDirection(direction),
        keepNext: true,
        widowControl: true,
      }),
    ];
  }
  if (node.type === "blockquote") {
    const output: FileChild[] = [];
    for (const child of node.children ?? []) {
      const converted = await convertBlock(child, context);
      for (const item of converted) {
        if (item instanceof Paragraph) {
          output.push(
            new Paragraph({
              children: await inlineChildren(
                child.children ?? [],
                direction,
                context.images,
                context.warnings,
              ),
              style: "RaaviQuote",
              ...paragraphDirection(direction),
            }),
          );
        } else output.push(item);
      }
    }
    return output;
  }
  if (node.type === "list") return convertList(node, context);
  if (node.type === "table") return [await convertTable(node, context)];
  if (node.type === "code") {
    if ((node.lang ?? "").toLocaleLowerCase("en-US") === "mermaid") {
      const startOffset = node.position?.start?.offset;
      const diagram =
        typeof startOffset === "number" ? context.diagrams.get(startOffset) : undefined;
      if (diagram) {
        return [
          new Paragraph({
            children: [imageRun(diagram)],
            alignment: AlignmentType.CENTER,
            spacing: { before: 160, after: 220 },
            keepLines: true,
          }),
        ];
      }
      context.warnings.push({
        kind: "diagram",
        message: "یک نمودار Mermaid به‌صورت کد در فایل Word قرار گرفت.",
      });
    }
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: node.value ?? "",
            font: "Cascadia Code",
            size: 19,
            color: PAPER_TEXT,
            rightToLeft: false,
          }),
        ],
        style: "RaaviCode",
        bidirectional: false,
        alignment: AlignmentType.LEFT,
        keepLines: true,
      }),
    ];
  }
  if (node.type === "thematicBreak") {
    return [
      new Paragraph({
        border: {
          bottom: { style: BorderStyle.SINGLE, color: PROOF_BLUE, size: 8 },
        },
        spacing: { before: 200, after: 260 },
      }),
    ];
  }
  if (node.type === "html") {
    context.warnings.push({
      kind: "unsupported",
      message: "HTML خام به‌صورت متن ساده به فایل Word منتقل شد.",
    });
    return [
      new Paragraph({
        children: [new TextRun({ text: node.value ?? "", color: MUTED_TEXT })],
        ...paragraphDirection(direction),
      }),
    ];
  }

  const output: FileChild[] = [];
  for (const child of node.children ?? []) {
    output.push(...(await convertBlock(child, context)));
  }
  return output;
}

function numberingLevels(direction: TextDirection) {
  return Array.from({ length: 9 }, (_, level) => ({
    level,
    format: LevelFormat.DECIMAL,
    text: `%${level + 1}.`,
    alignment: alignmentFor(direction),
    style: {
      run: { font: "IRANSansX", rightToLeft: direction === "rtl" },
      paragraph: {
        indent:
          direction === "rtl"
            ? { right: 560 + level * 260, hanging: 280 }
            : { left: 560 + level * 260, hanging: 280 },
      },
    },
  }));
}

async function prepareDiagrams(
  markdown: string,
  warnings: WordExportWarning[],
  onProgress?: WordExportOptions["onProgress"],
) {
  const blocks = findMermaidBlocks(markdown);
  const diagrams = new Map<number, WordImage>();
  onProgress?.("diagrams", 0, blocks.length);
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    try {
      const result = await scheduleMermaidRender(block.code, "light", {
        documentId: "word-export",
        blockId: block.id,
        priority: "interactive",
        force: true,
      });
      if (!result.ok) throw new Error(result.error.message);
      diagrams.set(block.startOffset, await svgToWordImage(result.svg, index));
    } catch {
      warnings.push({
        kind: "diagram",
        message: `نمودار شماره ${(index + 1).toLocaleString("fa-IR")} رندر نشد.`,
      });
    }
    onProgress?.("diagrams", index + 1, blocks.length);
  }
  return diagrams;
}

async function prepareImages(
  assets: RaaviImageAsset[],
  warnings: WordExportWarning[],
  onProgress?: WordExportOptions["onProgress"],
) {
  const images = new Map<string, WordImage>();
  onProgress?.("images", 0, assets.length);
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    try {
      images.set(asset.id, await raaviAssetToWordImage(asset));
    } catch {
      warnings.push({
        kind: "image",
        message: `تصویر «${asset.name || `شماره ${index + 1}`}» آماده نشد.`,
      });
    }
    onProgress?.("images", index + 1, assets.length);
  }
  return images;
}

export async function createWordExport({
  markdown,
  fileName,
  imageAssets,
  onProgress,
}: WordExportOptions): Promise<WordExportResult> {
  const warnings: WordExportWarning[] = [];
  onProgress?.("reading", 0, 1);
  const frontmatter = extractWordFrontmatter(markdown);
  const documentMarkdown = frontmatter.markdown;
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(documentMarkdown) as unknown as AstNode;
  onProgress?.("reading", 1, 1);

  const [diagrams, images] = await Promise.all([
    prepareDiagrams(documentMarkdown, warnings, onProgress),
    prepareImages(imageAssets, warnings, onProgress),
  ]);
  const fallbackDirection = documentDirection(documentMarkdown);
  const context: ConvertContext = {
    fallbackDirection,
    diagrams,
    images,
    warnings,
  };
  const children: FileChild[] = [];
  for (const child of tree.children ?? []) {
    children.push(...(await convertBlock(child, context)));
  }

  onProgress?.("document", 0, 1);
  const document = new Document({
    title: frontmatter.properties.title ?? safeBaseName(fileName),
    subject: frontmatter.properties.subject,
    creator: frontmatter.properties.creator ?? "راوی",
    keywords: frontmatter.properties.keywords,
    description:
      frontmatter.properties.description ??
      "خروجی قابل‌ویرایش Markdown از راوی",
    lastModifiedBy: "راوی",
    customProperties: frontmatter.properties.customProperties,
    styles: {
      default: {
        document: {
          run: {
            font: "IRANSansX",
            size: 24,
            sizeComplexScript: 24,
            color: PAPER_TEXT,
          },
          paragraph: { spacing: { line: 430, after: 160 } },
        },
        heading1: {
          run: {
            font: "IRANSansX",
            size: 38,
            sizeComplexScript: 38,
            bold: true,
            boldComplexScript: true,
            color: PAPER_TEXT,
          },
          paragraph: { spacing: { before: 300, after: 220 } },
        },
        heading2: {
          run: {
            font: "IRANSansX",
            size: 32,
            sizeComplexScript: 32,
            bold: true,
            boldComplexScript: true,
            color: PAPER_TEXT,
          },
          paragraph: { spacing: { before: 300, after: 170 } },
        },
        heading3: {
          run: {
            font: "IRANSansX",
            size: 28,
            sizeComplexScript: 28,
            bold: true,
            boldComplexScript: true,
            color: PAPER_TEXT,
          },
          paragraph: { spacing: { before: 250, after: 140 } },
        },
        hyperlink: {
          run: { color: PROOF_BLUE, underline: { color: PROOF_BLUE } },
        },
      },
      paragraphStyles: [
        {
          id: "RaaviQuote",
          name: "Raavi Quote",
          run: { color: MUTED_TEXT, italics: true, italicsComplexScript: true },
          paragraph: {
            spacing: { before: 100, after: 180, line: 390 },
            shading: { type: ShadingType.CLEAR, fill: PROOF_BLUE_SOFT },
            border: {
              right: { style: BorderStyle.SINGLE, color: PROOF_BLUE, size: 12 },
            },
            indent: { left: 240, right: 240 },
          },
        },
        {
          id: "RaaviCode",
          name: "Raavi Code",
          run: { font: "Cascadia Code", size: 19, color: PAPER_TEXT },
          paragraph: {
            spacing: { before: 120, after: 220, line: 330 },
            shading: { type: ShadingType.CLEAR, fill: CODE_BACKGROUND },
            border: {
              top: { style: BorderStyle.SINGLE, color: RULE, size: 4 },
              bottom: { style: BorderStyle.SINGLE, color: RULE, size: 4 },
              left: { style: BorderStyle.SINGLE, color: RULE, size: 4 },
              right: { style: BorderStyle.SINGLE, color: RULE, size: 4 },
            },
            indent: { left: 220, right: 220 },
          },
        },
      ],
    },
    numbering: {
      config: [
        { reference: "raavi-numbered-rtl", levels: numberingLevels("rtl") },
        { reference: "raavi-numbered-ltr", levels: numberingLevels("ltr") },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: A4_PAGE_SIZE,
            margin: {
              top: PAGE_MARGIN,
              bottom: PAGE_MARGIN,
              left: PAGE_MARGIN,
              right: PAGE_MARGIN,
            },
          },
        },
        children,
      },
    ],
  });
  const bytes = await Packer.toArrayBuffer(document);
  onProgress?.("document", 1, 1);
  return {
    bytes,
    warnings,
    stats: { diagrams: diagrams.size, embeddedImages: images.size },
  };
}
