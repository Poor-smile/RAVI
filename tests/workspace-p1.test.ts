import assert from "node:assert/strict";
import test from "node:test";
import {
  orderDocumentTabs,
  parseDocumentSession,
  serializeDocumentSession,
  setDocumentTabPinned,
  type DocumentTabRecord,
} from "../app/workspace/document-session";

type Snapshot = { content: string };

const tab = (
  id: string,
  pinned = false,
): DocumentTabRecord<Snapshot> => ({
  id,
  title: `${id}.md`,
  path: `D:/Notes/${id}.md`,
  draftId: `draft-${id}`,
  dirty: false,
  pinned,
  snapshot: { content: `# ${id}` },
});

const isSnapshot = (value: unknown): value is Snapshot =>
  Boolean(value && typeof value === "object" && "content" in value);

test("P1 pinned tabs keep a stable leading group", () => {
  const ordered = orderDocumentTabs([tab("a"), tab("b", true), tab("c")]);
  assert.deepEqual(ordered.map((item) => item.id), ["b", "a", "c"]);
  const pinned = setDocumentTabPinned(ordered, "c", true);
  assert.deepEqual(pinned.map((item) => item.id), ["b", "c", "a"]);
  const unpinned = setDocumentTabPinned(pinned, "b", false);
  assert.deepEqual(unpinned.map((item) => item.id), ["c", "b", "a"]);
});

test("P1 session v2 persists pinned and recently closed tabs", () => {
  const openTabs = [tab("plan", true), tab("meeting")];
  const closedTabs = [tab("research")];
  const parsed = parseDocumentSession(
    serializeDocumentSession("meeting", openTabs, closedTabs),
    isSnapshot,
  );
  assert.deepEqual(parsed, {
    version: 2,
    activeTabId: "meeting",
    tabs: openTabs,
    closedTabs,
  });
});

test("P1 migrates a valid v1 session with safe defaults", () => {
  const legacy = JSON.stringify({
    version: 1,
    activeTabId: "legacy",
    tabs: [
      {
        id: "legacy",
        title: "قدیمی.md",
        path: "D:/Notes/قدیمی.md",
        draftId: "draft-legacy",
        dirty: false,
        snapshot: { content: "# قدیمی" },
      },
    ],
  });
  const parsed = parseDocumentSession(legacy, isSnapshot);
  assert.equal(parsed?.version, 2);
  assert.equal(parsed?.tabs[0].pinned, false);
  assert.deepEqual(parsed?.closedTabs, []);
});
