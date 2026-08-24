export type SearchScope = "all" | "name" | "content" | "folder";
export type SearchSort = "relevance" | "name" | "modified";

export type LocalSearchSource = {
  key: string;
  name: string;
  path: string;
  relativePath: string;
  rootId: string;
  lastModified: number;
  size: number;
  readText: () => Promise<string>;
};

export type LocalSearchProgress = {
  indexed: number;
  total: number;
  errors: number;
};

export type LocalSearchResult = {
  key: string;
  name: string;
  path: string;
  relativePath: string;
  rootId: string;
  lastModified: number;
  score: number;
  line: number | null;
  offset: number | null;
  snippet: string;
  matchStart: number;
  matchEnd: number;
  matchedIn: "name" | "content";
};

type IndexedRecord = LocalSearchSource & {
  normalizedName: string;
  normalizedPath: string;
  content: string | null;
  normalizedContent: string | null;
  error: boolean;
};

const YIELD_EVERY = 24;

function abortError() {
  return new DOMException("Search cancelled", "AbortError");
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

async function yieldToMainThread(signal?: AbortSignal) {
  assertNotAborted(signal);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assertNotAborted(signal);
}

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\u064a/gu, "ی")
    .replace(/\u0649/gu, "ی")
    .replace(/\u0643/gu, "ک")
    .toLocaleLowerCase("fa");
}

function fuzzyScore(candidate: string, query: string) {
  if (!query) return 0;
  const directIndex = candidate.indexOf(query);
  if (directIndex >= 0) {
    return 420 - directIndex * 2 - Math.max(0, candidate.length - query.length) * 0.2;
  }

  let queryIndex = 0;
  let firstMatch = -1;
  let previousMatch = -2;
  let score = 0;
  for (let index = 0; index < candidate.length && queryIndex < query.length; index += 1) {
    if (candidate[index] !== query[queryIndex]) continue;
    if (firstMatch < 0) firstMatch = index;
    score += previousMatch === index - 1 ? 18 : 7;
    previousMatch = index;
    queryIndex += 1;
  }
  if (queryIndex !== query.length) return Number.NEGATIVE_INFINITY;
  return score - firstMatch * 1.5 - (candidate.length - query.length) * 0.25;
}

function contentMatch(record: IndexedRecord, query: string) {
  const normalizedContent = record.normalizedContent;
  const content = record.content;
  if (!normalizedContent || content === null) return null;
  const offset = normalizedContent.indexOf(query);
  if (offset < 0) return null;

  const line = normalizedContent.slice(0, offset).split("\n").length;
  const lineStart = content.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const lineEndCandidate = content.indexOf("\n", offset + query.length);
  const lineEnd = lineEndCandidate < 0 ? content.length : lineEndCandidate;
  const sourceLine = content.slice(lineStart, lineEnd);
  const leadingWhitespace = sourceLine.length - sourceLine.trimStart().length;
  const rawLine = sourceLine.trim();
  const matchInLine = Math.max(0, offset - lineStart - leadingWhitespace);
  const windowStart = Math.max(0, matchInLine - 54);
  const windowEnd = Math.min(rawLine.length, matchInLine + query.length + 82);
  const prefix = windowStart > 0 ? "…" : "";
  const suffix = windowEnd < rawLine.length ? "…" : "";
  const snippet = `${prefix}${rawLine.slice(windowStart, windowEnd)}${suffix}`;
  const start = prefix.length + Math.max(0, matchInLine - windowStart);
  return {
    offset,
    line,
    snippet,
    matchStart: start,
    matchEnd: Math.min(snippet.length, start + query.length),
  };
}

export class LocalSearchIndex {
  private records = new Map<string, IndexedRecord>();

  updateSources(sources: LocalSearchSource[]) {
    const nextKeys = new Set(sources.map((source) => source.key));
    for (const key of this.records.keys()) {
      if (!nextKeys.has(key)) this.records.delete(key);
    }
    for (const source of sources) {
      const existing = this.records.get(source.key);
      const unchanged =
        existing &&
        existing.lastModified === source.lastModified &&
        existing.size === source.size;
      this.records.set(source.key, {
        ...source,
        normalizedName: normalizeSearchText(source.name),
        normalizedPath: normalizeSearchText(source.path),
        content: unchanged && !existing.error ? existing.content : null,
        normalizedContent:
          unchanged && !existing.error ? existing.normalizedContent : null,
        error: false,
      });
    }
  }

