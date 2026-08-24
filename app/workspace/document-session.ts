export const DOCUMENT_SESSION_STORAGE_KEY = "raavi:document-session:v2";
export const LEGACY_DOCUMENT_SESSION_STORAGE_KEY = "raavi:document-session:v1";

export type DocumentTabRecord<Snapshot = unknown> = {
  id: string;
  title: string;
  path: string;
  draftId: string;
  dirty: boolean;
  pinned: boolean;
  snapshot: Snapshot;
};

export type PersistedDocumentSession<Snapshot = unknown> = {
  version: 2;
  activeTabId: string;
  tabs: DocumentTabRecord<Snapshot>[];
  closedTabs: DocumentTabRecord<Snapshot>[];
};

const MAX_OPEN_TABS = 20;
const MAX_CLOSED_TABS = 10;

export function documentTabId(input: { path?: string; draftId?: string }) {
  const path = input.path?.normalize("NFC").trim();
  if (path) return `path:${path.toLocaleLowerCase("en-US")}`;
  const draftId = input.draftId?.normalize("NFC").trim();
  return `draft:${draftId || crypto.randomUUID()}`;
}

export function orderDocumentTabs<Snapshot>(
  tabs: readonly DocumentTabRecord<Snapshot>[],
) {
  return [
    ...tabs.filter((tab) => tab.pinned),
    ...tabs.filter((tab) => !tab.pinned),
  ].slice(0, MAX_OPEN_TABS);
}

export function setDocumentTabPinned<Snapshot>(
  tabs: readonly DocumentTabRecord<Snapshot>[],
  tabId: string,
  pinned: boolean,
) {
  return orderDocumentTabs(
    tabs.map((tab) => (tab.id === tabId ? { ...tab, pinned } : tab)),
  );
}

function parseTab<Snapshot>(
  candidate: unknown,
  isSnapshot: (value: unknown) => value is Snapshot,
): DocumentTabRecord<Snapshot> | null {
  if (!candidate || typeof candidate !== "object") return null;
  const tab = candidate as Record<string, unknown>;
  if (
    typeof tab.id !== "string" ||
    typeof tab.title !== "string" ||
    typeof tab.path !== "string" ||
    typeof tab.draftId !== "string" ||
    typeof tab.dirty !== "boolean" ||
    !isSnapshot(tab.snapshot)
  ) {
    return null;
  }
  return {
    id: tab.id,
    title: tab.title,
    path: tab.path,
    draftId: tab.draftId,
    dirty: tab.dirty,
    pinned: typeof tab.pinned === "boolean" ? tab.pinned : false,
    snapshot: tab.snapshot,
  };
}

export function parseDocumentSession<Snapshot>(
  raw: string | null,
  isSnapshot: (value: unknown) => value is Snapshot,
): PersistedDocumentSession<Snapshot> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if ((value.version !== 1 && value.version !== 2) || !Array.isArray(value.tabs)) {
      return null;
    }
    const tabs = orderDocumentTabs(
      value.tabs.flatMap((candidate) => {
        const tab = parseTab(candidate, isSnapshot);
        return tab ? [tab] : [];
      }),
    );
    const closedTabs = (
      value.version === 2 && Array.isArray(value.closedTabs)
        ? value.closedTabs
        : []
    )
      .flatMap((candidate) => {
        const tab = parseTab(candidate, isSnapshot);
        return tab ? [{ ...tab, dirty: false }] : [];
      })
      .slice(0, MAX_CLOSED_TABS);
    if (!tabs.length) {
      return { version: 2, activeTabId: "", tabs: [], closedTabs };
    }
    const activeTabId =
      typeof value.activeTabId === "string" &&
      tabs.some((tab) => tab.id === value.activeTabId)
        ? value.activeTabId
        : tabs[0].id;
    return { version: 2, activeTabId, tabs, closedTabs };
  } catch {
    return null;
  }
}

export function serializeDocumentSession<Snapshot>(
  activeTabId: string,
  tabs: readonly DocumentTabRecord<Snapshot>[],
  closedTabs: readonly DocumentTabRecord<Snapshot>[] = [],
) {
  return JSON.stringify({
    version: 2,
    activeTabId,
    tabs: orderDocumentTabs(tabs),
    closedTabs: closedTabs.slice(0, MAX_CLOSED_TABS),
  } satisfies PersistedDocumentSession<Snapshot>);
}
