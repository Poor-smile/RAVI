"use client";

import type { ReactNode } from "react";

export function SuggestionRow({
  id,
  icon,
  title,
  description,
  meta,
  detail,
  trailing,
  selected = false,
  active = false,
  disabled = false,
  optionRole = false,
  onSelect,
}: {
  id?: string;
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  detail?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  active?: boolean;
  disabled?: boolean;
  optionRole?: boolean;
  onSelect: () => void;
}) {
  const content = (
    <>
      <span className="suggestion-row-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="suggestion-row-copy">
        <strong dir="auto">{title}</strong>
        {description && <small dir="auto">{description}</small>}
        {detail}
      </span>
      {meta && <span className="suggestion-row-meta">{meta}</span>}
    </>
  );

  return (
    <div
      id={id}
      className={`suggestion-row${active ? " is-active" : ""}${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
      role={optionRole ? "option" : undefined}
      aria-selected={optionRole ? selected : undefined}
      aria-disabled={optionRole && disabled ? true : undefined}
    >
      {optionRole ? (
        <div
          className="suggestion-row-main"
          onMouseDown={(event) => event.preventDefault()}
          onClick={disabled ? undefined : onSelect}
        >
          {content}
        </div>
      ) : (
        <button
          className="suggestion-row-main"
          type="button"
          disabled={disabled}
          onClick={onSelect}
        >
          {content}
        </button>
      )}
      {trailing}
    </div>
  );
}