  async indexAll(
    options: {
      signal?: AbortSignal;
      onProgress?: (progress: LocalSearchProgress) => void;
    } = {},
  ) {
    const records = [...this.records.values()];
    let indexed = records.filter((record) => record.content !== null || record.error).length;
    let errors = records.filter((record) => record.error).length;
    options.onProgress?.({ indexed, total: records.length, errors });

    const pending = records.filter(
      (record) => record.content === null && !record.error,
    );
    for (let offset = 0; offset < pending.length; offset += YIELD_EVERY) {
      assertNotAborted(options.signal);
      const batch = pending.slice(offset, offset + YIELD_EVERY);
      await Promise.all(
        batch.map(async (record) => {
          try {
            const content = await record.readText();
            assertNotAborted(options.signal);
            const current = this.records.get(record.key);
            if (
              current &&
              current.lastModified === record.lastModified &&
              current.size === record.size
            ) {
              current.content = content;
              current.normalizedContent = normalizeSearchText(content);
            }
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") throw error;
            const current = this.records.get(record.key);
            if (current) current.error = true;
            errors += 1;
          }
          indexed += 1;
          options.onProgress?.({ indexed, total: records.length, errors });
        }),
      );
      await yieldToMainThread(options.signal);
    }
    return { indexed, total: records.length, errors } satisfies LocalSearchProgress;
  }

  async search(
    rawQuery: string,
    options: {
      scope: SearchScope;
      sort: SearchSort;
      currentFolder?: { rootId: string; relativePath: string } | null;
      signal?: AbortSignal;
      limit?: number;
    },
  ): Promise<LocalSearchResult[]> {
    const query = normalizeSearchText(rawQuery.trim());
    if (!query) return [];
    const results: LocalSearchResult[] = [];
    const records = [...this.records.values()];
    const folderPath = options.currentFolder?.relativePath.replace(/[^/]+$/u, "") ?? "";

    for (let index = 0; index < records.length; index += 1) {
      assertNotAborted(options.signal);
      const record = records[index];
      if (
        options.scope === "folder" &&
        options.currentFolder &&
        (record.rootId !== options.currentFolder.rootId ||
          !record.relativePath.startsWith(folderPath))
      ) {
        continue;
      }

      const nameScore = Math.max(
        fuzzyScore(record.normalizedName, query),
        fuzzyScore(record.normalizedPath, query) - 35,
      );
      const content = contentMatch(record, query);
      const includeName = options.scope !== "content" && Number.isFinite(nameScore);
      const includeContent = options.scope !== "name" && Boolean(content);
      if (!includeName && !includeContent) continue;

      const useName = includeName && (!content || nameScore >= 245);
      const directPathMatch = record.normalizedPath.indexOf(query);
      results.push({
        key: record.key,
        name: record.name,
        path: record.path,
        relativePath: record.relativePath,
        rootId: record.rootId,
        lastModified: record.lastModified,
        score: useName ? nameScore + 220 : 180 - (content?.offset ?? 0) / 900,
        line: useName ? null : content!.line,
        offset: useName ? null : content!.offset,
        snippet: useName ? record.path : content!.snippet,
        matchStart: useName
          ? directPathMatch >= 0
            ? directPathMatch
            : 0
          : content!.matchStart,
        matchEnd:
          useName && directPathMatch >= 0
            ? directPathMatch + query.length
            : useName
              ? 0
              : content!.matchEnd,
        matchedIn: useName ? "name" : "content",
      });

      if (index > 0 && index % 80 === 0) await yieldToMainThread(options.signal);
    }

    results.sort((first, second) => {
      if (options.sort === "name") return first.name.localeCompare(second.name, "fa");
      if (options.sort === "modified") return second.lastModified - first.lastModified;
      return second.score - first.score || first.name.localeCompare(second.name, "fa");
    });
    return results.slice(0, options.limit ?? 160);
  }

  snapshot() {
    return [...this.records.values()].map((record) => ({
      key: record.key,
      name: record.name,
      path: record.path,
      relativePath: record.relativePath,
      rootId: record.rootId,
      lastModified: record.lastModified,
      indexed: record.content !== null,
      error: record.error,
    }));
  }
}

export type QuickOpenCandidate = {
  key: string;
  name: string;
  path: string;
  lastModified: number;
  openedAt?: number;
  openCount?: number;
  pinned?: boolean;
};

export function rankQuickOpenCandidates<T extends QuickOpenCandidate>(
  candidates: T[],
  rawQuery: string,
  now = Date.now(),
) {
  const query = normalizeSearchText(rawQuery.trim());
  const ranked: Array<T & { score: number }> = [];
  for (const candidate of candidates) {
      const name = normalizeSearchText(candidate.name);
      const path = normalizeSearchText(candidate.path);
      const match = query
        ? Math.max(fuzzyScore(name, query), fuzzyScore(path, query) - 34)
        : 0;
      if (query && !Number.isFinite(match)) continue;
      const ageHours = candidate.openedAt
        ? Math.max(0, now - candidate.openedAt) / 3_600_000
        : Number.POSITIVE_INFINITY;
      const recency = Number.isFinite(ageHours) ? Math.max(0, 120 - ageHours * 1.4) : 0;
      const frequency = Math.min(100, Math.log2((candidate.openCount ?? 0) + 1) * 22);
      ranked.push({
        ...candidate,
        score: match + recency + frequency + (candidate.pinned ? 28 : 0),
      });
  }
  return ranked.sort(
    (first, second) =>
      second.score - first.score || first.name.localeCompare(second.name, "fa"),
  );
}
