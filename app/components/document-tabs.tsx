"use client";

import { Pin, Plus, X } from "@/app/icons/material-symbols";
import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";

export type DocumentTabView = {
  id: string;
  title: string;
  dirty: boolean;
  pinned: boolean;
};

type TabMenuState = { tabId: string; x: number; y: number };

export function DocumentTabs({
  tabs,
  activeTabId,
  newTabActive,
  canReopenClosed,
  onSelect,
  onClose,
  onTogglePin,
  onCloseOthers,
  onReopenClosed,
  onNew,
  onCloseNew,
}: {
  tabs: readonly DocumentTabView[];
  activeTabId: string;
  newTabActive: boolean;
  canReopenClosed: boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onTogglePin: (id: string) => void;
  onCloseOthers: (id: string) => void;
  onReopenClosed: () => void;
  onNew: () => void;
  onCloseNew: () => void;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const menuRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuOriginRef = useRef<HTMLButtonElement | null>(null);
  const [menu, setMenu] = useState<TabMenuState | null>(null);
  const [menuIndex, setMenuIndex] = useState(0);

  const closeMenu = (restoreFocus = true) => {
    setMenu(null);
    if (restoreFocus) {
      window.requestAnimationFrame(() => menuOriginRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!menu) return;
    menuRefs.current[menuIndex]?.focus({ preventScroll: true });
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".document-tab-menu")
      ) {
        return;
      }
      closeMenu(false);
    };
    window.addEventListener("pointerdown", dismiss, true);
    return () => window.removeEventListener("pointerdown", dismiss, true);
  }, [menu, menuIndex]);

  const openMenu = (
    tabId: string,
    origin: HTMLButtonElement,
    point?: { x: number; y: number },
  ) => {
    const rect = origin.getBoundingClientRect();
    menuOriginRef.current = origin;
    setMenuIndex(0);
    setMenu({
      tabId,
      x: point?.x ?? Math.min(rect.right, window.innerWidth - 232),
      y: point?.y ?? rect.bottom + 4,
    });
  };

  const moveFocus = (event: KeyboardEvent, currentId: string) => {
    const ids = [
      ...(newTabActive ? ["new-workspace"] : []),
      ...tabs.map((tab) => tab.id),
      "new",
    ];
    const index = Math.max(0, ids.indexOf(currentId));
    let nextIndex = index;
    if (event.key === "ArrowLeft") nextIndex = (index + 1) % ids.length;
    else if (event.key === "ArrowRight") nextIndex = (index - 1 + ids.length) % ids.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = ids.length - 1;
    else return;
    event.preventDefault();
    const nextId = ids[nextIndex];
    refs.current.get(nextId)?.focus();
    if (nextId === "new" || nextId === "new-workspace") onNew();
    else onSelect(nextId);
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tabId: string,
  ) => {
    if (
      event.key === "ContextMenu" ||
      (event.key === "F10" && event.shiftKey)
    ) {
      event.preventDefault();
      openMenu(tabId, event.currentTarget);
      return;
    }
    moveFocus(event, tabId);
  };

  const handleContextMenu = (
    event: MouseEvent<HTMLButtonElement>,
    tabId: string,
  ) => {
    event.preventDefault();
    openMenu(tabId, event.currentTarget, { x: event.clientX, y: event.clientY });
  };

  const menuTab = menu
    ? tabs.find((candidate) => candidate.id === menu.tabId) ?? null
    : null;
  const menuActions = menuTab
    ? [
        {
          label: menuTab.pinned ? "برداشتن سنجاق تب" : "سنجاق کردن تب",
          shortcut: "Alt+Shift+P",
          enabled: true,
          run: () => onTogglePin(menuTab.id),
        },
        {
          label: "بستن تب",
          shortcut: "Ctrl/Cmd+W",
          enabled: true,
          run: () => onClose(menuTab.id),
        },
        {
          label: "بستن سایر تب‌ها",
          shortcut: "—",
          enabled: tabs.length > 1,
          run: () => onCloseOthers(menuTab.id),
        },
        {
          label: "بازکردن آخرین تب بسته‌شده",
          shortcut: "Ctrl/Cmd+Shift+T",
          enabled: canReopenClosed,
          run: onReopenClosed,
        },
      ]
    : [];

  return (
    <nav className="document-tabs" aria-label="سندهای باز">
      <div className="document-tabs__list" role="tablist" aria-orientation="horizontal">
        {newTabActive && (
          <div className="document-tab document-tab--new-workspace is-active">
            <button
              ref={(node) => {
                if (node) refs.current.set("new-workspace", node);
                else refs.current.delete("new-workspace");
              }}
              type="button"
              role="tab"
              aria-selected="true"
              aria-controls="raavi-document-stage"
              aria-label="تب جدید"
              tabIndex={0}
              onKeyDown={(event) => moveFocus(event, "new-workspace")}
            >
              <span>تب جدید</span>
            </button>
            <button
              type="button"
              className="document-tab__close"
              onClick={onCloseNew}
              aria-label="بستن تب جدید"
              title="بستن تب جدید"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}
        {tabs.map((tab) => {
          const selected = !newTabActive && tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`document-tab${selected ? " is-active" : ""}${tab.dirty ? " is-dirty" : ""}${tab.pinned ? " is-pinned" : ""}`}
            >
              <button
                ref={(node) => {
                  if (node) refs.current.set(tab.id, node);
                  else refs.current.delete(tab.id);
                }}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="raavi-document-stage"
                aria-label={`${tab.title}${tab.dirty ? "، ذخیره‌نشده" : ""}${tab.pinned ? "، سنجاق‌شده" : ""}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => onSelect(tab.id)}
                onContextMenu={(event) => handleContextMenu(event, tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
              >
                {tab.pinned && <Pin className="document-tab__pin" size={15} aria-hidden="true" />}
                {tab.dirty && <span className="document-tab__dirty" aria-hidden="true" />}
                <span dir="auto">{tab.title}</span>
              </button>
              {!tab.pinned && (
                <button
                  type="button"
                  className="document-tab__close"
                  onClick={() => onClose(tab.id)}
                  aria-label={`بستن ${tab.title}`}
                  title="بستن تب"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
        <button
          ref={(node) => {
            if (node) refs.current.set("new", node);
            else refs.current.delete("new");
          }}
          type="button"
          className="document-tabs__new"
          aria-label="تب جدید"
          title="تب جدید (Ctrl/Cmd+N)"
          onClick={onNew}
          onKeyDown={(event) => moveFocus(event, "new")}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>

      {menu && menuTab && (
        <div
          className="document-tab-menu"
          role="menu"
          aria-label={`عملیات ${menuTab.title}`}
          style={{ left: menu.x, top: menu.y }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeMenu();
              return;
            }
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            const direction = event.key === "ArrowDown" ? 1 : -1;
            let next = menuIndex;
            do {
              next = (next + direction + menuActions.length) % menuActions.length;
            } while (!menuActions[next].enabled && next !== menuIndex);
            setMenuIndex(next);
          }}
        >
          {menuActions.map((action, index) => (
            <button
              key={action.label}
              ref={(node) => {
                menuRefs.current[index] = node;
              }}
              type="button"
              role="menuitem"
              disabled={!action.enabled}
              tabIndex={index === menuIndex ? 0 : -1}
              onMouseEnter={() => action.enabled && setMenuIndex(index)}
              onClick={() => {
                closeMenu(false);
                action.run();
              }}
            >
              <span>{action.label}</span>
              <kbd dir="ltr">{action.shortcut}</kbd>
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
