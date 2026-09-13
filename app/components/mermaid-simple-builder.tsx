"use client";

import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Plus,
  Redo2,
  Settings2,
  Trash2,
  Undo2,
} from "@/app/icons/material-symbols";
import { useState } from "react";
import { MermaidDiagramCatalog, MermaidDiagramPreview } from "./mermaid-diagram-catalog";
import {
  createSimpleDiagramDraft,
  createSimpleDiagramRow,
  diagramAxisGuidance,
  SimpleDiagramDraft,
  SimpleDiagramIssue,
  SimpleDiagramKind,
  SimpleDiagramRow,
  SIMPLE_DIAGRAM_OPTIONS,
  simpleDiagramFields,
  supportsDiagramOrientation,
  validateSimpleDiagramDraft,
} from "../mermaid/simple-builder";

type ControlOption = { value: string; label: string };

type ControlSpec = {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "checkbox";
  options?: ControlOption[];
  placeholder?: string;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
};

const C4_LEVEL_OPTIONS: ControlOption[] = [
  { value: "context", label: "زمینهٔ سامانه" },
  { value: "container", label: "کانتینر" },
  { value: "component", label: "کامپوننت" },
  { value: "dynamic", label: "تعامل پویا" },
  { value: "deployment", label: "استقرار" },
];

const C4_SOURCE_TYPES: ControlOption[] = [
  { value: "Person", label: "شخص" },
  { value: "Person_Ext", label: "شخص خارجی" },
  { value: "System", label: "سامانه" },
  { value: "System_Ext", label: "سامانهٔ خارجی" },
  { value: "Container", label: "کانتینر" },
  { value: "Container_Ext", label: "کانتینر خارجی" },
  { value: "Component", label: "کامپوننت" },
  { value: "Component_Ext", label: "کامپوننت خارجی" },
  { value: "Deployment_Node", label: "گرهٔ استقرار" },
];

const C4_TARGET_TYPES: ControlOption[] = [
  ...C4_SOURCE_TYPES,
  { value: "SystemDb", label: "پایگاه‌دادهٔ سامانه" },
  { value: "SystemQueue", label: "صف سامانه" },
  { value: "ContainerDb", label: "پایگاه‌دادهٔ کانتینر" },
  { value: "ContainerQueue", label: "صف کانتینر" },
  { value: "ComponentDb", label: "پایگاه‌دادهٔ کامپوننت" },
  { value: "ComponentQueue", label: "صف کامپوننت" },
];

const ADVANCED_ONLY: Partial<Record<SimpleDiagramKind, string>> = {
  flowchart: "اتصال چندمرحله‌ای، classDef، کلیک و پیوندهای اجرایی در کد پیشرفته باقی می‌مانند.",
  sequence: "بلوک‌های چندردیفی با else/and و تنظیمات actor menu در کد پیشرفته کامل‌ترند.",
  class: "generic پیچیده، annotation آزاد و سبک‌دهی CSS کلاس‌ها در کد پیشرفته باقی می‌مانند.",
  state: "بلوک‌های تو‌در‌توی چندسطحی و concurrency پیچیده در کد پیشرفته کامل‌ترند.",
  er: "چند ویژگی برای یک موجودیت را می‌توانید با چند ردیف همان موجودیت بسازید؛ نوع‌های سفارشی پیچیده در حالت پیشرفته‌اند.",
  requirement: "ویژگی‌های سفارشی SysML و چند رابطه برای یک نیازمندی در کد پیشرفته کامل‌ترند.",
  architecture: "لبه‌های چندبخشی و icon pack سفارشی پس از ثبت بستهٔ آیکون در حالت پیشرفته در دسترس‌اند.",
  c4: "سبک‌دهی آزاد C4، sprite، tag، link و legend هنوز محدود یا آزمایشی‌اند.",
  gantt: "پیوند اجرایی task و CSS سفارشی فقط در حالت پیشرفته و با سیاست امنیتی راوی در دسترس‌اند.",
  timeline: "آیکون‌های آزمایشی فقط پس از ثبت icon pack در میزبان قابل استفاده‌اند.",
  kanban: "کلیدهای metadata خارج از مسئول، تیکت و اولویت فقط در حالت پیشرفته بررسی می‌شوند.",
  gitgraph: "رنگ‌های themeVariables هر شاخه و تنظیمات بسیار جزئی در کد پیشرفته باقی می‌مانند.",
  pie: "رنگ‌گذاری دقیق themeVariables هر برش در کد پیشرفته باقی می‌ماند.",
  xychart: "تنظیمات ریز فونت، tick، padding و palette پیچیده در کد پیشرفته باقی می‌مانند.",
  sankey: "prefix، suffix و رنگ‌های CSS غیرساده در کد پیشرفته باقی می‌مانند.",
  mindmap: "classDef و Markdown پیچیدهٔ هر گره در کد پیشرفته باقی می‌مانند.",
  journey: "رنگ‌های جزئی actor و section از themeVariables در حالت پیشرفته قابل تنظیم‌اند.",
  quadrant: "تنظیمات ریز فونت، padding و رنگ متن هر ربع در حالت پیشرفته باقی می‌مانند.",
};

const ESSENTIAL_ROW_CONTROL_KINDS = new Set<SimpleDiagramKind>([
  "requirement",
  "swimlane",
  "block",
  "eventmodeling",
  "venn",
  "wardley",
  "cynefin",
  "treeview",
]);

function nextRowId() {
  return globalThis.crypto?.randomUUID?.() ?? `row-${Date.now()}`;
}

function cloneDraft(draft: SimpleDiagramDraft) {
  return {
    ...draft,
    settings: { ...draft.settings },
    rows: draft.rows.map((row) => ({ ...row, meta: { ...row.meta } })),
  };
}

