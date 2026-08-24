"use client";

import type { KeyboardEvent } from "react";

type TableSizePickerProps = {
  rows: number;
  columns: number;
  onChange: (rows: number, columns: number) => void;
  onConfirm: (rows: number, columns: number) => void;
};

const MIN_COLUMNS = 2;
const MAX_COLUMNS = 6;
const MIN_ROWS = 1;
const MAX_ROWS = 4;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function TableSizePicker({
  rows,
  columns,
  onChange,
  onConfirm,
}: TableSizePickerProps) {
  const setSize = (nextRows: number, nextColumns: number) => {
    onChange(
      clamp(nextRows, MIN_ROWS, MAX_ROWS),
      clamp(nextColumns, MIN_COLUMNS, MAX_COLUMNS),
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let nextRows = rows;
    let nextColumns = columns;
    if (event.key === "ArrowLeft") nextColumns += 1;
    else if (event.key === "ArrowRight") nextColumns -= 1;
    else if (event.key === "ArrowDown") nextRows += 1;
    else if (event.key === "ArrowUp") nextRows -= 1;
    else if (event.key === "Home") {
      nextRows = MIN_ROWS;
      nextColumns = MIN_COLUMNS;
    } else if (event.key === "End") {
      nextRows = MAX_ROWS;
      nextColumns = MAX_COLUMNS;
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      onConfirm(rows, columns);
      return;
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setSize(nextRows, nextColumns);
  };

  return (
    <div className="table-size-picker">
      <div className="table-size-picker__summary" aria-live="polite">
        <strong>ابعاد جدول</strong>
        <span dir="rtl">
          {columns.toLocaleString("fa-IR")} × {rows.toLocaleString("fa-IR")}
        </span>
      </div>
      <div
        className="table-size-picker__grid"
        role="grid"
        aria-label="انتخاب تعداد ستون و ردیف جدول"
        aria-rowcount={MAX_ROWS}
        aria-colcount={MAX_COLUMNS}
        aria-activedescendant={`table-size-${rows}-${columns}`}
        tabIndex={0}
        data-helper-autofocus
        onKeyDown={handleKeyDown}
      >
        {Array.from({ length: MAX_ROWS }, (_, rowIndex) =>
          Array.from({ length: MAX_COLUMNS }, (_, columnIndex) => {
            const cellRows = rowIndex + 1;
            const cellColumns = columnIndex + 1;
            const selected = cellRows <= rows && cellColumns <= columns;
            return (
              <button
                id={`table-size-${cellRows}-${cellColumns}`}
                key={`${cellRows}-${cellColumns}`}
                type="button"
                role="gridcell"
                tabIndex={-1}
                aria-selected={selected}
                aria-label={`${cellColumns.toLocaleString("fa-IR")} ستون و ${cellRows.toLocaleString("fa-IR")} ردیف`}
                data-active={cellRows === rows && cellColumns === columns}
                onPointerEnter={() =>
                  setSize(cellRows, Math.max(MIN_COLUMNS, cellColumns))
                }
                onFocus={() =>
                  setSize(cellRows, Math.max(MIN_COLUMNS, cellColumns))
                }
                onClick={() =>
                  onConfirm(cellRows, Math.max(MIN_COLUMNS, cellColumns))
                }
              />
            );
          }),
        )}
      </div>
      <p className="table-size-picker__hint">
        <span dir="ltr">← → ↑ ↓</span> انتخاب · <kbd>Enter</kbd> ساخت · <kbd>Esc</kbd> بستن
      </p>
    </div>
  );
}
