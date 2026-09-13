import { StateEffect, StateField } from "@codemirror/state";

type TableSourceRange = { from: number; to: number };

// Presentation is an explicit editing intent, not a consequence of DOM focus.
// Each editor owns its state; changing tabs, theme or focused controls cannot
// turn a grid into source. Positions follow edits and cannot leak to a new file.
export const editTableSource = StateEffect.define<TableSourceRange | null>();
export const tableSourceEditing = StateField.define<TableSourceRange | null>({
  create: () => null,
  update(current, transaction) {
    let next = current;
    if (next && transaction.docChanged) {
      let replaced = false;
      transaction.changes.iterChanges((from, to) => {
        if (from <= current!.from && to >= current!.to) replaced = true;
      });
      next = replaced ? null : {
        from: transaction.changes.mapPos(next.from, -1),
        to: transaction.changes.mapPos(next.to, 1),
      };
    }
    for (const effect of transaction.effects) {
      if (effect.is(editTableSource)) return effect.value;
    }
    if (next && transaction.selection) {
      const { head } = transaction.state.selection.main;
      if (head < next.from || head > next.to) next = null;
    }
    return next;
  },
});