function settingControls(kind: SimpleDiagramKind): ControlSpec[] {
  if (kind === "c4") return [
    { key: "c4Level", label: "سطح C4", type: "select", options: C4_LEVEL_OPTIONS },
    { key: "shapesPerRow", label: "تعداد عنصر در هر ردیف", type: "number", min: 1, max: 8 },
    { key: "boundariesPerRow", label: "تعداد مرز در هر ردیف", type: "number", min: 1, max: 4 },
  ];
  if (kind === "gantt") return [
    { key: "dateFormat", label: "قالب تاریخ ورودی", placeholder: "YYYY-MM-DD" },
    { key: "axisFormat", label: "قالب تاریخ محور", placeholder: "%Y-%m-%d" },
    { key: "tickInterval", label: "فاصلهٔ محور", type: "select", options: [
      { value: "1day", label: "روزانه" }, { value: "1week", label: "هفتگی" }, { value: "1month", label: "ماهانه" },
    ] },
    { key: "excludes", label: "روزهای حذف‌شده", placeholder: "weekends یا 2026-08-15" },
    { key: "todayMarker", label: "نمایش نشانگر امروز", type: "checkbox" },
  ];
  if (kind === "timeline") return [
    { key: "disableMulticolor", label: "همهٔ دوره‌ها یک‌رنگ باشند", type: "checkbox" },
  ];
  if (kind === "kanban") return [
    { key: "ticketBaseUrl", label: "نشانی پایهٔ تیکت", placeholder: "https://example.com/tickets/#TICKET#", help: "عبارت #TICKET# با شمارهٔ کارت جایگزین می‌شود." },
  ];
  if (kind === "gitgraph") return [
    { key: "mainBranchName", label: "نام شاخهٔ اصلی", placeholder: "main" },
    { key: "showBranches", label: "نمایش نام شاخه‌ها", type: "checkbox" },
    { key: "showCommitLabel", label: "نمایش برچسب ثبت‌ها", type: "checkbox" },
    { key: "rotateCommitLabel", label: "چرخاندن برچسب ثبت‌ها", type: "checkbox" },
    { key: "parallelCommits", label: "تراز ثبت‌های موازی", type: "checkbox" },
  ];
  if (kind === "pie") return [
    { key: "showData", label: "نمایش مقدارها", type: "checkbox" },
    { key: "donutHole", label: "اندازهٔ حفرهٔ دونات", type: "number", min: 0, max: 0.9, step: 0.1 },
    { key: "legendPosition", label: "جای راهنما", type: "select", options: [
      { value: "top", label: "بالا" }, { value: "bottom", label: "پایین" }, { value: "left", label: "چپ" }, { value: "right", label: "راست" }, { value: "center", label: "مرکز" },
    ] },
    { key: "highlightSlice", label: "بخش برجسته", placeholder: "hover یا عنوان یک بخش" },
    { key: "textPosition", label: "جای برچسب روی شعاع", type: "number", min: 0, max: 1, step: 0.05 },
  ];
  if (kind === "xychart") return [
    { key: "xAxisType", label: "نوع محور افقی", type: "select", options: [
      { value: "category", label: "دسته‌ای" }, { value: "numeric", label: "عددی" },
    ] },
    { key: "xAxisTitle", label: "عنوان محور افقی" },
    { key: "yAxisTitle", label: "عنوان محور عمودی" },
    { key: "xMin", label: "کمینهٔ X", type: "number" },
    { key: "xMax", label: "بیشینهٔ X", type: "number" },
    { key: "yMin", label: "کمینهٔ Y", type: "number" },
    { key: "yMax", label: "بیشینهٔ Y", type: "number" },
    { key: "showDataLabel", label: "نمایش مقدار روی میله", type: "checkbox" },
    { key: "showDataLabelOutsideBar", label: "مقدار بیرون میله باشد", type: "checkbox" },
  ];
  if (kind === "sankey") return [
    { key: "width", label: "عرض نمودار", type: "number", min: 200, max: 2400 },
    { key: "height", label: "ارتفاع نمودار", type: "number", min: 160, max: 1800 },
    { key: "linkColor", label: "رنگ جریان", type: "select", options: [
      { value: "gradient", label: "گرادیان مبدأ تا مقصد" }, { value: "source", label: "رنگ مبدأ" }, { value: "target", label: "رنگ مقصد" },
    ] },
    { key: "nodeAlignment", label: "تراز گره‌ها", type: "select", options: [
      { value: "justify", label: "پرکردن عرض" }, { value: "center", label: "مرکز" }, { value: "left", label: "چپ" }, { value: "right", label: "راست" },
    ] },
    { key: "showValues", label: "نمایش مقدار جریان", type: "checkbox" },
    { key: "labelStyle", label: "سبک برچسب", type: "select", options: [
      { value: "outlined", label: "خوانا با کادر" }, { value: "legacy", label: "ساده" },
    ] },
    { key: "nodeWidth", label: "عرض گره", type: "number", min: 1, max: 80 },
    { key: "nodePadding", label: "فاصلهٔ عمودی گره‌ها", type: "number", min: 0, max: 100 },
  ];
  if (kind === "quadrant") return [
    { key: "xLeft", label: "ابتدای محور افقی" }, { key: "xRight", label: "انتهای محور افقی" },
    { key: "yBottom", label: "ابتدای محور عمودی" }, { key: "yTop", label: "انتهای محور عمودی" },
    { key: "quadrant1", label: "ربع بالا-راست" }, { key: "quadrant2", label: "ربع بالا-چپ" },
    { key: "quadrant3", label: "ربع پایین-چپ" }, { key: "quadrant4", label: "ربع پایین-راست" },
    { key: "chartWidth", label: "عرض نمودار", type: "number", min: 240, max: 1600 },
    { key: "chartHeight", label: "ارتفاع نمودار", type: "number", min: 240, max: 1600 },
  ];
  if (kind === "block") return [
    { key: "columns", label: "تعداد ستون‌های چیدمان", type: "number", min: 1, max: 12, help: "با کم‌وزیادکردن ستون‌ها، شکست ردیف‌ها و عرض نمودار را کنترل کنید." },
  ];
  if (kind === "packet") return [
    { key: "bitsPerRow", label: "تعداد بیت در هر ردیف", type: "number", min: 1, max: 256, help: "این مقدار محل شکستن بسته به ردیف بعد و در نتیجه عرض و طول نمودار را تعیین می‌کند." },
  ];
  if (kind === "radar") return [
    { key: "min", label: "کمینهٔ مقیاس", type: "number" },
    { key: "max", label: "بیشینهٔ مقیاس", type: "number" },
    { key: "ticks", label: "تعداد حلقه‌های راهنما", type: "number", min: 1, max: 12 },
    { key: "graticule", label: "شکل شبکه", type: "select", options: [{ value: "polygon", label: "چندضلعی" }, { value: "circle", label: "دایره‌ای" }] },
    { key: "showLegend", label: "نمایش راهنمای سری‌ها", type: "checkbox" },
  ];
  if (kind === "treemap") return [
    { key: "showValues", label: "نمایش مقدار روی هر بخش", type: "checkbox" },
  ];
  if (kind === "wardley") return [
    { key: "width", label: "عرض نقشه", type: "number", min: 500, max: 2400 },
    { key: "height", label: "ارتفاع نقشه", type: "number", min: 400, max: 1800 },
  ];
  if (kind === "cynefin") return [
    { key: "showDomainDescriptions", label: "نمایش توضیح دامنه‌ها", type: "checkbox" },
  ];
  if (kind === "treeview") return [
    { key: "showIcons", label: "نمایش آیکون فایل و پوشه", type: "checkbox" },
  ];
  return [];
}

