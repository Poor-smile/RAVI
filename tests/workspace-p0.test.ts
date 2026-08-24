import assert from "node:assert/strict";
import test from "node:test";
import {
  documentTabId,
  parseDocumentSession,
  serializeDocumentSession,
} from "../app/workspace/document-session";
import {
  NOTE_TEMPLATES,
  resolveTemplateContent,
} from "../app/workspace/note-templates";

test("P0 Persian templates provide distinct safe Markdown starters", () => {
  assert.ok(NOTE_TEMPLATES.length >= 6);
  assert.equal(new Set(NOTE_TEMPLATES.map((template) => template.id)).size, NOTE_TEMPLATES.length);
  assert.ok(NOTE_TEMPLATES.some((template) => template.id === "brainstorming"));
  assert.ok(NOTE_TEMPLATES.some((template) => template.id === "financial-report"));
  const meeting = NOTE_TEMPLATES.find((template) => template.id === "meeting-notes");
  assert.ok(meeting);
  const content = resolveTemplateContent(meeting, new Date("2026-08-21T00:00:00Z"));
  assert.match(content, /^# یادداشت جلسه/u);
  assert.doesNotMatch(content, /\{\{date\}\}/u);
});

test("P0 document sessions round-trip and reject malformed snapshots", () => {
  const snapshot = { content: "# سلام" };
  const id = documentTabId({ path: "D:/Notes/سلام.md" });
  const raw = serializeDocumentSession(id, [
    {
      id,
      title: "سلام.md",
      path: "D:/Notes/سلام.md",
      draftId: "draft-1",
      dirty: true,
      pinned: false,
      snapshot,
    },
  ]);
  assert.deepEqual(
    parseDocumentSession(raw, (value): value is typeof snapshot =>
      Boolean(value && typeof value === "object" && "content" in value),
    ),
    {
      version: 2,
      activeTabId: id,
      tabs: [
        {
          id,
          title: "سلام.md",
          path: "D:/Notes/سلام.md",
          draftId: "draft-1",
          dirty: true,
          pinned: false,
          snapshot,
        },
      ],
      closedTabs: [],
    },
  );
  assert.deepEqual(
    parseDocumentSession(
      '{"version":1,"tabs":[{}]}',
      (value): value is Record<string, unknown> =>
        Boolean(value && typeof value === "object"),
    ),
    { version: 2, activeTabId: "", tabs: [], closedTabs: [] },
  );
});
