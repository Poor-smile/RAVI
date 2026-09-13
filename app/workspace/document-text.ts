export type DocumentChange = { from: number; to: number; insert: string };
export type EditorDocumentText = {
  readonly length: number;
  toString(): string;
  sliceString(from: number, to?: number): string;
  lineAt(position: number): { from: number; to: number; text: string };
};
export type DocumentEdit = {
  document: EditorDocumentText;
  previousLength: number;
  changes: readonly DocumentChange[];
};

export function applyDocumentChanges(source: string, changes: readonly DocumentChange[]) {
  const parts: string[] = [];
  let end = 0;
  for (const change of changes) {
    if (!Number.isInteger(change.from) || !Number.isInteger(change.to) || change.from < end || change.to < change.from || change.to > source.length) throw new Error("Invalid document change range");
    parts.push(source.slice(end, change.from), change.insert);
    end = change.to;
  }
  parts.push(source.slice(end));
  return parts.join("");
}

// Immutable editor text is the source of truth for a transaction. Consumers
// needing a string share one lazy serialization; transactions carry only edits.
export class DocumentTextSnapshot {
  private serialized: string | undefined;
  readonly document: EditorDocumentText | undefined;
  readonly length: number;
  constructor(source: string | EditorDocumentText, readonly revision = 0, readonly changes: readonly DocumentChange[] | null = null, readonly previousLength?: number) {
    if (typeof source === "string") this.serialized = source;
    else this.document = source;
    this.length = source.length;
  }
  get text() { return this.serialized ??= this.document!.toString(); }
  edit(edit: DocumentEdit) {
    return new DocumentTextSnapshot(edit.document, this.revision + 1, edit.previousLength === this.length ? edit.changes : null, this.length);
  }
}