function rowControls(kind: SimpleDiagramKind, draft: SimpleDiagramDraft, row: SimpleDiagramRow): ControlSpec[] {
  if (kind === "flowchart") {
    const shapes: ControlOption[] = [
      { value: "rect", label: "مستطیل" }, { value: "rounded", label: "گوشه‌گرد" },
      { value: "stadium", label: "کپسولی" }, { value: "circle", label: "دایره" },
      { value: "diamond", label: "تصمیم" }, { value: "cylinder", label: "پایگاه داده" },
      { value: "hexagon", label: "شش‌ضلعی" },
    ];
    return [
      { key: "sourceShape", label: "شکل مرحلهٔ مبدأ", type: "select", options: shapes },
      { key: "targetShape", label: "شکل مرحلهٔ مقصد", type: "select", options: shapes },
      { key: "linkType", label: "نوع اتصال", type: "select", options: [
        { value: "arrow", label: "پیکان" }, { value: "line", label: "خط ساده" },
        { value: "dotted", label: "خط‌چین" }, { value: "thick", label: "پررنگ" },
        { value: "bidirectional", label: "دوطرفه" },
      ] },
      { key: "sourceGroup", label: "گروه مرحلهٔ مبدأ", placeholder: "مانند ورود کاربر" },
      { key: "targetGroup", label: "گروه مرحلهٔ مقصد", placeholder: "مانند پردازش داخلی" },
    ];
  }
  if (kind === "sequence") {
    const participantTypes: ControlOption[] = [
      { value: "participant", label: "شرکت‌کننده" }, { value: "actor", label: "بازیگر" },
      { value: "boundary", label: "مرز سامانه" }, { value: "control", label: "کنترل‌گر" },
      { value: "entity", label: "موجودیت" }, { value: "database", label: "پایگاه داده" },
      { value: "collections", label: "مجموعه" }, { value: "queue", label: "صف" },
    ];
    return [
      { key: "sourceType", label: "نقش فرستنده", type: "select", options: participantTypes },
      { key: "targetType", label: "نقش گیرنده", type: "select", options: participantTypes },
      { key: "messageType", label: "نوع پیام", type: "select", options: [
        { value: "sync", label: "درخواست" }, { value: "return", label: "پاسخ" },
        { value: "async", label: "ناهمگام" }, { value: "lost", label: "ناموفق یا ازدست‌رفته" },
        { value: "solid", label: "خط پیوسته" },
      ] },
      { key: "sourceGroup", label: "گروه فرستنده", placeholder: "مانند کاربرها" },
      { key: "targetGroup", label: "گروه گیرنده", placeholder: "مانند سرویس‌ها" },
      { key: "activate", label: "فعال‌شدن گیرنده پس از پیام", type: "checkbox" },
      { key: "deactivate", label: "پایان فعالیت گیرنده پس از پیام", type: "checkbox" },
      { key: "blockType", label: "بلوک کنترلی این پیام", type: "select", options: [
        { value: "none", label: "بدون بلوک" }, { value: "loop", label: "تکرار" },
        { value: "opt", label: "اختیاری" }, { value: "alt", label: "شرطی" },
        { value: "par", label: "موازی" }, { value: "critical", label: "بحرانی" },
        { value: "break", label: "توقف" },
      ] },
      { key: "blockLabel", label: "عنوان بلوک", placeholder: "مانند تا زمان موفقیت" },
      { key: "note", label: "یادداشت کنار گیرنده" },
    ];
  }
  if (kind === "class") return [
    { key: "relationType", label: "نوع رابطه", type: "select", options: [
      { value: "association", label: "ارتباط جهت‌دار" }, { value: "inheritance", label: "وراثت" },
      { value: "composition", label: "ترکیب" }, { value: "aggregation", label: "تجمیع" },
      { value: "dependency", label: "وابستگی" }, { value: "realization", label: "پیاده‌سازی" },
      { value: "solid", label: "ارتباط ساده" }, { value: "dashed", label: "ارتباط خط‌چین" },
    ] },
    { key: "sourceCardinality", label: "تعداد در سمت کلاس اول", placeholder: "مانند 1 یا 0..*" },
    { key: "targetCardinality", label: "تعداد در سمت کلاس دوم", placeholder: "مانند 1..*" },
    { key: "sourceMembers", label: "ویژگی‌ها و عملیات کلاس اول", placeholder: "+name: string؛ +open()", help: "موارد را با نقطه‌ویرگول جدا کنید." },
    { key: "targetMembers", label: "ویژگی‌ها و عملیات کلاس دوم", placeholder: "+id: number؛ +save()", help: "موارد را با نقطه‌ویرگول جدا کنید." },
    { key: "sourceStereotype", label: "نوع ویژهٔ کلاس اول", type: "select", options: [
      { value: "", label: "بدون نوع ویژه" }, { value: "interface", label: "رابط" }, { value: "abstract", label: "انتزاعی" }, { value: "service", label: "سرویس" }, { value: "enumeration", label: "شمارشی" },
    ] },
    { key: "targetStereotype", label: "نوع ویژهٔ کلاس دوم", type: "select", options: [
      { value: "", label: "بدون نوع ویژه" }, { value: "interface", label: "رابط" }, { value: "abstract", label: "انتزاعی" }, { value: "service", label: "سرویس" }, { value: "enumeration", label: "شمارشی" },
    ] },
    { key: "sourceNamespace", label: "فضای نام کلاس اول", placeholder: "مانند دامنه" },
    { key: "targetNamespace", label: "فضای نام کلاس دوم", placeholder: "مانند زیرساخت" },
  ];
  if (kind === "state") {
    const stateKinds: ControlOption[] = [
      { value: "normal", label: "حالت عادی" }, { value: "start", label: "شروع" },
      { value: "end", label: "پایان" }, { value: "choice", label: "تصمیم" },
      { value: "fork", label: "انشعاب موازی" }, { value: "join", label: "اتصال موازی" },
    ];
    return [
      { key: "sourceKind", label: "نوع حالت مبدأ", type: "select", options: stateKinds },
      { key: "targetKind", label: "نوع حالت مقصد", type: "select", options: stateKinds },
      { key: "sourceParent", label: "حالت مادر مبدأ", placeholder: "برای حالت تو‌در‌تو" },
      { key: "targetParent", label: "حالت مادر مقصد", placeholder: "برای حالت تو‌در‌تو" },
      { key: "note", label: "یادداشت کنار حالت مقصد" },
    ];
  }
  if (kind === "er") {
    const cardinalities: ControlOption[] = [
      { value: "one", label: "دقیقاً یک" }, { value: "zero-one", label: "صفر یا یک" },
      { value: "one-many", label: "یک یا بیشتر" }, { value: "zero-many", label: "صفر یا بیشتر" },
    ];
    const keys: ControlOption[] = [
      { value: "", label: "کلید نیست" }, { value: "PK", label: "کلید اصلی" },
      { value: "FK", label: "کلید خارجی" }, { value: "UK", label: "کلید یکتا" },
    ];
    return [
      { key: "sourceCardinality", label: "تعداد موجودیت اول", type: "select", options: cardinalities },
      { key: "targetCardinality", label: "تعداد موجودیت دوم", type: "select", options: cardinalities },
      { key: "identifying", label: "رابطه هویت‌بخش است", type: "checkbox" },
      { key: "sourceAttribute", label: "یک ویژگی از موجودیت اول", placeholder: "مانند شناسه" },
      { key: "sourceAttributeType", label: "نوع ویژگی اول", placeholder: "string" },
      { key: "sourceAttributeKey", label: "کلید ویژگی اول", type: "select", options: keys },
      { key: "targetAttribute", label: "یک ویژگی از موجودیت دوم", placeholder: "مانند تاریخ" },
      { key: "targetAttributeType", label: "نوع ویژگی دوم", placeholder: "date" },
      { key: "targetAttributeKey", label: "کلید ویژگی دوم", type: "select", options: keys },
    ];
  }
  if (kind === "requirement") return [
    { key: "requirementType", label: "نوع نیازمندی", type: "select", options: [
      { value: "requirement", label: "عمومی" }, { value: "functionalRequirement", label: "کارکردی" },
      { value: "interfaceRequirement", label: "رابط" }, { value: "performanceRequirement", label: "کارایی" },
      { value: "physicalRequirement", label: "فیزیکی" }, { value: "designConstraint", label: "قید طراحی" },
    ] },
    { key: "risk", label: "ریسک", type: "select", options: [
      { value: "low", label: "کم" }, { value: "medium", label: "متوسط" }, { value: "high", label: "زیاد" },
    ] },
    { key: "verificationMethod", label: "روش اعتبارسنجی", type: "select", options: [
      { value: "test", label: "آزمون" }, { value: "analysis", label: "تحلیل" },
      { value: "inspection", label: "بازرسی" }, { value: "demonstration", label: "نمایش عملی" },
    ] },
    { key: "relationship", label: "رابطهٔ جزء با نیازمندی", type: "select", options: [
      { value: "satisfies", label: "برآورده می‌کند" }, { value: "verifies", label: "اعتبارسنجی می‌کند" },
      { value: "refines", label: "دقیق‌تر می‌کند" }, { value: "traces", label: "ردیابی می‌کند" },
      { value: "contains", label: "شامل می‌شود" }, { value: "copies", label: "کپی می‌کند" },
      { value: "derives", label: "مشتق می‌شود" },
    ] },
    { key: "elementType", label: "نوع جزء مرتبط", placeholder: "component" },
    { key: "docref", label: "ارجاع سند", placeholder: "docs/spec.md" },
  ];
  if (kind === "architecture") {
    const nodeTypes: ControlOption[] = [{ value: "service", label: "سرویس" }, { value: "junction", label: "نقطهٔ اتصال" }];
    const icons: ControlOption[] = [
      { value: "server", label: "سرور" }, { value: "database", label: "پایگاه داده" },
      { value: "cloud", label: "ابر" }, { value: "disk", label: "دیسک" }, { value: "internet", label: "اینترنت" },
    ];
    const ports: ControlOption[] = [
      { value: "R", label: "راست" }, { value: "L", label: "چپ" }, { value: "T", label: "بالا" }, { value: "B", label: "پایین" },
    ];
    return [
      { key: "sourceType", label: "نوع مبدأ", type: "select", options: nodeTypes },
      { key: "targetType", label: "نوع مقصد", type: "select", options: nodeTypes },
      { key: "sourceIcon", label: "آیکون مبدأ", type: "select", options: icons },
      { key: "targetIcon", label: "آیکون مقصد", type: "select", options: icons },
      { key: "sourceGroup", label: "گروه مبدأ", placeholder: "مانند سکوی اصلی" },
      { key: "targetGroup", label: "گروه مقصد", placeholder: "مانند لایهٔ داده" },
      { key: "groupParent", label: "گروه مادر", placeholder: "برای گروه تو‌در‌تو" },
      { key: "sourcePort", label: "سمت خروج اتصال", type: "select", options: ports },
      { key: "targetPort", label: "سمت ورود اتصال", type: "select", options: ports },
      { key: "arrow", label: "جهت پیکان", type: "select", options: [
        { value: "forward", label: "از مبدأ به مقصد" }, { value: "backward", label: "از مقصد به مبدأ" },
        { value: "both", label: "دوطرفه" }, { value: "none", label: "بدون پیکان" },
      ] },
      { key: "align", label: "هم‌ترازی اجباری", type: "select", options: [
        { value: "none", label: "خودکار" }, { value: "row", label: "در یک ردیف" }, { value: "column", label: "در یک ستون" },
      ] },
    ];
  }
  if (kind === "c4") return [
    { key: "sourceType", label: "نوع مبدأ", type: "select", options: C4_SOURCE_TYPES },
    { key: "targetType", label: "نوع مقصد", type: "select", options: C4_TARGET_TYPES },
    { key: "sourceDescription", label: "توضیح مبدأ" },
    { key: "technology", label: "فناوری مقصد" },
    { key: "description", label: "توضیح مقصد" },
    { key: "boundary", label: "مرز مقصد", placeholder: "مانند سامانهٔ پرداخت" },
    { key: "boundaryParent", label: "والد مرز مقصد", placeholder: "برای مرز تو‌در‌تو" },
  ];
  if (kind === "gantt") return [
    { key: "section", label: "بخش", placeholder: "برنامه" },
    { key: "status", label: "وضعیت", type: "select", options: [
      { value: "none", label: "عادی" }, { value: "active", label: "در حال انجام" }, { value: "done", label: "انجام‌شده" }, { value: "crit", label: "بحرانی" },
    ] },
    { key: "milestone", label: "نقطهٔ عطف", type: "checkbox" },
    { key: "dependency", label: "شروع بعد از", type: "select", options: [
      { value: "", label: "تاریخ نوشته‌شده" },
      ...draft.rows.filter((item) => item.id !== row.id).map((item) => ({ value: item.id, label: item.first || "کار بدون نام" })),
    ] },
  ];
  if (kind === "timeline") return [{ key: "section", label: "بخش یا دورهٔ مادر", placeholder: "مانند نسخه‌های اصلی" }];
  if (kind === "kanban") return [
    { key: "assigned", label: "مسئول" }, { key: "ticket", label: "شمارهٔ تیکت" },
    { key: "priority", label: "اولویت", type: "select", options: [
      { value: "", label: "بدون اولویت" }, { value: "Very High", label: "بسیار زیاد" }, { value: "High", label: "زیاد" }, { value: "Low", label: "کم" }, { value: "Very Low", label: "بسیار کم" },
    ] },
  ];
  if (kind === "gitgraph") return [
    { key: "action", label: "نوع رویداد", type: "select", options: [
      { value: "commit", label: "ثبت تغییر" }, { value: "merge", label: "ادغام شاخه" }, { value: "cherry-pick", label: "برداشتن یک ثبت" },
    ] },
    { key: "commitType", label: "نمایش ثبت", type: "select", options: [
      { value: "NORMAL", label: "عادی" }, { value: "HIGHLIGHT", label: "برجسته" }, { value: "REVERSE", label: "معکوس" },
    ] },
    { key: "tag", label: "برچسب نسخه", placeholder: "v1.0" },
    { key: "parent", label: "والد merge برای cherry-pick", placeholder: "شناسهٔ والد" },
  ];
  if (kind === "xychart") return [
    { key: "series", label: "نام سری", placeholder: "سری ۱" },
    { key: "seriesType", label: "نوع سری", type: "select", options: [
      { value: "line", label: "خطی" }, { value: "bar", label: "میله‌ای" },
    ] },
    { key: "color", label: "رنگ سری", placeholder: "#2557e5" },
  ];
  if (kind === "sankey") return [
    { key: "sourceColor", label: "رنگ مبدأ", placeholder: "#2557e5" },
    { key: "targetColor", label: "رنگ مقصد", placeholder: "#299452" },
  ];
  if (kind === "mindmap") return [
    { key: "shape", label: "شکل گرهٔ فرزند", type: "select", options: [
      { value: "default", label: "پیش‌فرض" }, { value: "square", label: "مربع" }, { value: "rounded", label: "گوشه‌گرد" }, { value: "circle", label: "دایره" }, { value: "bang", label: "برجسته" }, { value: "cloud", label: "ابر" }, { value: "hexagon", label: "شش‌ضلعی" },
    ] },
    { key: "icon", label: "کلاس آیکون", placeholder: "fa fa-book" },
  ];
  if (kind === "journey") return [{ key: "actors", label: "بازیگران", placeholder: "کاربر، پشتیبان", help: "چند بازیگر را با ویرگول جدا کنید." }];
  if (kind === "quadrant") return [
    { key: "color", label: "رنگ نقطه", placeholder: "#2557e5" },
    { key: "radius", label: "اندازهٔ نقطه", type: "number", min: 1, max: 40 },
    { key: "strokeColor", label: "رنگ کادر", placeholder: "#171b18" },
    { key: "strokeWidth", label: "ضخامت کادر", type: "number", min: 0, max: 12 },
  ];
  if (kind === "swimlane") {
    const shapes: ControlOption[] = [
      { value: "rect", label: "مستطیل" }, { value: "rounded", label: "گوشه‌گرد" },
      { value: "stadium", label: "کپسولی" }, { value: "circle", label: "دایره" },
      { value: "diamond", label: "تصمیم" }, { value: "cylinder", label: "پایگاه داده" },
      { value: "hexagon", label: "شش‌ضلعی" },
    ];
    return [
      { key: "targetLane", label: "مسئول مرحلهٔ بعد", placeholder: "مانند پشتیبانی" },
      { key: "shape", label: "شکل مرحله", type: "select", options: shapes },
      { key: "targetShape", label: "شکل مرحلهٔ بعد", type: "select", options: shapes },
      { key: "edgeLabel", label: "برچسب مسیر", placeholder: "مانند ارجاع یا تأیید" },
    ];
  }
  if (kind === "block") {
    const shapes: ControlOption[] = [
      { value: "rect", label: "مستطیل" }, { value: "rounded", label: "گوشه‌گرد" },
      { value: "stadium", label: "کپسولی" }, { value: "circle", label: "دایره" },
      { value: "diamond", label: "تصمیم" }, { value: "cylinder", label: "پایگاه داده" },
      { value: "hexagon", label: "شش‌ضلعی" },
    ];
    return [
      { key: "sourceShape", label: "شکل بلوک مبدأ", type: "select", options: shapes },
      { key: "targetShape", label: "شکل بلوک مقصد", type: "select", options: shapes },
      { key: "sourceWidth", label: "پهنای بلوک مبدأ (ستون)", type: "number", min: 1, max: 12 },
      { key: "targetWidth", label: "پهنای بلوک مقصد (ستون)", type: "number", min: 1, max: 12 },
      { key: "linkType", label: "نوع اتصال", type: "select", options: [
        { value: "arrow", label: "پیکان" }, { value: "line", label: "خط ساده" },
        { value: "dotted", label: "خط‌چین" }, { value: "thick", label: "پررنگ" },
      ] },
    ];
  }
  if (kind === "eventmodeling") return [
    { key: "entityType", label: "نوع موجودیت", type: "select", options: [
      { value: "ui", label: "رابط کاربر" }, { value: "cmd", label: "فرمان" },
      { value: "evt", label: "رویداد" }, { value: "pcr", label: "پردازشگر" },
      { value: "rmo", label: "مدل خواندن" },
    ] },
    { key: "resetFrame", label: "شروع یک قاب زمانی تازه", type: "checkbox" },
  ];
  if (kind === "venn") return [
    { key: "regionType", label: "نوع ناحیه", type: "select", options: [
      { value: "set", label: "مجموعهٔ مستقل" },
      { value: "union", label: "هم‌پوشانی چند مجموعه" },
    ] },
  ];
  if (kind === "wardley") return [
    { key: "nodeType", label: "نقش جزء", type: "select", options: [
      { value: "component", label: "جزء زنجیرهٔ ارزش" }, { value: "anchor", label: "لنگر یا نیاز کاربر" },
    ] },
    { key: "dependsOn", label: "وابسته به", type: "select", options: [
      { value: "", label: "بدون وابستگی" },
      ...draft.rows.filter((item) => item.id !== row.id).map((item) => ({ value: item.id, label: item.first || "جزء بدون نام" })),
    ] },
    { key: "inertia", label: "دارای مانع تغییر (اینرسی)", type: "checkbox" },
    { key: "strategy", label: "راهبرد تأمین", type: "select", options: [
      { value: "", label: "بدون راهبرد" }, { value: "build", label: "ساخت" },
      { value: "buy", label: "خرید" }, { value: "outsource", label: "برون‌سپاری" },
      { value: "market", label: "بازار" },
    ] },
    { key: "evolveTarget", label: "بلوغ هدف؛ ۰ تا ۱", type: "number", min: 0, max: 1, step: 0.01 },
  ];
  if (kind === "cynefin") {
    const domains: ControlOption[] = [
      { value: "complex", label: "پیچیده؛ آزمون و یادگیری" },
      { value: "complicated", label: "کارشناسی؛ تحلیل و پاسخ" },
      { value: "clear", label: "روشن؛ الگوی شناخته‌شده" },
      { value: "chaotic", label: "آشوب؛ اقدام فوری" },
      { value: "confusion", label: "ابهام؛ هنوز نامشخص" },
    ];
    return [
      { key: "domain", label: "دامنهٔ موقعیت", type: "select", options: domains },
      { key: "transitionTo", label: "جابه‌جایی به دامنه", type: "select", options: [{ value: "", label: "بدون جابه‌جایی" }, ...domains.filter((option) => option.value !== row.meta.domain)] },
    ];
  }
  if (kind === "treeview") return [
    { key: "nodeType", label: "نوع گره", type: "select", options: [
      { value: "directory", label: "پوشه یا شاخه" }, { value: "file", label: "فایل یا برگ" },
    ] },
    { key: "highlight", label: "برجسته‌کردن این گره", type: "checkbox" },
  ];
  return [];
}

