"use client";

import { FileArchive, FileText, Pin } from "@/app/icons/material-symbols";
import type { ReactNode } from "react";
import { SuggestionRow } from "./suggestion-row";

export type FileSuggestion = {
  key: string;
  name: string;
  path: string;
  documentType: "markdown" | "ravi";
};

export function FileSuggestionRow({
  file,
  active = false,
  selected = false,
  meta,
  children,
  onOpen,
  pinned,
  onTogglePin,
  optionId,
  optionRole = false,
}: {
  file: FileSuggestion;
  active?: boolean;
  selected?: boolean;
  meta?: ReactNode;
  children?: ReactNode;
  onOpen: () => void;
  pinned?: boolean;
  onTogglePin?: () => void;
  optionId?: string;
  optionRole?: boolean;
}) {
  const Icon = file.documentType === "ravi" ? FileArchive : FileText;
  return (
      <SuggestionRow
        id={optionId}
        icon={<Icon size={16} />}
        title={file.name}
        description={file.path}
        detail={children}
        meta={meta}
        active={active}
        selected={selected}
        optionRole={optionRole}
        onSelect={onOpen}
        trailing={onTogglePin ? (
        <button
          className={`file-suggestion-pin${pinned ? " is-pinned" : ""}`}
          type="button"
          onClick={onTogglePin}
          aria-label={pinned ? `برداشتن سنجاق «${file.name}»` : `سنجاق‌کردن «${file.name}»`}
          aria-pressed={pinned}
          title={pinned ? "برداشتن سنجاق" : "سنجاق‌کردن"}
        >
          <Pin size={14} aria-hidden="true" />
        </button>
        ) : undefined}
      />
  );
}
