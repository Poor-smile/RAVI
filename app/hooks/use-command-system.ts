"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import {
  CommandEnvironment,
  CommandId,
} from "../keyboard/command-registry";
import {
  CommandContext,
  editableKindFromTarget,
  resolveCommand,
} from "../keyboard/command-resolver";

type CommandHandlers = Partial<
  Record<CommandId, (event: KeyboardEvent) => void>
>;

export function useCommandSystem({
  environment,
  context,
  getHasEditorSelection,
  handlers,
  isCommandEnabled,
}: {
  environment: CommandEnvironment;
  context: Omit<CommandContext, "editableKind">;
  getHasEditorSelection?: () => boolean;
  handlers: CommandHandlers;
  isCommandEnabled?: (id: CommandId, event: KeyboardEvent) => boolean;
}) {
  const snapshotRef = useRef({
    environment,
    context,
    getHasEditorSelection,
    handlers,
    isCommandEnabled,
  });

  useLayoutEffect(() => {
    snapshotRef.current = {
      environment,
      context,
      getHasEditorSelection,
      handlers,
      isCommandEnabled,
    };
  }, [context, environment, getHasEditorSelection, handlers, isCommandEnabled]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!document.hasFocus()) return;
      const snapshot = snapshotRef.current;
      const editableKind = editableKindFromTarget(event.target);
      const resolved = resolveCommand(event, snapshot.environment, {
        ...snapshot.context,
        hasEditorSelection:
          editableKind === "editor"
            ? snapshot.getHasEditorSelection?.() ??
              snapshot.context.hasEditorSelection
            : false,
        editableKind,
      });
      if (!resolved) return;

      const handler = snapshot.handlers[resolved.command.id];
      if (!handler) return;
      if (
        snapshot.isCommandEnabled &&
        !snapshot.isCommandEnabled(resolved.command.id, event)
      ) {
        return;
      }
      event.preventDefault();
      handler(event);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
