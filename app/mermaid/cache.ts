import type { MermaidComplexity } from "./complexity";

export type MermaidCacheEntry = {
  key: string;
  svg: string;
  byteSize: number;
  lastAccess: number;
  complexity: MermaidComplexity;
};

export type MermaidCacheStats = {
  hits: number;
  misses: number;
  evictions: number;
  entries: number;
  totalBytes: number;
  maxBytes: number;
  pinned: number;
};

export const DEFAULT_MERMAID_CACHE_BYTES = 28 * 1024 * 1024;

export class MermaidMemoryCache {
  readonly maxBytes: number;
  private entries = new Map<string, MermaidCacheEntry>();
  private pins = new Map<string, number>();
  private totalBytes = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(maxBytes = DEFAULT_MERMAID_CACHE_BYTES) {
    this.maxBytes = maxBytes;
  }

  get(key: string) {
    const entry = this.entries.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    this.hits += 1;
    entry.lastAccess = Date.now();
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }

  peek(key: string) {
    return this.entries.get(key);
  }

  set(key: string, svg: string, complexity: MermaidComplexity) {
    const byteSize = new TextEncoder().encode(svg).byteLength;
    if (byteSize > this.maxBytes) return undefined;
    const previous = this.entries.get(key);
    if (previous) {
      this.totalBytes -= previous.byteSize;
      this.entries.delete(key);
    }
    const entry = { key, svg, byteSize, complexity, lastAccess: Date.now() };
    this.entries.set(key, entry);
    this.totalBytes += byteSize;
    this.evictToBudget();
    return this.entries.get(key);
  }

  pin(key: string) {
    if (!this.entries.has(key)) return;
    this.pins.set(key, (this.pins.get(key) ?? 0) + 1);
  }

  unpin(key: string) {
    const count = this.pins.get(key) ?? 0;
    if (count <= 1) this.pins.delete(key);
    else this.pins.set(key, count - 1);
    this.evictToBudget();
  }

  clear() {
    this.entries.clear();
    this.pins.clear();
    this.totalBytes = 0;
  }

  stats(): MermaidCacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      entries: this.entries.size,
      totalBytes: this.totalBytes,
      maxBytes: this.maxBytes,
      pinned: this.pins.size,
    };
  }

  private evictToBudget() {
    while (this.totalBytes > this.maxBytes) {
      const candidate = Array.from(this.entries.values()).find(
        (entry) => !this.pins.has(entry.key),
      );
      if (!candidate) break;
      this.entries.delete(candidate.key);
      this.totalBytes -= candidate.byteSize;
      this.evictions += 1;
    }
  }
}
