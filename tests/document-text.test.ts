import assert from "node:assert/strict";
import { test } from "node:test";
import { EditorState } from "@codemirror/state";
import { applyDocumentChanges, DocumentTextSnapshot } from "../app/workspace/document-text";

test("transaction model preserves multi-range edits and shares one serialization", () => {
  const before = "# فارسی 📝\n\nمتن نخست و پایان";
  const state = EditorState.create({ doc: before });
  const changes = [{ from: 2, to: 7, insert: "عنوان" }, { from: before.length, to: before.length, insert: "\nآخر" }];
  const transaction = state.update({ changes });
  let serializations = 0;
  const document = { length: transaction.state.doc.length, toString: () => { serializations++; return transaction.state.doc.toString(); }, sliceString: transaction.state.doc.sliceString.bind(transaction.state.doc), lineAt: (position: number) => transaction.state.doc.lineAt(position) };
  const old = new DocumentTextSnapshot(before);
  const next = old.edit({ document, previousLength: before.length, changes });
  assert.equal(serializations, 0);
  assert.equal(next.text, applyDocumentChanges(before, changes));
  assert.equal(next.text, transaction.state.doc.toString());
  assert.equal(serializations, 1);
  assert.equal(old.text, before);
  assert.equal(next.revision, 1);
  assert.throws(() => applyDocumentChanges(before, [{ from: 4, to: 2, insert: "" }]), /Invalid/);
});

test("line ending normalization invalidates incremental ranges instead of shifting offsets incorrectly", () => {
  const source = "الف\r\nب";
  const state = EditorState.create({ doc: source });
  const next = state.update({ changes: { from: 0, insert: "ت" } });
  const result = new DocumentTextSnapshot(source).edit({ previousLength: state.doc.length, document: next.state.doc, changes: [{ from: 0, to: 0, insert: "ت" }] });
  assert.equal(result.changes, null);
  assert.equal(result.text, next.state.doc.toString());
});
