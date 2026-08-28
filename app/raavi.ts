export const RAVI_FORMAT = "ravi";
export const RAVI_VERSION = 1;
export const RAVI_IMAGE_URL_PREFIX = "raavi-image://";
export const MAX_RAVI_IMAGE_ASSETS = 8;
export const MAX_RAVI_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_RAVI_IMAGE_TOTAL_BYTES = 40 * 1024 * 1024;
const supportedImageTypes = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type AnnotationKind = "highlight" | "comment";

export type SmartAnnotationStatus =
  | "open"
  | "applying"
  | "applied"
  | "rejected"
  | "resolved"
  | "detached";

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
  source?: "user" | "raavi-ai";
  category?: string;
  suggestion?: string;
  confidence?: number;
  status?: SmartAnnotationStatus;
  blockId?: string;
  approximateStart?: number;
  approximateEnd?: number;
  fingerprint?: string;
  audioSource?: string;
  audioStartMs?: number;
  audioEndMs?: number;
};

export type RaaviImageAsset = {
  id: string;
  name: string;
  mimeType: "image/gif" | "image/jpeg" | "image/png" | "image/webp";
  data: string;
  width?: number;
  height?: number;
};

export type RaaviVersion = {
  number: number;
  savedAt: string;
  content: string;
  annotations: RaaviAnnotation[];
  kind?: "autosave" | "manual" | "ai";
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
  assets: RaaviImageAsset[];
  updatedAt: string;
};

const annotationKinds = new Set<AnnotationKind>(["highlight", "comment"]);

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function safeFileName(value: unknown, fallbackName: string) {
  const candidate = safeText(value, 240).trim();
  return candidate || fallbackName;
}

function decodedBase64Length(value: string) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

function parseImageAsset(value: unknown): RaaviImageAsset | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const id = safeText(candidate.id, 120).trim();
  const name = safeText(candidate.name, 240).trim();
  const mimeType = safeText(candidate.mimeType, 64).toLowerCase();
  const data = typeof candidate.data === "string" ? candidate.data : "";
  const width =
    typeof candidate.width === "number" &&
    Number.isInteger(candidate.width) &&
    candidate.width > 0 &&
    candidate.width <= 16_384
      ? candidate.width
      : undefined;
  const height =
    typeof candidate.height === "number" &&
    Number.isInteger(candidate.height) &&
    candidate.height > 0 &&
    candidate.height <= 16_384
      ? candidate.height
      : undefined;

  if (
    !/^[a-z0-9][a-z0-9-]{0,119}$/iu.test(id) ||
    !name ||
    !supportedImageTypes.has(mimeType) ||
    !data ||
    data.length > Math.ceil((MAX_RAVI_IMAGE_BYTES * 4) / 3) + 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/u.test(data) ||
    decodedBase64Length(data) > MAX_RAVI_IMAGE_BYTES
  ) {
    return null;
  }

  return {
    id,
    name,
    mimeType: mimeType as RaaviImageAsset["mimeType"],
    data,
    ...(width && height ? { width, height } : {}),
  };
}

function parseImageAssets(value: unknown) {
  if (!Array.isArray(value)) return [];

  let totalBytes = 0;
  const knownIds = new Set<string>();
  const assets: RaaviImageAsset[] = [];
  for (const candidate of value.slice(0, MAX_RAVI_IMAGE_ASSETS)) {
    const asset = parseImageAsset(candidate);
    if (!asset || knownIds.has(asset.id)) continue;
    const assetBytes = decodedBase64Length(asset.data);
    if (totalBytes + assetBytes > MAX_RAVI_IMAGE_TOTAL_BYTES) continue;
    knownIds.add(asset.id);
    totalBytes += assetBytes;
    assets.push(asset);
  }
  return assets;
}

export function raaviImageUrl(id: string) {
  return `${RAVI_IMAGE_URL_PREFIX}${id}`;
}

export function raaviImageAssetId(source: string) {
  if (!source.startsWith(RAVI_IMAGE_URL_PREFIX)) return null;
  const id = source.slice(RAVI_IMAGE_URL_PREFIX.length);
  return /^[a-z0-9][a-z0-9-]{0,119}$/iu.test(id) ? id : null;
}

