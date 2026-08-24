import assert from "node:assert/strict";
import test from "node:test";
import {
  readSmartAnnotationSession,
  runDocumentScopedSmartAnnotationRequest,
  updateSmartAnnotationSession,
} from "../app/ai/smart-annotation-session";

test("document-scoped review keeps running while another tab becomes active", async () => {
  const reviewKey = `document-${Date.now()}`;
  let resolveReview: ((value: string) => void) | undefined;
  const request = runDocumentScopedSmartAnnotationRequest(
    reviewKey,
    () => new Promise<string>((resolve) => { resolveReview = resolve; }),
  );

  updateSmartAnnotationSession(reviewKey, (current) => ({
    ...current,
    phase: "checking",
    sourceSnapshot: "سند اول",
  }));

  // Reading another document session simulates switching tabs. It must not
  // replace or cancel the in-flight request that belongs to the first document.
  assert.equal(readSmartAnnotationSession("document-other").phase, "idle");
  assert.equal(readSmartAnnotationSession(reviewKey).phase, "checking");

  const duplicate = runDocumentScopedSmartAnnotationRequest(reviewKey, async () => "duplicate");
  assert.equal(duplicate, request);
  resolveReview?.("complete");
  assert.equal(await request, "complete");
});
