"use client";

import type { CommandEnvironment } from "../keyboard/command-registry";
import {
  SHORTCUT_GUIDE_SECTIONS,
  type ShortcutGuideSection,
} from "../keyboard/shortcut-guide";
import { CommandShortcutKeys } from "./command-tooltip";

export function ShortcutGuideSections({
  environment,
  sections = SHORTCUT_GUIDE_SECTIONS,
  className = "shortcut-guide-sections",
}: {
  environment: CommandEnvironment;
  sections?: ShortcutGuideSection[];
  className?: string;
}) {
  return (
    <div className={className}>
      {sections.map((section) => (
        <section key={section.id} className="shortcut-guide-section">
          <h3>{section.title}</h3>
          <ul>
            {section.items.map((item) => (
              <li key={item.id} data-shortcut-guide-id={item.id}>
                <span className="shortcut-guide-copy">
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                  {item.context && <small>{item.context}</small>}
                </span>
                <span className="shortcut-binding-options">
                  {item.keys.map((shortcut, index) => (
                    <span key={`${item.id}-${shortcut.binding.code}-${index}`}>
                      {index > 0 && <small>یا</small>}
                      {shortcut.label ? (
                        <span className="shortcut-keys" dir="ltr" aria-hidden="true">
                          <kbd>{shortcut.label}</kbd>
                        </span>
                      ) : (
                        <CommandShortcutKeys
                          binding={shortcut.binding}
                          environment={environment}
                        />
                      )}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
