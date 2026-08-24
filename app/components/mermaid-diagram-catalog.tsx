"use client";

import { Search } from "@/app/icons/material-symbols";
import { KeyboardEvent, useMemo, useRef, useState } from "react";
import { SIMPLE_DIAGRAM_OPTIONS, SimpleDiagramKind } from "../mermaid/simple-builder";

export const MERMAID_ENGLISH_NAMES: Record<SimpleDiagramKind, string> = {
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

export type MermaidDiagramPreview = {
  kind: SimpleDiagramKind;
  title: string;
  english: string;
};

function normalize(value: string) {
  return value.toLocaleLowerCase("fa-IR").normalize("NFKC")
    .replace(/[يى]/gu, "ی").replace(/ك/gu, "ک")
    .replace(/[\u064B-\u065F\u0670]/gu, "").replace(/[\u200C\u200D]/gu, " ")
    .replace(/\s+/gu, " ").trim();
}

export function MermaidDiagramCatalog({
  selectedKind = "flowchart",
  onChoose,
  onPreviewChange,
}: {
  selectedKind?: SimpleDiagramKind;
  onChoose: (kind: SimpleDiagramKind) => void;
  onPreviewChange?: (preview: MermaidDiagramPreview | null) => void;
}) {
  const [query, setQuery] = useState("");
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const filtered = useMemo(() => {
    const normalized = normalize(query);
    if (!normalized) return SIMPLE_DIAGRAM_OPTIONS;
    return SIMPLE_DIAGRAM_OPTIONS.filter((option) => normalize(
      `${option.title} ${DISPLAY_TITLES[option.kind] ?? ""} ${option.description} ${option.category} ${MERMAID_ENGLISH_NAMES[option.kind]} ${option.kind}`,
    ).includes(normalized));
  }, [query]);

  const preview = (option: (typeof SIMPLE_DIAGRAM_OPTIONS)[number] | null) => onPreviewChange?.(option ? {
    kind: option.kind,
    title: DISPLAY_TITLES[option.kind] ?? option.title,
    english: MERMAID_ENGLISH_NAMES[option.kind],
  } : null);

  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
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

  return (
    <div className="mermaid-ai-panel mermaid-ai-type-step mermaid-universal-catalog" dir="rtl">
      <div className="mermaid-ai-progress"><strong>مرحله ۱ · انتخاب نوع نمودار</strong><span><i /></span></div>
      <h2>چه نموداری می‌خواهید بسازید؟</h2>
      <p>همهٔ ۲۹ نوع نمودار در دسترس‌اند؛ جست‌وجو کنید یا با اسکرول انتخاب کنید.</p>
      <div className="mermaid-ai-catalog" role="listbox" aria-label="نوع نمودار" onKeyDown={handleKeys}>
        {filtered.map((option, index) => {
          const title = DISPLAY_TITLES[option.kind] ?? option.title;
          return (
            <button
              ref={(node) => { optionRefs.current[index] = node; }}
              key={option.kind}
              type="button"
              role="option"
              aria-selected={option.kind === selectedKind}
              aria-label={`${title}، ${option.category}، ${MERMAID_ENGLISH_NAMES[option.kind]}`}
              className={option.kind === selectedKind ? "is-selected" : ""}
              onMouseEnter={() => preview(option)}
              onMouseLeave={() => preview(null)}
              onFocus={() => preview(option)}
              onBlur={() => preview(null)}
              onClick={() => { onPreviewChange?.(null); onChoose(option.kind); }}
            >
              <span className="ai-diagram-thumbnail" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/mermaid-thumbnails/${option.kind}.png`} alt={`نمونهٔ ${title}`} draggable={false} />
              </span>
              <span className="mermaid-ai-card-copy"><strong title={title}>{title}</strong><small>{option.category}</small><em>{MERMAID_ENGLISH_NAMES[option.kind]}</em></span>
            </button>
          );
        })}
        {!filtered.length && <div className="mermaid-ai-catalog-empty" role="status"><Search size={22} aria-hidden="true" /><strong>نموداری پیدا نشد</strong><span>نام فارسی یا انگلیسی دیگری بنویسید.</span></div>}
      </div>
      <label className="mermaid-ai-search"><Search size={17} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "ArrowDown" && filtered.length) { event.preventDefault(); optionRefs.current[0]?.focus(); } }} placeholder="نام نمودار را بنویسید…" /></label>
      <div className="mermaid-ai-catalog-meta"><span>{filtered.length.toLocaleString("fa-IR")} از {SIMPLE_DIAGRAM_OPTIONS.length.toLocaleString("fa-IR")} نوع نمودار</span><span>↑↓ جابه‌جایی · Enter انتخاب</span></div>
      <p className="mermaid-ai-contract-hint">هاور، پیش‌نمایش زنده را عوض می‌کند؛ انتخاب، مستقیم به ورود داده می‌رود.</p>
    </div>
  );
}
