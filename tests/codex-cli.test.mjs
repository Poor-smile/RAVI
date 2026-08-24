import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCodexPrompt,
  buildPersianReviewPrompt,
  getCodexConnectionStatus,
  resolveCodexCommand,
} from "../desktop/codex-cli.mjs";

test("Codex prompt isolates the frozen context from the user request", () => {
  const prompt = buildCodexPrompt({
    context: "فرمول: x + = 2",
    prompt: "فرمول را اصلاح کن",
  });
  assert.match(prompt, /<frozen_context>\nفرمول: x \+ = 2\n<\/frozen_context>/);
  assert.match(prompt, /<user_request>\nفرمول را اصلاح کن\n<\/user_request>/);
  assert.match(prompt, /replacement/);
});

test("Persian review prompt requires exact quotes and protects technical text", () => {
  const prompt = buildPersianReviewPrompt({
    document: "فایل `app/page.tsx` را ببینید.",
    economy: true,
  });
  assert.match(prompt, /<frozen_markdown_document>/);
  assert.match(prompt, /current must be an exact contiguous quote/);
  assert.match(prompt, /Never alter fenced code, inline code, URLs, file paths/);
  assert.match(prompt, /at most 20 high-value suggestions/);
});

test("installed Codex CLI exposes a connection state", async () => {
  const command = await resolveCodexCommand();
  if (!command) return;
  const status = await getCodexConnectionStatus();
  assert.ok(["connected", "auth_required", "connection_error"].includes(status.state));
});
