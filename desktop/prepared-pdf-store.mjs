import { randomUUID } from "node:crypto";

/** Native-only bytes: save the exact document shown by the renderer. */
export function createPreparedPdfStore(maxBytes = 128 * 1024 * 1024) {
  const entries = new Map();
  return {
    add(owner, input) {
      const bytes = Buffer.from(input);
      if (bytes.length > maxBytes || bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("INVALID_PDF");
      const owned = [...entries].filter(([, entry]) => entry.owner === owner);
      for (const [id] of owned.slice(0, Math.max(0, owned.length - 1))) entries.delete(id);
      const id = randomUUID();
      entries.set(id, { owner, bytes });
      return { id, bytes: new Uint8Array(bytes) };
    },
    read(owner, id) {
      const entry = entries.get(id);
      if (!entry || entry.owner !== owner) throw new Error("PDF_PREVIEW_EXPIRED");
      return entry.bytes;
    },
    release(owner, id) {
      if (entries.get(id)?.owner === owner) entries.delete(id);
    },
    clear(owner) {
      for (const [id, entry] of entries) if (entry.owner === owner) entries.delete(id);
    },
  };
}
