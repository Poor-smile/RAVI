import {
  activeBindings,
  ariaShortcut,
  bindingParts,
  commandById,
  CommandEnvironment,
  CommandId,
  formatBinding,
  KeyBinding,
} from "../keyboard/command-registry";

export function primaryBinding(
  id: CommandId,
  environment: CommandEnvironment,
) {
  return activeBindings(commandById(id), environment)[0] ?? null;
}

export function commandTitle(
  id: CommandId,
  environment: CommandEnvironment,
  fallback?: string,
) {
  const command = commandById(id);
  const binding = primaryBinding(id, environment);
  const title = fallback ?? command.title;
  return binding
    ? `${title} — ${formatBinding(binding, environment.platform)}`
    : title;
}

export function commandAriaKeyShortcuts(
  id: CommandId,
  environment: CommandEnvironment,
) {
  const value = activeBindings(commandById(id), environment)
    .map((binding) => ariaShortcut(binding, environment.platform))
    .join(" ");
  return value || undefined;
}

export function commandShortcutLabel(
  id: CommandId,
  environment: CommandEnvironment,
) {
  const binding = primaryBinding(id, environment);
  return binding ? formatBinding(binding, environment.platform) : "";
}

export function CommandShortcutKeys({
  binding,
  environment,
}: {
  binding: KeyBinding;
  environment: CommandEnvironment;
}) {
  return (
    <span className="shortcut-keys" dir="ltr" aria-hidden="true">
      {bindingParts(binding, environment.platform).map((part) => (
        <kbd key={part}>{part}</kbd>
      ))}
    </span>
  );
}
