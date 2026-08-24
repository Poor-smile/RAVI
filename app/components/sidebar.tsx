"use client";

import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
  RefObject,
} from "react";
import { PanelLeftOpen } from "@/app/icons/material-symbols";
import type { SidebarView } from "../sidebar-state";

export type SidebarRailItem = {
  id: string;
  view: SidebarView;
  label: string;
  icon: ReactNode;
  badge?: number;
  disabled?: boolean;
  magic?: boolean;
};

export function SidebarRail({
  items,
  activeId,
  open,
  onItemSelect,
}: {
  items: readonly SidebarRailItem[];
  activeId: string;
  open: boolean;
  onItemSelect: (item: SidebarRailItem) => void;
}) {
  const moveFocus = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentId: string,
  ) => {
    const enabledItems = items.filter((item) => !item.disabled);
    const currentIndex = enabledItems.findIndex((item) => item.id === currentId);
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % enabledItems.length;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + enabledItems.length) % enabledItems.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = enabledItems.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const nextItem = enabledItems[nextIndex];
    if (!nextItem) return;
    onItemSelect(nextItem);
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(`[data-sidebar-destination="${nextItem.id}"]`)?.focus(),
    );
  };

  return (
    <nav className="sidebar-rail" aria-label="نماهای نوار کناری">
      {items.map((item) => {
        const active = open && item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            className={`${active ? "is-active" : ""} ${item.magic ? "is-magic" : ""}`.trim() || undefined}
            data-sidebar-view={item.view}
            data-sidebar-destination={item.id}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            aria-expanded={active}
            aria-controls="sidebar-pane-content"
            aria-disabled={item.disabled || undefined}
            disabled={item.disabled}
            title={item.label}
            onClick={() => onItemSelect(item)}
            onKeyDown={(event) => moveFocus(event, item.id)}
          >
            <span className="sidebar-rail-icon" aria-hidden="true">
              {item.icon}
            </span>
            {typeof item.badge === "number" && item.badge > 0 && (
              <span className="sidebar-rail-badge" aria-hidden="true">
                {item.badge > 99 ? "+۹۹" : item.badge.toLocaleString("fa-IR")}
              </span>
            )}
            <span className="sidebar-active-mark" aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}

export function SidebarPaneHeader({
  titleId,
  title,
  eyebrow,
  actions,
  closeButtonRef,
  onClose,
}: {
  titleId: string;
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  closeButtonRef?: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  return (
    <header className="sidebar-pane-header">
      <div className="sidebar-pane-heading">
        {eyebrow && <span>{eyebrow}</span>}
        <strong id={titleId}>{title}</strong>
      </div>
      <div className="sidebar-pane-actions">
        {actions}
        <button
          ref={closeButtonRef}
          type="button"
          data-command-id="view.sidebar"
          onClick={onClose}
          aria-label="جمع‌کردن نوار کناری"
          title="جمع‌کردن نوار کناری"
        >
          <PanelLeftOpen size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

export function SidebarRow({
  icon,
  label,
  meta,
  active = false,
  level = 0,
  onClick,
}: {
  icon?: ReactNode;
  label: ReactNode;
  meta?: ReactNode;
  active?: boolean;
  level?: number;
  onClick: () => void;
}) {
  return (
    <button
      className={`sidebar-row ${active ? "is-active" : ""}`}
      type="button"
      onClick={onClick}
      aria-current={active ? "location" : undefined}
      style={{ "--sidebar-row-level": level } as CSSProperties}
    >
      {icon && <span className="sidebar-row-icon">{icon}</span>}
      <span className="sidebar-row-label" dir="auto">{label}</span>
      {meta && <span className="sidebar-row-meta">{meta}</span>}
    </button>
  );
}

export function Sidebar({
  open,
  modal,
  width,
  labelledBy,
  panelRef,
  children,
  rail,
  persistentRailWhenCollapsed = false,
  onClose,
  onResizePointerDown,
  onResizeKeyDown,
}: {
  open: boolean;
  modal: boolean;
  width: number;
  labelledBy: string;
  panelRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  rail: ReactNode;
  persistentRailWhenCollapsed?: boolean;
  onClose: () => void;
  onResizePointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onResizeKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  return (
    <>
      {modal && open && (
        <button
          className="sidebar-scrim"
          type="button"
          onClick={onClose}
          tabIndex={-1}
          aria-label="بستن نوار کناری"
        />
      )}
      <aside
        ref={panelRef}
        className={`library-panel sidebar-shell ${open ? "is-open" : "is-collapsed"} ${
          modal ? "is-drawer" : ""
        } ${persistentRailWhenCollapsed ? "has-persistent-rail" : ""}`}
        id="library-panel"
        role={modal && open ? "dialog" : "complementary"}
        aria-modal={modal && open ? true : undefined}
        aria-labelledby={open || !modal ? labelledBy : undefined}
        aria-hidden={
          !open && modal && !persistentRailWhenCollapsed ? true : undefined
        }
        style={{ "--sidebar-pane-width": `${width}px` } as CSSProperties}
      >
        {rail}
        <div className="sidebar-pane" inert={!open ? true : undefined}>
          {children}
        </div>
        <div
          className="sidebar-resize-handle"
          role="separator"
          aria-label="تغییر عرض نوار کناری"
          aria-orientation="vertical"
          aria-valuemin={240}
          aria-valuemax={420}
          aria-valuenow={width}
          tabIndex={open && !modal ? 0 : -1}
          onPointerDown={onResizePointerDown}
          onKeyDown={onResizeKeyDown}
        />
      </aside>
    </>
  );
}
