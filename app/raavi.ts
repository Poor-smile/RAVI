export const RAVI_FORMAT = "ravi";
export const RAVI_VERSION = 1;

export type AnnotationKind = "highlight" | "comment" | "margin";

export type RaaviAnnotation = {
  id: string;
  kind: AnnotationKind;
  start: number;
  end: number;
  quote: string;
  prefix: string;
  suffix: string;
  body: string;
  createdAt: string;
};

export type RaaviVersion = {
  number: number;
  savedAt: string;
  content: string;
  annotations: RaaviAnnotation[];
};

export type RaaviDocument = {
  format: typeof RAVI_FORMAT;
  version: typeof RAVI_VERSION;
  document: {
    name: string;
    markdown: string;
    revision: number;
  };
  annotations: RaaviAnnotation[];
  versions: RaaviVersion[];
  updatedAt: string;
};

const annotationKinds = new Set<AnnotationKind>([
  "highlight",
  "comment",
  "margin",
]);

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function safeFileName(value: unknown, fallbackName: string) {
  const candidate = safeText(value, 240).trim();
  return candidate || fallbackName;
}

function parseAnnotation(
  value: unknown,
  index: number,
): RaaviAnnotation | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (!annotationKinds.has(candidate.kind as AnnotationKind)) return null;

  const start = Number(candidate.start);
  const end = Number(candidate.end);
  const quote = safeText(candidate.quote, 5_000);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end <= start ||
    !quote
  ) {
    return null;
  }

  return {
    id:
      safeText(candidate.id, 120).trim() ||
      `ravi-imported-${Date.now()}-${index}`,
    kind: candidate.kind as AnnotationKind,
    start,
    end,
    quote,
    prefix: safeText(candidate.prefix, 160),
    suffix: safeText(candidate.suffix, 160),
    body: safeText(candidate.body, 20_000),
    createdAt:
      safeText(candidate.createdAt, 64) || new Date().toISOString(),
  };
}

function parseVersion(value: unknown): RaaviVersion | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const number = Number(candidate.number);
  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    typeof candidate.content !== "string"
  ) {
    return null;
  }

  return {
    number,
    savedAt: safeText(candidate.savedAt, 64) || new Date().toISOString(),
    content: candidate.content,
    annotations: Array.isArray(candidate.annotations)
      ? candidate.annotations
          .map(parseAnnotation)
          .filter(
            (annotation): annotation is RaaviAnnotation => annotation !== null,
          )
      : [],
  };
}

export function parseRaaviDocument(
  rawValue: string,
  fallbackName = "نوشته-راوی.md",
) {
  let value: unknown;
  try {
    value = JSON.parse(rawValue);
  } catch {
    throw new Error("RAVI_INVALID_JSON");
  }

  if (!value || typeof value !== "object") {
    throw new Error("RAVI_INVALID_DOCUMENT");
  }

  const candidate = value as Record<string, unknown>;
  const documentValue =
    candidate.document && typeof candidate.document === "object"
      ? (candidate.document as Record<string, unknown>)
      : null;

  if (
    candidate.format !== RAVI_FORMAT ||
    candidate.version !== RAVI_VERSION ||
    !documentValue ||
    typeof documentValue.markdown !== "string"
  ) {
    throw new Error("RAVI_UNSUPPORTED_DOCUMENT");
  }

  const annotations = Array.isArray(candidate.annotations)
    ? candidate.annotations
        .map(parseAnnotation)
        .filter(
          (annotation): annotation is RaaviAnnotation => annotation !== null,
        )
    : [];
  const revision = Number(documentValue.revision);
  const versions = Array.isArray(candidate.versions)
    ? candidate.versions
        .slice(-30)
        .map(parseVersion)
        .filter((version): version is RaaviVersion => version !== null)
    : [];

  return {
    fileName: safeFileName(documentValue.name, fallbackName),
    content: documentValue.markdown,
    annotations,
    revision:
      Number.isSafeInteger(revision) && revision > 0 ? revision : 1,
    versions,
  };
}

export function makeRaaviDocument(
  fileName: string,
  content: string,
  annotations: RaaviAnnotation[],
  revision = 1,
  versions: RaaviVersion[] = [],
): RaaviDocument {
  return {
    format: RAVI_FORMAT,
    version: RAVI_VERSION,
    document: {
      name: safeFileName(fileName, "نوشته-راوی.md"),
      markdown: content,
      revision,
    },
    annotations,
    versions: versions.slice(-30),
    updatedAt: new Date().toISOString(),
  };
}

export function getRaaviName(fileName: string) {
  const baseName =
    fileName.trim().replace(/\.(?:md|markdown|ravi)$/i, "") || "نوشته-راوی";
  return `${baseName}.ravi`;
}
