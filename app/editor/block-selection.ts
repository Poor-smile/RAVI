import {
  StateEffect,
  StateField,
  type EditorState,
  type Transaction,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  type DecorationSet,
} from "@codemirror/view";

export type StructuralBlockSelection = {
  from: number;
  to: number;
  returnAnchor: number;
  returnHead: number;
};

type BlockSelectionFieldValue = {
  selection: StructuralBlockSelection | null;
  decorations: DecorationSet;
};

export const setStructuralBlockSelection =
  StateEffect.define<StructuralBlockSelection>();
export const clearStructuralBlockSelection = StateEffect.define<null>();

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, maximum));
}

function selectedBlockDecorations(
  state: EditorState,
  selection: StructuralBlockSelection | null,
) {
  if (!selection) return Decoration.none;
  const safeFrom = clamp(selection.from, 0, state.doc.length);
  const safeTo = clamp(selection.to, safeFrom, state.doc.length);
  const firstLine = state.doc.lineAt(safeFrom).number;
  const lastLine = state.doc.lineAt(Math.max(safeFrom, safeTo - 1)).number;
  const decorations = [];

  for (let number = firstLine; number <= lastLine; number += 1) {
    const classes = ["cm-structural-block-selected"];
    if (number === firstLine) classes.push("is-block-selection-first");
    if (number === lastLine) classes.push("is-block-selection-last");
    decorations.push(
      Decoration.line({
        attributes: {
          class: classes.join(" "),
          "data-block-selected": "true",
          "aria-selected": "true",
        },
      }).range(state.doc.line(number).from),
    );
  }
  return Decoration.set(decorations, true);
}

function mappedSelection(
  selection: StructuralBlockSelection,
  transaction: Transaction,
): StructuralBlockSelection {
  const from = transaction.changes.mapPos(selection.from, 1);
  const to = transaction.changes.mapPos(selection.to, -1);
  const returnAnchor = transaction.changes.mapPos(selection.returnAnchor, 1);
  const returnHead = transaction.changes.mapPos(selection.returnHead, -1);
  return {
    from: Math.min(from, to),
    to: Math.max(from, to),
    returnAnchor,
    returnHead,
  };
}

export const structuralBlockSelectionField =
  StateField.define<BlockSelectionFieldValue>({
    create(state) {
      return { selection: null, decorations: selectedBlockDecorations(state, null) };
    },
    update(value, transaction) {
      let selection = value.selection && transaction.docChanged
        ? mappedSelection(value.selection, transaction)
        : value.selection;
      let hasExplicitBlockSelectionEffect = false;
      for (const effect of transaction.effects) {
        if (effect.is(setStructuralBlockSelection)) {
          selection = effect.value;
          hasExplicitBlockSelectionEffect = true;
        }
        if (effect.is(clearStructuralBlockSelection)) {
          selection = null;
          hasExplicitBlockSelectionEffect = true;
        }
      }
      // Text editing, native selection and rich-widget activation leave Block
      // Selection Mode unless the transaction explicitly owns that state.
      if (!hasExplicitBlockSelectionEffect && transaction.selection) {
        selection = null;
      }
      return {
        selection,
        decorations: selectedBlockDecorations(transaction.state, selection),
      };
    },
    provide: (field) =>
      EditorView.decorations.from(field, (value) => value.decorations),
  });

export function structuralBlockSelection(state: EditorState) {
  return state.field(structuralBlockSelectionField, false)?.selection ?? null;
}

export function transactionChangesStructuralBlockSelection(
  transaction: Transaction,
) {
  return transaction.effects.some(
    (effect) =>
      effect.is(setStructuralBlockSelection) ||
      effect.is(clearStructuralBlockSelection),
  );
}
