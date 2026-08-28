import {
  normalizeCommandQuery,
  scoreCommandText,
} from "../commands/command-palette";
import type { EditorBlockType } from "./block-types";

export type SlashMenuBlockType = Exclude<EditorBlockType, "code-block">;

export type SlashMenuItem = {
  type: SlashMenuBlockType;
  alias: `/${string}`;
  title: string;
  description: string;
  keywords: string[];
  group: "text" | "list" | "media";
};

/** The single source of truth for blocks that may be created from `/`. */
export const SLASH_MENU_ITEMS: readonly SlashMenuItem[] = [
  {
    type: "heading-1",
    alias: "/h1",
    title: "تیتر ۱",
    description: "تیتر اصلی سند",
    keywords: ["h1", "heading 1", "title", "تیتر یک", "عنوان اصلی"],
    group: "text",
  },
  {
    type: "heading-2",
    alias: "/h2",
    title: "تیتر ۲",
    description: "تیتر بخش",
    keywords: ["h2", "heading 2", "subtitle", "تیتر دو", "عنوان بخش"],
    group: "text",
  },
  {
    type: "heading-3",
    alias: "/h3",
    title: "تیتر ۳",
    description: "تیتر زیربخش",
    keywords: ["h3", "heading 3", "تیتر سه", "عنوان زیربخش"],
    group: "text",
  },
  {
    type: "paragraph",
    alias: "/text",
    title: "متن معمولی",
    description: "یک بند متن ساده",
    keywords: ["text", "paragraph", "plain", "متن", "بند", "پاراگراف"],
    group: "text",
  },
  {
    type: "divider",
    alias: "/divider",
    title: "جداکننده",
    description: "خط افقی میان بخش‌های سند",
    keywords: [
      "divider",
      "separator",
      "horizontal rule",
      "hr",
      "جداکننده",
      "خط افقی",
      "تفکیک",
    ],
    group: "text",
  },
  {
    type: "task",
    alias: "/todo",
    title: "چک‌لیست",
    description: "فهرست کارهای قابل انجام",
    keywords: ["todo", "task", "checklist", "کار", "وظیفه", "چک لیست"],
    group: "list",
  },
  {
    type: "bullet-list",
    alias: "/bullet",
    title: "فهرست بولت",
    description: "فهرست بدون ترتیب",
    keywords: ["bullet", "unordered list", "list", "بولت", "فهرست", "لیست"],
    group: "list",
  },
  {
    type: "ordered-list",
    alias: "/number",
    title: "فهرست مراحل",
    description: "فهرست شماره‌دار",
    keywords: ["number", "ordered list", "steps", "شماره", "مراحل", "ترتیبی"],
    group: "list",
  },
  {
    type: "quote",
    alias: "/quote",
    title: "نقل‌قول",
    description: "متن نقل‌شده یا برجسته",
    keywords: ["quote", "blockquote", "نقل قول", "گفتاورد"],
    group: "media",
  },
  {
    type: "table",
    alias: "/table",
    title: "جدول",
    description: "داده‌های ردیفی و ستونی",
    keywords: ["table", "tbl", "grid", "جدول", "ستون", "ردیف"],
    group: "media",
  },
  {
    type: "mermaid",
    alias: "/mermaid",
    title: "Mermaid",
    description: "نمودار در استودیوی گراف",
    keywords: ["mermaid", "diagram", "graph", "نمودار", "گراف"],
    group: "media",
  },
  {
    type: "image",
    alias: "/image",
    title: "تصویر",
    description: "تصویر محلی یا اینترنتی",
    keywords: ["image", "picture", "photo", "تصویر", "عکس"],
    group: "media",
  },
  {
    type: "audio",
    alias: "/audio",
    title: "صوت",
    description: "فایل صوتی محلی و قابل‌حمل",
    keywords: ["audio", "voice", "sound", "صوت", "صدا", "فایل صوتی"],
    group: "media",
  },
  {
    type: "formula",
    alias: "/formula",
    title: "فرمول",
    description: "فرمول ریاضی چندخطی",
    keywords: ["formula", "math", "latex", "equation", "فرمول", "ریاضی", "معادله"],
    group: "media",
  },
] as const;

export function slashMenuQueryFromLine(line: string) {
  const match = /^\/([\p{L}\p{N}_-]*)$/u.exec(line);
  return match ? match[1] : null;
}

export function rankSlashMenuItems(query: string) {
  const normalized = normalizeCommandQuery(query);
  return SLASH_MENU_ITEMS.map((item, registryIndex) => ({
    item,
    registryIndex,
    score: scoreCommandText(
      {
        title: item.title,
        description: item.description,
        keywords: [item.alias.slice(1), ...item.keywords],
      },
      normalized,
    ),
  }))
    .filter(({ score }) => !normalized || score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.registryIndex - right.registryIndex,
    )
    .map(({ item }) => item);
}
