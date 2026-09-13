import assert from "node:assert/strict";
import test from "node:test";
import { EditorState } from "@codemirror/state";
import { editTableSource, tableSourceEditing } from "../app/editor/table-presentation";

const doc = "مقدمه\n\n| الف | ب |\n| --- | --- |\n| ۱ | ۲ |\n\nپایان";
const range = { from: doc.indexOf("|"), to: doc.lastIndexOf("|") + 1 };
const create = () => EditorState.create({ doc, extensions: tableSourceEditing });

test("a caret inside a table does not request Markdown source", () => {
  const state = create().update({ selection: { anchor: range.from + 2 } }).state;
  assert.equal(state.field(tableSourceEditing), null);
});
test("explicit source mode survives unrelated updates and edits, then closes on caret exit", () => {
  let state = create().update({ effects: editTableSource.of(range), selection: { anchor: range.from + 2 } }).state;
  state = state.update({}).state;
  assert.deepEqual(state.field(tableSourceEditing), range);
  state = state.update({ changes: { from: 0, insert: "متن\n" } }).state;
  assert.deepEqual(state.field(tableSourceEditing), { from: range.from + 4, to: range.to + 4 });
  state = state.update({ selection: { anchor: state.doc.length } }).state;
  assert.equal(state.field(tableSourceEditing), null);
});
test("source intent belongs to one editor and is cleared by document replacement", () => {
  const state = create().update({ effects: editTableSource.of(range) }).state;
  assert.equal(create().field(tableSourceEditing), null);
  assert.equal(state.update({ changes: { from: 0, to: doc.length, insert: doc } }).state.field(tableSourceEditing), null);
  assert.equal(state.update({ effects: editTableSource.of(null) }).state.field(tableSourceEditing), null);
});
