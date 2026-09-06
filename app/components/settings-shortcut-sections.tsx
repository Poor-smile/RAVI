"use client";

import { useMemo, useState } from "react";
import { Search, X } from "@/app/icons/material-symbols";
import { normalizeCommandQuery } from "../commands/command-palette";
import {
  activeBindings,
  bindingParts,
  COMMAND_GROUPS,
  COMMAND_REGISTRY,
  type CommandEnvironment,
  type KeyBinding,
} from "../keyboard/command-registry";
import {
  SHORTCUT_GUIDE_SECTIONS,
  shortcutPlatformLabel,
} from "../keyboard/shortcut-guide";

type CatalogBinding = {
  binding: KeyBinding;
  label?: string;
};

type ShortcutCatalogItem = {
  id: string;
  title: string;
  description: string;
  context?: string;
  bindings: CatalogBinding[];
  separator: "alternative" | "related";
  searchText: string;
};

type ShortcutCatalogGroup = {
  id: string;
  title: string;
  items: ShortcutCatalogItem[];
};

const GUIDE_DUPLICATES = new Set([
  "selection-toolbar-focus",
  "selection-format",
  "selection-link",
]);

function displayBindingParts(
  value: CatalogBinding,
  environment: CommandEnvironment,
) {
  const parts = bindingParts(value.binding, environment.platform);
  if (!value.label) return parts;

  const labelParts = value.label.split("+");
  return [...parts.slice(0, -1), labelParts[labelParts.length - 1]];
}

function ShortcutKeycaps({
  bindings,
  environment,
  separator,
}: {
  bindings: CatalogBinding[];
  environment: CommandEnvironment;
  separator: ShortcutCatalogItem["separator"];
}) {
  const labels = bindings.map((value) =>
    displayBindingParts(value, environment).join(" + "),
  );

  return (
    <span
      className="settings-shortcut-keycaps"
      dir="ltr"
      aria-label={labels.join(separator === "alternative" ? " یا " : "، ")}
    >
      {bindings.map((value, bindingIndex) => {
        const parts = displayBindingParts(value, environment);
        return (
          <span className="settings-keycap-unit" key={`${labels[bindingIndex]}-${bindingIndex}`}>
            {bindingIndex > 0 ? (
              <span className="settings-keycap-separator" aria-hidden="true">
                {separator === "alternative" ? "یا" : "·"}
              </span>
            ) : null}
            <span className="settings-keycap-chord" aria-hidden="true">
              {parts.map((part, partIndex) => (
                <span className="settings-keycap-part" key={`${part}-${partIndex}`}>
                  {partIndex > 0 ? (
                    <span className="settings-keycap-plus">+</span>
                  ) : null}
                  <kbd>{part}</kbd>
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function buildCatalog(environment: CommandEnvironment): ShortcutCatalogGroup[] {
  const contextualGroups = SHORTCUT_GUIDE_SECTIONS.map((section) => ({
    id: `context-${section.id}`,
    title: section.title,
    items: section.items
      .filter((item) => !GUIDE_DUPLICATES.has(item.id))
      .map((item) => {
        const bindingText = item.keys
          .map((value) => displayBindingParts(value, environment).join(" "))
          .join(" ");
        return {
          id: item.id,
          title: item.title,
          description: item.description,
          context: item.context,
          bindings: item.keys,
          separator: "related" as const,
          searchText: normalizeCommandQuery(
            [section.title, item.title, item.description, item.context, bindingText]
              .filter(Boolean)
              .join(" "),
          ),
        };
      }),
  })).filter((section) => section.items.length > 0);

  const commandGroups = COMMAND_GROUPS.map((group) => ({
    id: `commands-${group.id}`,
    title: group.title,
    items: COMMAND_REGISTRY.filter((command) => command.group === group.id)
      .map((command) => ({
        command,
        bindings: activeBindings(command, environment),
      }))
      .filter(({ bindings }) => bindings.length > 0)
      .map(({ command, bindings }) => {
        const bindingText = bindings
          .map((value) => bindingParts(value, environment.platform).join(" "))
          .join(" ");
        return {
          id: command.id,
          title: command.title,
          description: command.description,
          context: command.contextLabel,
          bindings: bindings.map((value) => ({ binding: value })),
          separator: "alternative" as const,
          searchText: normalizeCommandQuery(
            [
              group.title,
              command.id,
              command.title,
              command.description,
              command.contextLabel,
              ...command.keywords,
              bindingText,
            ]
              .filter(Boolean)
              .join(" "),
          ),
        };
      }),
  })).filter((section) => section.items.length > 0);

  return [...contextualGroups, ...commandGroups];
}

export function SettingsShortcutSections({
  environment,
}: {
  environment: CommandEnvironment;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeCommandQuery(query);
  const catalog = useMemo(
    () => buildCatalog(environment),
    [environment],
  );
  const totalCount = catalog.reduce(
    (sum, section) => sum + section.items.length,
    0,
  );
  const visibleGroups = useMemo(
    () =>
      catalog
        .map((section) => ({
          ...section,
          items: normalizedQuery
            ? section.items.filter((item) => item.searchText.includes(normalizedQuery))
            : section.items,
        }))
        .filter((section) => section.items.length > 0),
    [catalog, normalizedQuery],
  );
  const visibleCount = visibleGroups.reduce(
    (sum, section) => sum + section.items.length,
    0,
  );
  const platformLabel = shortcutPlatformLabel(environment);

  return (
    <section
      className="shortcut-settings-shortcuts"
      aria-label={`همهٔ میان‌برهای ${platformLabel}`}
    >
      <div className="settings-shortcut-toolbar">
        <label className="settings-shortcut-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">جست‌وجوی میان‌برها</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="نام فرمان یا کلید؛ مثلاً ذخیره یا Ctrl+S"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              className="settings-shortcut-clear"
              aria-label="پاک‌کردن جست‌وجوی میان‌برها"
              onClick={() => setQuery("")}
            >
              <X size={17} aria-hidden="true" />
            </button>
          ) : null}
        </label>
        <p
          className="settings-shortcut-summary"
          role="status"
          aria-live="polite"
          data-visible-count={visibleCount}
          data-total-count={totalCount}
        >
          <strong>{visibleCount.toLocaleString("fa-IR")}</strong>
          {normalizedQuery ? ` از ${totalCount.toLocaleString("fa-IR")} میان‌بر` : " میان‌بر"}
          <span aria-hidden="true"> · </span>
          {platformLabel}
        </p>
      </div>

      {visibleGroups.map((section) => (
        <section
          key={section.id}
          className="settings-shortcut-section"
          aria-labelledby={`settings-shortcut-${section.id}`}
        >
          <header>
            <h3 id={`settings-shortcut-${section.id}`}>{section.title}</h3>
            <span>{section.items.length.toLocaleString("fa-IR")}</span>
          </header>
          <ul>
            {section.items.map((item) => (
              <li key={item.id} data-settings-shortcut-id={item.id}>
                <span className="settings-shortcut-copy">
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                  {item.context ? (
                    <small>زمینه: {item.context}</small>
                  ) : null}
                </span>
                <ShortcutKeycaps
                  bindings={item.bindings}
                  environment={environment}
                  separator={item.separator}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {visibleCount === 0 ? (
        <div className="settings-shortcut-empty" role="status">
          <strong>میان‌بری پیدا نشد</strong>
          <span>نام فرمان یا ترکیب کلید دیگری را امتحان کنید.</span>
          <button type="button" onClick={() => setQuery("")}>
            نمایش همهٔ میان‌برها
          </button>
        </div>
      ) : null}
    </section>
  );
}
