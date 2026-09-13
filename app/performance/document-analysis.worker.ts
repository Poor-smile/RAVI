import { analyzeDocument } from "./document-analysis";
import { applyDocumentChanges, type DocumentChange } from "../workspace/document-text";

let content = "";
self.onmessage = (event: MessageEvent<{ id: number; content?: string; patches?: { previousLength: number; changes: DocumentChange[] }[] }>) => {
  const request = event.data;
  try {
    if (request.content !== undefined) content = request.content;
    else for (const patch of request.patches ?? []) {
      if (patch.previousLength !== content.length) throw new Error("Document revision mismatch");
      content = applyDocumentChanges(content, patch.changes);
    }
    self.postMessage({ id: request.id, result: analyzeDocument(content) });
  } catch { self.postMessage({ id: request.id, resync: true }); }
};