function FieldControl({
  spec,
  value,
  onChange,
  error,
  id,
}: {
  spec: ControlSpec;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
  error?: string;
  id: string;
}) {
  const helpId = spec.help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  if (spec.type === "checkbox") {
    return (
      <label className={`mermaid-option-check${error ? " has-error" : ""}`}>
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span>{spec.label}</span>
        {error && <small id={errorId}>{error}</small>}
      </label>
    );
  }
  return (
    <label className={`mermaid-option-field${error ? " has-error" : ""}`} htmlFor={id}>
      <span>{spec.label}</span>
      {spec.type === "select" ? (
        <select id={id} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={errorId ?? helpId}>
          {spec.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : (
        <input
          id={id}
          type={spec.type === "number" ? "number" : "text"}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          placeholder={spec.placeholder}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          inputMode={spec.type === "number" ? "decimal" : undefined}
          dir={spec.type === "number" ? "ltr" : "auto"}
          maxLength={spec.type === "number" ? undefined : 320}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId ?? helpId}
          data-editable-kind="generic"
        />
      )}
      {spec.help && <small id={helpId}>{spec.help}</small>}
      {error && <small id={errorId} className="mermaid-inline-error">{error}</small>}
    </label>
  );
}

function structureSummary(draft: SimpleDiagramDraft) {
  if (draft.kind === "flowchart") return draft.rows.map((row) => `${row.meta.sourceGroup ? `${row.meta.sourceGroup} ← ` : ""}${row.first || "مبدأ"} ← ${row.second || "مقصد"}${row.meta.targetGroup ? ` ← ${row.meta.targetGroup}` : ""}`);
  if (draft.kind === "sequence") return draft.rows.map((row) => `${row.meta.sourceGroup ? `${row.meta.sourceGroup} ← ` : ""}${row.first || "فرستنده"} ← ${row.second || "گیرنده"}${row.meta.targetGroup ? ` ← ${row.meta.targetGroup}` : ""}`);
  if (draft.kind === "class") return draft.rows.map((row) => `${row.meta.sourceNamespace ? `${row.meta.sourceNamespace} ← ` : ""}${row.first || "کلاس اول"} ← ${row.second || "کلاس دوم"}${row.meta.targetNamespace ? ` ← ${row.meta.targetNamespace}` : ""}`);
  if (draft.kind === "state") return draft.rows.map((row) => `${row.meta.sourceParent ? `${row.meta.sourceParent} ← ` : ""}${row.first || "حالت اول"} ← ${row.second || "حالت دوم"}${row.meta.targetParent ? ` ← ${row.meta.targetParent}` : ""}`);
  if (draft.kind === "architecture") return draft.rows.map((row) => `${row.meta.sourceGroup ? `${row.meta.sourceGroup} ← ` : ""}${row.first || "سرویس اول"} ← ${row.second || "سرویس دوم"}${row.meta.targetGroup ? ` ← ${row.meta.targetGroup}` : ""}`);
  if (draft.kind === "c4") return draft.rows.map((row) => `${row.first || "مبدأ"} ← ${row.second || "مقصد"}${row.meta.boundary ? ` · مرز ${row.meta.boundary}` : ""}`);
  if (draft.kind === "gantt") return draft.rows.map((row) => `${row.meta.section || "برنامه"} ← ${row.first || "کار"}`);
  if (draft.kind === "timeline") return draft.rows.map((row) => `${row.meta.section || "بدون بخش"} ← ${row.first || "دوره"} ← ${row.second || "رویداد"}`);
  if (draft.kind === "kanban") return draft.rows.map((row) => `${row.first || "ستون"} ← ${row.second || "کار"}`);
  if (draft.kind === "mindmap") return draft.rows.map((row) => `${row.first || draft.title} ← ${row.second || "گره"}`);
  return [];
}

function rowDetailsCopy(kind: SimpleDiagramKind, count: number) {
  if (kind === "requirement") {
    return {
      title: "تنظیمات این نیازمندی",
      description: "نوع، ریسک، روش اعتبارسنجی و رابطه",
    };
  }
  const copy: Partial<Record<SimpleDiagramKind, { title: string; description: string }>> = {
    swimlane: { title: "مسئولیت و اتصال این مرحله", description: "مسئول مرحلهٔ بعد، شکل و نام مسیر" },
    block: { title: "چیدمان این اتصال", description: "شکل، پهنا و نوع خط میان دو بلوک" },
    eventmodeling: { title: "نقش این قاب زمانی", description: "نوع موجودیت و شروع قاب تازه" },
    venn: { title: "معنای این ناحیه", description: "مجموعهٔ مستقل یا هم‌پوشانی" },
    wardley: { title: "جایگاه و راهبرد این جزء", description: "نقش، وابستگی، اینرسی و مسیر بلوغ" },
    cynefin: { title: "دامنهٔ این موقعیت", description: "جایگاه تصمیم و جابه‌جایی احتمالی" },
    treeview: { title: "نوع این گره", description: "فایل یا پوشه و وضعیت برجسته" },
  };
  if (copy[kind]) return copy[kind];
  return {
    title: "جزئیات ردیف",
    description: `${count.toLocaleString("fa-IR")} گزینهٔ تکمیلی`,
  };
}

export function MermaidSimpleBuilder({
  draft,
  onChange,
  onChooseKind,
  onPreviewChange,
}: {
  draft: SimpleDiagramDraft | null;
  onChange: (draft: SimpleDiagramDraft) => void;
  onChooseKind: (draft: SimpleDiagramDraft | null) => void;
  onPreviewChange?: (preview: MermaidDiagramPreview | null) => void;
}) {
  const [selectedSeries, setSelectedSeries] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const historyKey = draft?.kind ?? "none";
  const [history, setHistory] = useState<{ key: string; undo: SimpleDiagramDraft[]; redo: SimpleDiagramDraft[] }>({ key: historyKey, undo: [], redo: [] });
  const activeHistory = history.key === historyKey ? history : { key: historyKey, undo: [], redo: [] };

  if (!draft) {
    return (
      <MermaidDiagramCatalog
        onChoose={(kind) => onChooseKind(createSimpleDiagramDraft(kind))}
        onPreviewChange={onPreviewChange}
      />
    );
  }

  const commit = (next: SimpleDiagramDraft) => {
    setHistory((current) => ({
      key: historyKey,
      undo: [...(current.key === historyKey ? current.undo : []).slice(-49), cloneDraft(draft)],
      redo: [],
    }));
    onChange(next);
  };
  const undo = () => {
    const previous = activeHistory.undo.at(-1);
    if (!previous) return;
    setHistory((current) => ({
      key: historyKey,
      undo: current.undo.slice(0, -1),
      redo: [...current.redo, cloneDraft(draft)],
    }));
    onChange(previous);
  };
  const redo = () => {
    const next = activeHistory.redo.at(-1);
    if (!next) return;
    setHistory((current) => ({
      key: historyKey,
      undo: [...current.undo, cloneDraft(draft)],
      redo: current.redo.slice(0, -1),
    }));
    onChange(next);
  };

  const fields = simpleDiagramFields(draft.kind);
  const option = SIMPLE_DIAGRAM_OPTIONS.find((item) => item.kind === draft.kind);
  const supportsOrientation = supportsDiagramOrientation(draft.kind);
  const axisGuidance = diagramAxisGuidance(draft.kind);
  const settings = settingControls(draft.kind);
  const issues = validateSimpleDiagramDraft(draft);
  const summaries = structureSummary(draft);
  const seriesNames = [...new Set(draft.rows.map(row => String(row.meta.series || "سری ۱")))];
  const currentSeries = seriesNames.includes(selectedSeries) ? selectedSeries : seriesNames[0];
  const Overview = draft.kind === "xychart" ? "details" : "div";
  const updateSeries = (key: string, value: string | boolean) => {
    commit({ ...draft, rows: draft.rows.map(row => String(row.meta.series || "سری ۱") === currentSeries ? { ...row, meta: { ...row.meta, [key]: value } } : row) });
    if (key === "series") setSelectedSeries(String(value));
  };
  const addPoint = () => {
    const point = createSimpleDiagramRow(draft.kind, nextRowId());
    const source = draft.rows.find(row => String(row.meta.series || "سری ۱") === currentSeries);
    commit({ ...draft, rows: [...draft.rows, draft.kind === "xychart" && source ? { ...point, meta: { ...source.meta } } : point] });
  };
  const issueFor = (rowId: string | undefined, field: SimpleDiagramIssue["field"]) => issues.find((issue) => issue.rowId === rowId && issue.field === field)?.message;
  const updateRow = (id: string, field: "first" | "second" | "value", value: string) => commit({ ...draft, rows: draft.rows.map((item) => item.id === id ? { ...item, [field]: value } : item) });
  const updateRowMeta = (id: string, key: string, value: string | boolean) => commit({ ...draft, rows: draft.rows.map((item) => item.id === id ? { ...item, meta: { ...item.meta, [key]: value } } : item) });
  const updateSetting = (key: string, value: string | boolean) => commit({ ...draft, settings: { ...draft.settings, [key]: value } });
  const numericValue = fields.valueInput === "number" || fields.valueInput === "date" || fields.valueInput === "duration";
  const moveRow = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= draft.rows.length) return;
    const rows = [...draft.rows];
    [rows[index], rows[target]] = [rows[target], rows[index]];
    commit({ ...draft, rows });
  };
  const moveRowTo = (sourceId: string, targetId: string) => {
    const source = draft.rows.findIndex((item) => item.id === sourceId);
    const target = draft.rows.findIndex((item) => item.id === targetId);
    if (source < 0 || target < 0 || source === target) return;
    const rows = [...draft.rows];
    const [moved] = rows.splice(source, 1);
    rows.splice(target, 0, moved);
    commit({ ...draft, rows });
  };

  return (
    <section className="mermaid-form-builder" aria-label={`ساخت آسان ${option?.title ?? "نمودار"}`}>
      <header className="mermaid-form-intro">
        <div><span>ساخت آسان</span><h2>{option?.title}</h2><p>{option?.description}</p></div>
        <div className="mermaid-form-head-actions">
          <button type="button" onClick={undo} disabled={!activeHistory.undo.length} aria-label="برگرداندن تغییر فرم"><Undo2 size={17} aria-hidden="true" />واگرد</button>
          <button type="button" onClick={redo} disabled={!activeHistory.redo.length} aria-label="انجام دوبارهٔ تغییر فرم"><Redo2 size={17} aria-hidden="true" />ازنو</button>
          <button type="button" onClick={() => onChooseKind(null)}>تغییر نوع</button>
        </div>
      </header>

      <Overview className={draft.kind === "xychart" ? "xy-overview-settings" : "diagram-overview-settings"}>
      {draft.kind === "xychart" && <summary>تنظیمات کلی نمودار</summary>}
      {option?.showTitle && (
        <label className="mermaid-form-title"><span>عنوان نمودار</span><input value={draft.title} onChange={(event) => commit({ ...draft, title: event.target.value })} data-editable-kind="generic" dir="auto" maxLength={180} /></label>
      )}

      {draft.kind === "c4" && (
        <div className="mermaid-c4-notice" role="note"><AlertCircle size={18} aria-hidden="true" /><span><strong>چیدمان C4 با ترتیب عناصر کنترل می‌شود.</strong> جهت‌نماهای صوری حذف شده‌اند؛ ردیف‌ها را بکشید یا با دکمه‌های جابه‌جایی مرتب کنید.</span></div>
      )}

      {supportsOrientation ? (
        <fieldset className="mermaid-layout-control">
          <legend>{draft.kind === "xychart" ? "جهت محور نمودار" : "جهت گسترش نمودار"}</legend>
          <button type="button" className={draft.orientation === "horizontal" ? "is-active" : ""} aria-pressed={draft.orientation === "horizontal"} onClick={() => commit({ ...draft, orientation: "horizontal" })}>
            <span className="mermaid-layout-glyph is-horizontal" aria-hidden="true" /><span><strong>گسترش در عرض</strong><small>{draft.kind === "xychart" ? "ستون‌ها عمودی می‌مانند" : "گره‌ها کنار هم قرار می‌گیرند"}</small></span>
          </button>
          <button type="button" className={draft.orientation === "vertical" ? "is-active" : ""} aria-pressed={draft.orientation === "vertical"} onClick={() => commit({ ...draft, orientation: "vertical" })}>
            <span className="mermaid-layout-glyph is-vertical" aria-hidden="true" /><span><strong>گسترش در طول</strong><small>{draft.kind === "xychart" ? "نمودار افقی می‌شود" : "گره‌ها زیر هم قرار می‌گیرند"}</small></span>
          </button>
        </fieldset>
      ) : axisGuidance ? (
        <div className="mermaid-axis-guide" aria-label="راهنمای کنترل عرض و طول نمودار"><span><strong>کنترل عرض</strong>{axisGuidance.horizontal}</span><span><strong>کنترل طول</strong>{axisGuidance.vertical}</span></div>
      ) : null}

      {settings.length > 0 && (
        <details className="mermaid-form-settings">
          <summary><Settings2 size={18} aria-hidden="true" /><span><strong>تنظیمات نمودار</strong><small>{settings.length.toLocaleString("fa-IR")} کنترل تکمیلی</small></span><ChevronDown size={17} aria-hidden="true" /></summary>
          <div className="mermaid-option-grid">
            {settings.map((spec) => <FieldControl key={spec.key} spec={spec} value={draft.settings[spec.key]} onChange={(value) => updateSetting(spec.key, value)} error={issueFor(undefined, `settings.${spec.key}`)} id={`diagram-setting-${spec.key}`} />)}
          </div>
        </details>
      )}

      </Overview>
      {issues.length > 0 && (
        <div className="mermaid-form-issues" role="status" aria-live="polite"><AlertCircle size={18} aria-hidden="true" /><span><strong>{issues.length.toLocaleString("fa-IR")} مورد نیاز به اصلاح است.</strong><ul>{issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul></span></div>
      )}

      {summaries.length > 0 && (
        <details className="mermaid-structure-outline"><summary>نمای ساختار <small>{summaries.length.toLocaleString("fa-IR")} ردیف</small></summary><ol>{summaries.map((summary, index) => <li key={`${draft.rows[index]?.id}-summary`}>{summary}</li>)}</ol></details>
      )}

      {draft.kind === "xychart" && <section className="xy-series-controls" aria-label="سری‌های نمودار XY">
        <div className="xy-series-tabs" role="group" aria-label="سری جاری">{seriesNames.map(name => <button type="button" key={name} aria-pressed={currentSeries === name} onClick={() => setSelectedSeries(name)}>{name} · {draft.rows.filter(row => String(row.meta.series || "سری ۱") === name).length.toLocaleString("fa-IR")} نقطه</button>)}</div>
        <label>نام سری <input value={currentSeries} onChange={event => updateSeries("series", event.target.value)} /></label>
        <details className="xy-series-style"><summary>تنظیمات سری · نوع و رنگ</summary><div>
        <label>نوع سری <select value={String(draft.rows.find(row => String(row.meta.series || "سری ۱") === currentSeries)?.meta.seriesType || "line")} onChange={event => updateSeries("seriesType", event.target.value)}><option value="line">خطی</option><option value="bar">ستونی</option></select></label>
        <label>رنگ سری <input dir="ltr" placeholder="#2557e5" value={String(draft.rows.find(row => String(row.meta.series || "سری ۱") === currentSeries)?.meta.color || "")} onChange={event => updateSeries("color", event.target.value)} /></label>
        </div></details>
        <button type="button" onClick={() => {
          let index = seriesNames.length + 1;
          while (seriesNames.includes(`سری ${index}`)) index++;
          const name = `سری ${index}`;
          const point = createSimpleDiagramRow("xychart", nextRowId());
          commit({ ...draft, rows: [...draft.rows, { ...point, meta: { ...point.meta, series: name } }] }); setSelectedSeries(name);
        }}><Plus size={16} aria-hidden="true" /> افزودن سری</button>
      </section>}
      <div className={`mermaid-form-table ${fields.value ? "has-value" : "without-value"} ${fields.value && !numericValue ? "value-is-text" : "value-is-compact"} is-${draft.kind}`}>
        <div className="mermaid-form-table-head" aria-hidden="true"><span>{fields.first}</span>{fields.second && <span>{fields.second}</span>}{fields.value && <span>{fields.value}</span>}<span /></div>
        {draft.rows.filter(item => draft.kind !== "xychart" || String(item.meta.series || "سری ۱") === currentSeries).map((item) => {
          const index = draft.rows.findIndex(row => row.id === item.id);
          const extras = rowControls(draft.kind, draft, item).filter(spec => draft.kind !== "xychart" || !["series", "seriesType", "color"].includes(spec.key));
          const detailsCopy = rowDetailsCopy(draft.kind, extras.length);
          const firstError = issueFor(item.id, "first");
          const secondError = issueFor(item.id, "second");
          const valueError = issueFor(item.id, "value");
          return (
            <div className={`mermaid-form-row-shell${draggingId === item.id ? " is-dragging" : ""}`} key={item.id} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggingId) moveRowTo(draggingId, item.id); setDraggingId(null); }}>
              {draft.kind === "xychart" && <label className="xy-point-series">سری نقطهٔ {item.first || (index + 1).toLocaleString("fa-IR")}<select aria-label={`انتقال نقطه ${item.first || index + 1} به سری`} value={String(item.meta.series || "سری ۱")} onChange={event => {
                const target = draft.rows.find(row => String(row.meta.series || "سری ۱") === event.target.value);
                commit({ ...draft, rows: draft.rows.map(row => row.id === item.id ? { ...row, meta: { ...row.meta, series: event.target.value, seriesType: target?.meta.seriesType || "line", color: target?.meta.color || "" } } : row) });
              }}>{seriesNames.map(name => <option key={name}>{name}</option>)}</select></label>}
              <div className="mermaid-form-row">
                <label className={firstError ? "has-error" : ""}><span className="visually-hidden">{fields.first}، ردیف {(index + 1).toLocaleString("fa-IR")}</span><input value={item.first} onChange={(event) => updateRow(item.id, "first", event.target.value)} placeholder={fields.first} data-editable-kind="generic" dir="auto" maxLength={160} aria-invalid={Boolean(firstError)} aria-describedby={firstError ? `${item.id}-first-error` : undefined} />{firstError && <small id={`${item.id}-first-error`} className="mermaid-inline-error">{firstError}</small>}</label>
                {fields.second && <label className={secondError ? "has-error" : ""}><span className="visually-hidden">{fields.second}، ردیف {(index + 1).toLocaleString("fa-IR")}</span><input value={item.second} onChange={(event) => updateRow(item.id, "second", event.target.value)} placeholder={fields.second} inputMode={fields.valueInput === "date" ? "numeric" : undefined} data-editable-kind="generic" dir={fields.valueInput === "date" ? "ltr" : "auto"} maxLength={200} aria-invalid={Boolean(secondError)} aria-describedby={secondError ? `${item.id}-second-error` : undefined} />{secondError && <small id={`${item.id}-second-error`} className="mermaid-inline-error">{secondError}</small>}</label>}
                {fields.value && <label className={`mermaid-form-value${valueError ? " has-error" : ""}`}><span className="visually-hidden">{fields.value}، ردیف {(index + 1).toLocaleString("fa-IR")}</span><input value={item.value} onChange={(event) => updateRow(item.id, "value", event.target.value)} placeholder={fields.valueInput === "number" ? "۰" : fields.value} inputMode={numericValue ? "decimal" : "text"} data-editable-kind="generic" dir={numericValue ? "ltr" : "auto"} maxLength={200} aria-invalid={Boolean(valueError)} aria-describedby={valueError ? `${item.id}-value-error` : undefined} />{valueError && <small id={`${item.id}-value-error`} className="mermaid-inline-error">{valueError}</small>}</label>}
                <div className="mermaid-form-row-actions" aria-label={`کنترل ردیف ${(index + 1).toLocaleString("fa-IR")}`}>
                  <span className="mermaid-row-drag" draggable onDragStart={() => setDraggingId(item.id)} onDragEnd={() => setDraggingId(null)} title="کشیدن برای جابه‌جایی"><GripVertical size={18} aria-hidden="true" /></span>
                  <button type="button" onClick={() => moveRow(index, -1)} disabled={index === 0} aria-label={`انتقال ردیف ${(index + 1).toLocaleString("fa-IR")} به بالا`}><ChevronUp size={17} aria-hidden="true" /></button>
                  <button type="button" onClick={() => moveRow(index, 1)} disabled={index === draft.rows.length - 1} aria-label={`انتقال ردیف ${(index + 1).toLocaleString("fa-IR")} به پایین`}><ChevronDown size={17} aria-hidden="true" /></button>
                  <button type="button" onClick={() => { const copy = { ...item, id: nextRowId(), meta: { ...item.meta } }; const rows = [...draft.rows]; rows.splice(index + 1, 0, copy); commit({ ...draft, rows }); }} aria-label={`تکثیر ردیف ${(index + 1).toLocaleString("fa-IR")}`}><Copy size={16} aria-hidden="true" /></button>
                  <button type="button" className="mermaid-form-remove" onClick={() => commit({ ...draft, rows: draft.rows.filter((currentRow) => currentRow.id !== item.id) })} disabled={draft.rows.length === 1} aria-label={`حذف ردیف ${(index + 1).toLocaleString("fa-IR")}`}><Trash2 size={17} aria-hidden="true" /></button>
                </div>
              </div>
              {extras.length > 0 && (
                ESSENTIAL_ROW_CONTROL_KINDS.has(draft.kind) ? (
                  <section className="mermaid-row-details is-essential" aria-label={detailsCopy.title}>
                    <div className="mermaid-row-details-heading">
                      <span>
                        <strong>{detailsCopy.title}</strong>
                        <small>{detailsCopy.description}</small>
                      </span>
                      <Settings2 size={18} aria-hidden="true" />
                    </div>
                    <div className="mermaid-option-grid">{extras.map((spec) => <FieldControl key={spec.key} spec={spec} value={item.meta[spec.key]} onChange={(value) => updateRowMeta(item.id, spec.key, value)} error={issueFor(item.id, `meta.${spec.key}`)} id={`${item.id}-meta-${spec.key}`} />)}</div>
                  </section>
                ) : (
                  <details className="mermaid-row-details">
                    <summary>
                      <span>
                        <strong>{detailsCopy.title}</strong>
                        <small>{detailsCopy.description}</small>
                      </span>
                      <ChevronDown size={17} aria-hidden="true" />
                    </summary>
                    <div className="mermaid-option-grid">{extras.map((spec) => <FieldControl key={spec.key} spec={spec} value={item.meta[spec.key]} onChange={(value) => updateRowMeta(item.id, spec.key, value)} error={issueFor(item.id, `meta.${spec.key}`)} id={`${item.id}-meta-${spec.key}`} />)}</div>
                  </details>
                )
              )}
            </div>
          );
        })}
      </div>

      <button type="button" className="mermaid-form-add" onClick={addPoint}><Plus size={17} aria-hidden="true" />{draft.kind === "xychart" ? `افزودن نقطه به ${currentSeries}` : fields.add}</button>

      {ADVANCED_ONLY[draft.kind] && <p className="mermaid-advanced-note"><span>فقط در حالت پیشرفته</span>{ADVANCED_ONLY[draft.kind]}</p>}
      <p className="mermaid-form-footnote">تغییرها همان لحظه در پیش‌نمایش دیده می‌شوند؛ متن اصلی فارسی ذخیره می‌شود و تبدیل‌های عددی فقط هنگام رندر انجام می‌شوند.</p>
    </section>
  );
}
