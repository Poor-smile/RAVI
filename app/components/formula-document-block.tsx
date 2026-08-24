"use client";

import "./formula-studio.css";

import { Braces } from "@/app/icons/material-symbols";
import katex from "katex";
import { useMemo } from "react";
import type { FormulaBlock } from "../formula/blocks";
import { formulaAccessibleText } from "../formula/model";

export function FormulaDocumentBlock({
  block,
  readingMode,
  onEdit,
}: {
  block: FormulaBlock;
  readingMode: boolean;
  onEdit: (block: FormulaBlock) => void;
}) {
  const html = useMemo(
    () =>
      katex.renderToString(block.latex, {
        displayMode: true,
        output: "mathml",
        throwOnError: false,
        strict: "ignore",
      }),
    [block.latex],
  );

  return (
    <figure
      className="formula-document-block"
      data-formula-block={block.id}
      data-formula-from={block.startOffset}
      aria-label={formulaAccessibleText(block.latex) || "فرمول"}
    >
      <div
        className="formula-document-math"
        dir="ltr"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {!readingMode && (
        <button type="button" onClick={() => onEdit(block)}>
          <Braces size={16} aria-hidden="true" />
          <span>ویرایش فرمول</span>
        </button>
      )}
    </figure>
  );
}
