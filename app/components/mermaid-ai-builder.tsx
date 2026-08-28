"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Table2,
  Search,
  Sparkles,
  Upload,
} from "@/app/icons/material-symbols";
import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  SIMPLE_DIAGRAM_OPTIONS,
  SimpleDiagramKind,
} from "../mermaid/simple-builder";

export type MermaidAiStep = "type" | "input" | "clarify" | "building" | "ready" | "error";

const ENGLISH_NAMES: Record<SimpleDiagramKind, string> = {
  flowchart: "Flowchart", sequence: "Sequence", class: "Class", state: "State",
  er: "ER Diagram", requirement: "Requirement", architecture: "Architecture",
  c4: "C4 Context", gantt: "Gantt", timeline: "Timeline", kanban: "Kanban",
  gitgraph: "Git Graph", pie: "Pie", xychart: "XY Chart", sankey: "Sankey",
  mindmap: "Mindmap", journey: "User Journey", quadrant: "Quadrant",
  ishikawa: "Ishikawa", swimlane: "Swimlane", block: "Block", packet: "Packet",
  radar: "Radar", treemap: "Treemap", eventmodeling: "Event Modeling", venn: "Venn",
  wardley: "Wardley Map", cynefin: "Cynefin", treeview: "Tree View",
};

const DISPLAY_TITLES: Partial<Record<SimpleDiagramKind, string>> = {
  swimlane: "مسیر مسئولیت",
  ishikawa: "علت و معلول",
};

export type MermaidAiDiagramPreview = {
  kind: SimpleDiagramKind;
  title: string;
  english: string;
};

function normalizeDiagramSearch(value: string) {
  return value
    .toLocaleLowerCase("fa-IR")
    .normalize("NFKC")
    .replace(/[يى]/gu, "ی")
    .replace(/ك/gu, "ک")
    .replace(/[\u064B-\u065F\u0670]/gu, "")
    .replace(/[\u200C\u200D]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const AI_PROMPTS: Partial<Record<SimpleDiagramKind, string>> = {
  flowchart: "نقطه شروع و پایان، مراحل، تصمیم‌ها و شاخه‌های هر تصمیم را استخراج کن.",
  sequence: "بازیگران، ترتیب پیام‌ها، پاسخ‌ها و مسیرهای شرطی را استخراج کن.",
  pie: "دسته‌ها، مقدار هر دسته و واحد مشترک را استخراج کن.",
  xychart: "محورهای افقی و عمودی، واحدها، سری‌ها و مقدارها را استخراج کن.",
  er: "موجودیت‌ها، ویژگی‌های کلیدی، رابطه‌ها و کاردینالیتی را استخراج کن.",
  gantt: "کارها، وابستگی‌ها، تاریخ شروع، مدت و نقاط عطف را استخراج کن.",
};

function cleanMermaidAnswer(value: string) {
  const fenced = value.match(/```(?:mermaid)?\s*([\s\S]*?)```/i)?.[1];
  return (fenced ?? value).trim();
}

function columnIndex(reference: string) {
  return [...reference.replace(/\d/g, "")].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

type ImportedSheet = { name: string; csv: string };

async function spreadsheetToSheets(file: File): Promise<ImportedSheet[]> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const parser = new DOMParser();
  const sharedXml = await zip.file("xl/sharedStrings.xml")?.async("text");
  const shared = sharedXml
    ? [...parser.parseFromString(sharedXml, "text/xml").querySelectorAll("si")].map((node) => node.textContent ?? "")
    : [];
  const workbookXml = await zip.file("xl/workbook.xml")?.async("text");
  const workbook = workbookXml ? parser.parseFromString(workbookXml, "text/xml") : null;
  const names = workbook ? [...workbook.querySelectorAll("sheet")].map((node) => node.getAttribute("name") ?? "Sheet") : [];
  const paths = Object.keys(zip.files).filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(path)).sort();
  if (!paths.length) throw new Error("sheet_missing");
  return Promise.all(paths.map(async (sheetPath, index) => {
    const xml = await zip.file(sheetPath)!.async("text");
    const rows = [...parser.parseFromString(xml, "text/xml").querySelectorAll("row")];
    const csv = rows.slice(0, 500).map((row) => {
      const values: string[] = [];
      row.querySelectorAll("c").forEach((cell) => {
        const reference = cell.getAttribute("r") ?? "A1";
        const raw = cell.querySelector("v")?.textContent ?? cell.querySelector("t")?.textContent ?? "";
        values[columnIndex(reference)] = cell.getAttribute("t") === "s" ? (shared[Number(raw)] ?? raw) : raw;
      });
      return values.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",");
    }).join("\n");
    return { name: names[index] ?? `Sheet ${index + 1}`, csv };
  }));
}

