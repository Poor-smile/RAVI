"use client";

import { Keyboard, Settings2, X } from "@/app/icons/material-symbols";
import { type RefObject, useMemo, useRef } from "react";
import {
  activeBindings,
  COMMAND_GROUPS,
  COMMAND_REGISTRY,
  CommandEnvironment,
} from "../keyboard/command-registry";
import { shortcutPlatformLabel } from "../keyboard/shortcut-guide";
import { AccessibleModal } from "./accessible-modal";
import { CommandShortcutKeys } from "./command-tooltip";
import { ShortcutGuideSections } from "./shortcut-guide-sections";

export function ShortcutHelpDialog({
  open,
  isTopLayer,
  environment,
  onClose,
  onOpenSettings,
  returnFocusRef,
}: {
  open: boolean;
  isTopLayer: boolean;
  environment: CommandEnvironment;
  onClose: () => void;
  onOpenSettings: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const groupedCommands = useMemo(
    () =>
      COMMAND_GROUPS.map((group) => ({
        ...group,
        commands: COMMAND_REGISTRY.flatMap((command) => {
          if (!command.showInHelp || command.group !== group.id) return [];
          const bindings = activeBindings(command, environment);
          return bindings.length ? [{ ...command, active: bindings }] : [];
        }),
      })).filter((group) => group.commands.length),
    [environment],
  );

  return (
    <AccessibleModal
      open={open}
      isTopLayer={isTopLayer}
      onClose={onClose}
      dialogRef={dialogRef}
      initialFocusRef={titleRef}
      returnFocusRef={returnFocusRef}
      backdropClassName="shortcut-modal-backdrop"
      dialogClassName="shortcut-modal"
      labelledBy="shortcut-modal-title"
      describedBy="shortcut-modal-description"
    >
      <header className="shortcut-modal-header">
        <span className="shortcut-modal-mark" aria-hidden="true">
          <Keyboard size={23} />
        </span>
        <div>
          <span>فرمان‌های سریع راوی</span>
          <h2 id="shortcut-modal-title" ref={titleRef} tabIndex={-1}>
            میان‌برهای صفحه‌کلید
          </h2>
        </div>
        <button type="button" onClick={onClose} aria-label="بستن راهنمای میان‌برها">
          <X size={19} aria-hidden="true" />
        </button>
      </header>

      <p id="shortcut-modal-description" className="shortcut-modal-intro">
        کلیدهای مناسب <strong>{shortcutPlatformLabel(environment)}</strong> نمایش
        داده شده‌اند. میان‌برها با جای کلید فیزیکی کار می‌کنند؛ بنابراین با
        صفحه‌کلید فارسی و انگلیسی یکسان هستند.
      </p>

      <div className="shortcut-modal-guide">
        <div className="shortcut-modal-guide-heading">
          <div>
            <span>رفتارهای ویرایشگر</span>
            <h3>Enter با Ctrl/Cmd+Enter یکی نیست</h3>
          </div>
          <p>
            Enter نوشتن را در ساختار فعلی ادامه می‌دهد؛ Ctrl/Cmd+Enter از کل
            بلاک خارج می‌شود و یک Text Block مستقل می‌سازد.
          </p>
        </div>
        <ShortcutGuideSections environment={environment} />
      </div>

      <div className="shortcut-groups">
        {groupedCommands.map((group) => (
          <section key={group.id} className="shortcut-group">
            <h3>{group.title}</h3>
            <ul>
              {group.commands.map((command) => (
                <li key={command.id}>
                  <span className="shortcut-command-copy">
                    <strong>{command.title}</strong>
                    {command.contextLabel && (
                      <small>{command.contextLabel}</small>
                    )}
                  </span>
                  <span className="shortcut-binding-options">
                    {command.active.map((binding, index) => (
                      <span key={`${command.id}-${binding.code}-${index}`}>
                        {index > 0 && <small>یا</small>}
                        <CommandShortcutKeys
                          binding={binding}
                          environment={environment}
                        />
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="shortcut-modal-footer">
        <span>برای بستن بالاترین لایه، کلید Esc را بزنید.</span>
        <div>
          <button className="button--quiet" type="button" onClick={onOpenSettings}>
            <Settings2 size={17} aria-hidden="true" />
            تنظیمات میان‌برها
          </button>
          <button type="button" onClick={onClose}>
            متوجه شدم
          </button>
        </div>
      </footer>
    </AccessibleModal>
  );
}