export function raaviImageDataUrl(asset: RaaviImageAsset) {
  return `data:${asset.mimeType};base64,${asset.data}`;
}

export function markdownWithEmbeddedRaaviImages(
  markdown: string,
  assets: RaaviImageAsset[],
) {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  return markdown.replace(
    /raavi-image:\/\/([a-z0-9][a-z0-9-]{0,119})/giu,
    (reference, id: string) => {
      const asset = assetsById.get(id);
      return asset ? raaviImageDataUrl(asset) : reference;
    },
  );
}

function parseAnnotation(
  value: unknown,
  index: number,
): RaaviAnnotation | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const kind = candidate.kind === "margin" ? "comment" : candidate.kind;
  if (!annotationKinds.has(kind as AnnotationKind)) return null;

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
    kind: kind as AnnotationKind,
    start,
    end,
    quote,
    prefix: safeText(candidate.prefix, 160),
    suffix: safeText(candidate.suffix, 160),
    body: safeText(candidate.body, 20_000),
    createdAt: safeText(candidate.createdAt, 64) || new Date().toISOString(),
    ...(candidate.source === "raavi-ai" || candidate.source === "user"
      ? { source: candidate.source }
      : {}),
    ...(safeText(candidate.category, 80).trim()
      ? { category: safeText(candidate.category, 80).trim() }
      : {}),
    ...(safeText(candidate.suggestion, 20_000)
      ? { suggestion: safeText(candidate.suggestion, 20_000) }
      : {}),
    ...(typeof candidate.confidence === "number" &&
    Number.isFinite(candidate.confidence)
      ? { confidence: Math.max(0, Math.min(1, candidate.confidence)) }
      : {}),
    ...(candidate.status === "open" ||
    candidate.status === "applying" ||
    candidate.status === "applied" ||
    candidate.status === "rejected" ||
    candidate.status === "resolved" ||
    candidate.status === "detached"
      ? { status: candidate.status }
      : {}),
    ...(safeText(candidate.blockId, 160).trim()
      ? { blockId: safeText(candidate.blockId, 160).trim() }
      : {}),
    ...(Number.isSafeInteger(candidate.approximateStart) &&
    Number(candidate.approximateStart) >= 0
      ? { approximateStart: Number(candidate.approximateStart) }
      : {}),
    ...(Number.isSafeInteger(candidate.approximateEnd) &&
    Number(candidate.approximateEnd) >= 0
      ? { approximateEnd: Number(candidate.approximateEnd) }
      : {}),
    ...(safeText(candidate.fingerprint, 160).trim()
      ? { fingerprint: safeText(candidate.fingerprint, 160).trim() }
      : {}),
    ...(safeText(candidate.audioSource, 1_024).trim()
      ? { audioSource: safeText(candidate.audioSource, 1_024).trim() }
      : {}),
    ...(typeof candidate.audioStartMs === "number" &&
    Number.isFinite(candidate.audioStartMs) &&
    candidate.audioStartMs >= 0
      ? { audioStartMs: Math.round(candidate.audioStartMs) }
      : {}),
    ...(typeof candidate.audioEndMs === "number" &&
    Number.isFinite(candidate.audioEndMs) &&
    candidate.audioEndMs >= 0
      ? { audioEndMs: Math.round(candidate.audioEndMs) }
      : {}),
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
    ...(candidate.kind === "autosave" ||
    candidate.kind === "manual" ||
    candidate.kind === "ai"
      ? { kind: candidate.kind }
      : {}),
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
  const assets = parseImageAssets(candidate.assets);

  return {
    fileName: safeFileName(documentValue.name, fallbackName),
    content: documentValue.markdown,
    annotations,
    revision: Number.isSafeInteger(revision) && revision > 0 ? revision : 1,
    versions,
    assets,
  };
}

export function makeRaaviDocument(
  fileName: string,
  content: string,
  annotations: RaaviAnnotation[],
  revision = 1,
  versions: RaaviVersion[] = [],
  assets: RaaviImageAsset[] = [],
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
    assets: parseImageAssets(assets),
    updatedAt: new Date().toISOString(),
  };
}

export function getRaaviName(fileName: string) {
  const baseName =
    fileName.trim().replace(/\.(?:md|markdown|ravi)$/i, "") || "نوشته-راوی";
  return `${baseName}.ravi`;
}