function DiagramThumbnail({ kind, title }: { kind: SimpleDiagramKind; title: string }) {
  return (
    <span className="ai-diagram-thumbnail" aria-hidden="true">
      {/* Figma exports are committed locally so the catalog remains exact and offline. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/mermaid-thumbnails/${kind}.png`} alt={`نمونهٔ ${title}`} draggable={false} />
    </span>
  );
}

export function MermaidAiBuilder({
  initialText = "",
  initialKind,
  currentCode,
  onCode,
  onExit,
  onChooseAnother,
  onPreviewChange,
  onStepChange,
}: {
  initialText?: string;
  initialKind?: SimpleDiagramKind;
  currentCode: string;
  onCode: (code: string) => void;
  onExit: () => void;
  onChooseAnother?: () => void;
  onPreviewChange?: (preview: MermaidAiDiagramPreview | null) => void;
  onStepChange?: (step: MermaidAiStep) => void;
}) {
  const [step, setStep] = useState<MermaidAiStep>(initialKind ? "input" : "type");
  const [kind, setKind] = useState<SimpleDiagramKind>(initialKind ?? "flowchart");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState(initialText);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<ImportedSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [clarification, setClarification] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const filtered = useMemo(() => {
    const normalized = normalizeDiagramSearch(query);
    if (!normalized) return SIMPLE_DIAGRAM_OPTIONS;
    return SIMPLE_DIAGRAM_OPTIONS.filter((option) =>
      normalizeDiagramSearch(
        `${option.title} ${DISPLAY_TITLES[option.kind] ?? ""} ${option.description} ${option.category} ${ENGLISH_NAMES[option.kind]} ${option.kind}`,
      ).includes(normalized),
    );
  }, [query]);

  useEffect(() => () => onPreviewChange?.(null), [onPreviewChange]);
  useEffect(() => onStepChange?.(step), [onStepChange, step]);

  const previewOption = (option: (typeof SIMPLE_DIAGRAM_OPTIONS)[number] | null) => {
    onPreviewChange?.(option ? {
      kind: option.kind,
      title: DISPLAY_TITLES[option.kind] ?? option.title,
      english: ENGLISH_NAMES[option.kind],
    } : null);
  };

  const handleCatalogKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = optionRefs.current.findIndex((node) => node === document.activeElement);
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = Math.min(filtered.length - 1, currentIndex + 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(0, currentIndex < 0 ? 0 : currentIndex - 1);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = filtered.length - 1;
    else return;
    if (nextIndex < 0) return;
    event.preventDefault();
    optionRefs.current[nextIndex]?.focus();
    optionRefs.current[nextIndex]?.scrollIntoView({ block: "nearest" });
  };

  const chooseKind = (next: SimpleDiagramKind) => {
    setKind(next);
    onPreviewChange?.(null);
    setStep("input");
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (/\.csv$/i.test(file.name)) {
      const csv = await file.text();
      setSheets([{ name: "CSV", csv }]);
      setActiveSheet(0);
      setSource(csv);
      return;
    }
    try {
      const imported = await spreadsheetToSheets(file);
      setSheets(imported);
      setActiveSheet(0);
      setSource(imported[0]?.csv ?? "");
    } catch {
      setError("فایل Excel خوانده نشد؛ فایل سالم با پسوند xlsx انتخاب کنید.");
      setStep("error");
    }
  };

  const build = async (sourceOverride?: string) => {
    const effectiveSource = sourceOverride ?? source;
    if (!effectiveSource.trim()) {
      setError("برای ساخت نمودار، متن یا فایل داده وارد کنید.");
      setStep("error");
      return;
    }
    const run = window.raaviDesktop?.runCodexPrompt;
    if (!run) {
      setError("ChatGPT متصل نیست؛ ابتدا اتصال را از تنظیمات هوش مصنوعی برقرار کنید.");
      setStep("error");
      return;
    }
    setError("");
    setStep("building");
    try {
      const result = await run({
        context: [
          "کد فعلی Mermaid:",
          currentCode,
          "",
          "داده یا درخواست کاربر:",
          effectiveSource,
        ].join("\n"),
        prompt: [
          `کد فعلی را به یک نمودار Mermaid معتبر از نوع ${ENGLISH_NAMES[kind]} تبدیل یا اصلاح کن.`,
          AI_PROMPTS[kind] ?? "قرارداد دادهٔ همین نوع نمودار را رعایت کن و فقط ابهام‌های ضروری را با انتخاب محافظه‌کارانه حل کن.",
          "اگر کد فعلی وجود دارد، ساختار و داده‌های معتبر آن را حفظ کن و فقط تغییر خواسته‌شده را اعمال کن.",
          "اگر یک ابهام ضروری مانع ساخت دقیق است، فقط یک سؤال کوتاه با پیشوند QUESTION: برگردان؛ وگرنه خروجی فقط کد Mermaid باشد، بدون توضیح و بدون Markdown fence.",
          "برچسب‌های فارسی را داخل کوتیشن قرار بده. داده‌ای اختراع نکن.",
        ].join("\n"),
      });
      const raw = result.replacement || result.answer;
      if (/^QUESTION\s*:/i.test(raw.trim())) {
        setQuestion(raw.replace(/^QUESTION\s*:/i, "").trim());
        setClarification("");
        setStep("clarify");
        return;
      }
      const nextCode = cleanMermaidAnswer(raw);
      if (!nextCode) throw new Error("empty");
      onCode(nextCode);
      setStep("ready");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "";
      setError(message.includes("AUTH")
        ? "ورود با ChatGPT کامل نیست؛ دوباره وارد حساب شوید."
        : "نمودار آماده نشد؛ اتصال یا اطلاعات ورودی را بررسی و دوباره تلاش کنید.");
      setStep("error");
    }
  };

  if (step === "type") return (
    <div className="mermaid-ai-panel mermaid-ai-type-step" dir="rtl">
      <h2>چه نموداری می‌خواهید بسازید؟</h2>
      <p>همهٔ انواع پشتیبانی‌شده در دسترس‌اند؛ اسکرول کنید یا نام را بنویسید.</p>
      <div className="mermaid-ai-catalog" role="listbox" aria-label="نوع نمودار" onKeyDown={handleCatalogKeys}>
        {filtered.map((option, index) => (
          <button
            ref={(node) => { optionRefs.current[index] = node; }}
            key={option.kind}
            type="button"
            role="option"
            aria-selected={option.kind === kind}
            aria-label={`${DISPLAY_TITLES[option.kind] ?? option.title}، ${option.category}، ${ENGLISH_NAMES[option.kind]}`}
            className={option.kind === kind ? "is-selected" : ""}
            onMouseEnter={() => previewOption(option)}
            onMouseLeave={() => previewOption(null)}
            onFocus={() => previewOption(option)}
            onBlur={() => previewOption(null)}
            onClick={() => chooseKind(option.kind)}
          >
            <DiagramThumbnail kind={option.kind} title={DISPLAY_TITLES[option.kind] ?? option.title} />
            <span className="mermaid-ai-card-copy"><strong title={DISPLAY_TITLES[option.kind] ?? option.title}>{DISPLAY_TITLES[option.kind] ?? option.title}</strong><small>{option.category}</small><em>{ENGLISH_NAMES[option.kind]}</em></span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="mermaid-ai-catalog-empty" role="status">
            <Search size={22} aria-hidden="true" />
            <strong>نموداری پیدا نشد</strong>
            <span>نام فارسی یا انگلیسی دیگری بنویسید.</span>
          </div>
        )}
      </div>
      <label className="mermaid-ai-search"><Search size={17} aria-hidden="true" /><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(event) => { if (event.key === "ArrowDown" && filtered.length) { event.preventDefault(); optionRefs.current[0]?.focus(); } }} placeholder="نام نمودار را بنویسید…" /></label>
      <div className="mermaid-ai-catalog-meta"><span>{filtered.length.toLocaleString("fa-IR")} از {SIMPLE_DIAGRAM_OPTIONS.length.toLocaleString("fa-IR")} نوع نمودار</span><span>↑↓ جابه‌جایی · Enter انتخاب</span></div>
      <p className="mermaid-ai-contract-hint">پس از انتخاب، سؤال‌ها و ورودی‌های مخصوص همان نمودار بارگذاری می‌شوند.</p>
    </div>
  );

  if (step === "building") return (
    <div className="mermaid-ai-panel mermaid-ai-building" dir="rtl" role="status" aria-live="polite">
      <h2>در حال ساخت نمودار…</h2>
      <p>دادهٔ شما به کد معتبر Mermaid تبدیل و اعتبارسنجی می‌شود.</p>
      <div className="mermaid-ai-loading-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/graph-studio/raavi-ai-approved.svg" alt="" />
        <strong>ساخت ساختار و اعتبارسنجی کد</strong>
        <span aria-hidden="true"><i /></span>
      </div>
      <div className="mermaid-ai-building-checks" aria-label="مراحل ساخت">
        <span><Check size={16} aria-hidden="true" />خواندن اطلاعات نمودار</span>
        <span><Check size={16} aria-hidden="true" />تشخیص گره‌ها و ارتباط‌ها</span>
        <span className="is-active"><Sparkles size={16} aria-hidden="true" />رندر پیش‌نمایش Mermaid</span>
      </div>
    </div>
  );

  if (step === "clarify") return (
    <div className="mermaid-ai-panel mermaid-ai-clarify" dir="rtl">
      <div className="mermaid-ai-question"><Sparkles size={20} aria-hidden="true" /><span><strong>یک نکته را روشن کنید</strong><p>{question}</p></span></div>
      <label>پاسخ شما<textarea autoFocus value={clarification} onChange={(event) => setClarification(event.target.value)} placeholder="پاسخ کوتاه کافی است…" /></label>
      <button className="mermaid-ai-primary" type="button" disabled={!clarification.trim()} onClick={() => {
        const nextSource = `${source}\n\nپاسخ رفع ابهام: ${clarification.trim()}`;
        setSource(nextSource);
        void build(nextSource);
      }}><Check size={17} aria-hidden="true" />ادامهٔ ساخت</button>
      <button className="mermaid-ai-secondary" type="button" onClick={() => setStep("input")}>بازگشت به اطلاعات</button>
    </div>
  );

  if (step === "ready") return (
    <div className="mermaid-ai-panel mermaid-ai-ready" dir="rtl">
      <div className="mermaid-ai-success"><Check size={22} aria-hidden="true" /><strong>نمودار آماده است</strong><p>پیش‌نمایش زنده را بررسی کنید؛ برای تغییر، توضیح تازه بدهید یا کد را باز کنید.</p></div>
      <label>درخواست اصلاح<textarea value={source} onChange={(e) => setSource(e.target.value)} placeholder="مثلاً جهت نمودار را افقی کن…" /></label>
      <button className="mermaid-ai-primary" type="button" onClick={() => void build()}><Sparkles size={17} aria-hidden="true" />اصلاح با هوش مصنوعی</button>
      <button className="mermaid-ai-secondary" type="button" onClick={() => initialKind ? onChooseAnother?.() : setStep("type")}>ساخت نمودار دیگر</button>
      <code className="visually-hidden">{currentCode}</code>
    </div>
  );

  return (
    <div className="mermaid-ai-panel" dir="rtl">
      {!initialKind && <button className="mermaid-ai-back" type="button" onClick={() => setStep("type")}><ArrowLeft size={16} aria-hidden="true" />تغییر نوع</button>}
      <h2>اطلاعات «{SIMPLE_DIAGRAM_OPTIONS.find((item) => item.kind === kind)?.title}» را وارد کنید</h2>
      <p>متن را بنویسید یا بچسبانید؛ برای داده‌های جدولی فایل CSV یا Excel انتخاب کنید.</p>
      <div className="mermaid-ai-imports">
        <button type="button" onClick={() => fileRef.current?.click()}><Table2 size={17} aria-hidden="true" />CSV</button>
        <button type="button" onClick={() => fileRef.current?.click()}><Upload size={17} aria-hidden="true" />Excel</button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx" onChange={(event) => void importFile(event)} />
      </div>
      {fileName && <div className="mermaid-ai-file"><Table2 size={18} aria-hidden="true" /><span><strong>{fileName}</strong><small>فایل برای تحلیل آماده است</small></span></div>}
      {sheets.length > 0 && (
        <div className="mermaid-ai-data-preview">
          {sheets.length > 1 && <label>برگهٔ داده<select value={activeSheet} onChange={(event) => {
            const index = Number(event.target.value);
            setActiveSheet(index);
            setSource(sheets[index]?.csv ?? "");
          }}>{sheets.map((sheet, index) => <option key={`${sheet.name}-${index}`} value={index}>{sheet.name}</option>)}</select></label>}
          <div className="mermaid-ai-preview-table" aria-label="پیش‌نمایش داده">
            {sheets[activeSheet]?.csv.split("\n").slice(0, 4).map((row, index) => <code key={index}>{row}</code>)}
          </div>
        </div>
      )}
      <label className="mermaid-ai-editor-label">داده یا درخواست اصلاح<textarea autoFocus value={source} onChange={(e) => setSource(e.target.value)} placeholder="داده را وارد کنید یا بنویسید چه تغییری در نمودار فعلی انجام شود…" /></label>
      {step === "error" && <div className="mermaid-ai-error" role="alert"><AlertTriangle size={18} aria-hidden="true" /><span>{error}</span></div>}
      <button className="mermaid-ai-primary" type="button" onClick={() => void build()}><Sparkles size={17} aria-hidden="true" />تحلیل اطلاعات و ساخت نمودار</button>
      <button className="mermaid-ai-secondary" type="button" onClick={onExit}>بازگشت به ساخت عادی</button>
    </div>
  );
}
