import {
  activeBindings,
  COMMAND_REGISTRY,
  CommandDefinition,
  CommandEnvironment,
  CommandId,
  EditableKind,
  KeyBinding,
} from "./command-registry";

export type KeyboardEventLike = {
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
};

export type CommandContext = {
  editableKind: EditableKind | null;
  enabledCommandIds: ReadonlySet<CommandId>;
  hasEditorSelection?: boolean;
};

export type ResolvedCommand = {
  command: CommandDefinition;
  binding: KeyBinding;
};

function expectedModifiers(
  binding: KeyBinding,
  environment: CommandEnvironment,
) {
  return {
    ctrl:
      Boolean(binding.ctrl) ||
      (Boolean(binding.primary) && environment.platform !== "mac"),
    meta:
      Boolean(binding.meta) ||
      (Boolean(binding.primary) && environment.platform === "mac"),
    alt: Boolean(binding.alt),
    shift: Boolean(binding.shift),
  };
}

export function bindingMatches(
  event: KeyboardEventLike,
  binding: KeyBinding,
  environment: CommandEnvironment,
) {
  const expected = expectedModifiers(binding, environment);
  return (
    event.code === binding.code &&
    event.ctrlKey === expected.ctrl &&
    event.metaKey === expected.meta &&
    event.altKey === expected.alt &&
    event.shiftKey === expected.shift
  );
}

function editableAllows(
  command: CommandDefinition,
  editableKind: EditableKind | null,
) {
  if (!editableKind) return true;
  if (command.allowInEditable === true) return true;
  if (command.allowInEditable === false) return false;
  return command.allowInEditable.includes(editableKind);
}

function selectionAllows(binding: KeyBinding, context: CommandContext) {
  if (!binding.selection) return true;
  return binding.selection === "required"
    ? Boolean(context.hasEditorSelection)
    : !context.hasEditorSelection;
}

export function resolveCommand(
  event: KeyboardEventLike,
  environment: CommandEnvironment,
  context: CommandContext,
): ResolvedCommand | null {
  if (event.defaultPrevented || event.isComposing) return null;

  for (const command of COMMAND_REGISTRY) {
    if (!context.enabledCommandIds.has(command.id)) continue;
    if (event.repeat && !command.repeatable) continue;
    if (!editableAllows(command, context.editableKind)) continue;

    const binding = activeBindings(command, environment).find(
      (candidate) =>
        selectionAllows(candidate, context) &&
        bindingMatches(event, candidate, environment),
    );
    if (binding) return { command, binding };
  }

  return null;
}

export function editableKindFromTarget(
  target: EventTarget | null,
): EditableKind | null {
  if (!(target instanceof Element)) return null;
  const declared = target.closest<HTMLElement>("[data-editable-kind]")?.dataset
    .editableKind as EditableKind | undefined;
  if (declared) return declared;

  const editable = target.closest<HTMLElement>(
    'input, textarea, select, [contenteditable="true"]',
  );
  return editable ? "generic" : null;
}

export function registryConflicts(environment: CommandEnvironment) {
  const seen = new Map<
    string,
    Array<{ id: CommandId; selection: KeyBinding["selection"] }>
  >();
  const conflicts: Array<{ binding: string; commands: [CommandId, CommandId] }> =
    [];

  for (const command of COMMAND_REGISTRY) {
    for (const binding of activeBindings(command, environment)) {
      const expected = expectedModifiers(binding, environment);
      const signature = [
        binding.code,
        expected.ctrl,
        expected.meta,
        expected.alt,
        expected.shift,
      ].join(":");
      const entries = seen.get(signature) ?? [];
      const existing = entries.find(
        (entry) =>
          entry.id !== command.id &&
          (!entry.selection ||
            !binding.selection ||
            entry.selection === binding.selection),
      );
      if (existing) {
        conflicts.push({
          binding: signature,
          commands: [existing.id, command.id],
        });
      }
      entries.push({ id: command.id, selection: binding.selection });
      seen.set(signature, entries);
    }
  }

  return conflicts;
}
