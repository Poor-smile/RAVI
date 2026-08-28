export const BACKUP_PREFERENCES_STORAGE_KEY = "raavi:backup-preferences:v1";

export const DRIVE_SAFETY_RESERVE_MIN_BYTES = 500 * 1024 * 1024;
export const DRIVE_SAFETY_RESERVE_RATIO = 0.05;
export const LOCAL_DOCUMENT_WRITE_DELAY_MS = 500;
export const DRIVE_IDLE_SYNC_DELAY_MS = 2_500;
export const DRIVE_CONTINUOUS_SYNC_MAX_DELAY_MS = 10_000;
export const CHECKPOINT_INTERVAL_MS = 5 * 60 * 1_000;
export const TEXT_HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
export const MEDIA_HISTORY_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1_000;
export const ASSET_GC_GRACE_MS = 7 * 24 * 60 * 60 * 1_000;
export const TEXT_HISTORY_MAX_VERSIONS = 50;

export type FileResidency =
  | "reading"
  | "vault-local"
  | "backed-up"
  | "syncing"
  | "error";

export type BackupScopeOverride = "inherit" | "always" | "device-only";

export type BackupProviderId = "google-drive" | "proton-drive";

export type BackupPreferences = {
  textAndStructure: boolean;
  optimizedImages: boolean;
  audio: boolean;
  otherAttachments: boolean;
  versionHistory: boolean;
};

export const DEFAULT_BACKUP_PREFERENCES: BackupPreferences = {
  textAndStructure: true,
  optimizedImages: true,
  audio: false,
  otherAttachments: false,
  versionHistory: true,
};

export type DriveQuota = {
  limitBytes: number;
  usageBytes: number;
  trashBytes?: number;
};

export type DriveQuotaState = {
  level: "normal" | "warning" | "action" | "critical";
  usageRatio: number;
  freeBytes: number;
  safetyReserveBytes: number;
  usableBytes: number;
  mediaUploadAllowed: boolean;
};

export type BackupConnection = {
  state: "disconnected" | "connected" | "reauth" | "error";
  accountEmail: string;
};

export type BackupProviderConnections = Record<
  BackupProviderId,
  BackupConnection
>;

export type BackupStatus = {
  providerId: BackupProviderId;
  connection: BackupConnection;
  preferences: BackupPreferences;
  quota: DriveQuota | null;
  queuedDocuments: number;
  syncState: "local-saved" | "syncing" | "up-to-date" | "error";
  lastSyncAt: string;
  lastError: string;
  lastWarning?: string;
  connectionError?: { code: string; message: string };
};

export type CloudBackupSummary = {
  providerId: BackupProviderId;
  documentId: string;
  fileName: string;
  backedUpAt: string;
  versionCount: number;
  assetCount: number;
  audioCount: number;
  attachmentCount: number;
  categories: Partial<BackupPreferences>;
};

export type CloudRestoreItem = {
  documentId: string;
  fileName: string;
  filePath: string;
  mediaCount: number;
  versionCount: number;
};

export type CloudRestoreResult = {
  canceled: boolean;
  providerId?: BackupProviderId;
  restoreRoot?: string;
  restored: CloudRestoreItem[];
  failed: Array<{ documentId: string; message: string }>;
};

export const DEFAULT_BACKUP_STATUS: BackupStatus = {
  providerId: "google-drive",
  connection: { state: "disconnected", accountEmail: "" },
  preferences: DEFAULT_BACKUP_PREFERENCES,
  quota: null,
  queuedDocuments: 0,
  syncState: "local-saved",
  lastSyncAt: "",
  lastError: "",
  lastWarning: "",
};

export type VaultMutation =
  | "edit-content"
  | "edit-title"
  | "edit-tags"
  | "edit-structure"
  | "add-highlight"
  | "add-comment"
  | "add-annotation"
  | "change-attachment"
  | "move-to-vault"
  | "open"
  | "scroll"
  | "search"
  | "play-media"
  | "save-reading-position";

export type VersionRetentionCandidate = {
  id: string;
  createdAt: number;
  pinned?: boolean;
  current?: boolean;
};

export type AssetRetentionCandidate = {
  id: string;
  referencedByCurrent: boolean;
  referencedByRetainedVersion: boolean;
  pinned?: boolean;
  unreferencedAt?: number;
};

const PROMOTION_MUTATIONS = new Set<VaultMutation>([
  "edit-content",
  "edit-title",
  "edit-tags",
  "edit-structure",
  "add-highlight",
  "add-comment",
  "add-annotation",
  "change-attachment",
  "move-to-vault",
]);

function finiteNonNegative(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

export function parseBackupPreferences(raw: string | null): BackupPreferences {
  if (!raw) return DEFAULT_BACKUP_PREFERENCES;
  try {
    const candidate = JSON.parse(raw) as Partial<BackupPreferences>;
    return {
      textAndStructure:
        typeof candidate.textAndStructure === "boolean"
          ? candidate.textAndStructure
          : DEFAULT_BACKUP_PREFERENCES.textAndStructure,
      optimizedImages:
        typeof candidate.optimizedImages === "boolean"
          ? candidate.optimizedImages
          : DEFAULT_BACKUP_PREFERENCES.optimizedImages,
      audio:
        typeof candidate.audio === "boolean"
          ? candidate.audio
          : DEFAULT_BACKUP_PREFERENCES.audio,
      otherAttachments:
        typeof candidate.otherAttachments === "boolean"
          ? candidate.otherAttachments
          : DEFAULT_BACKUP_PREFERENCES.otherAttachments,
      versionHistory:
        typeof candidate.versionHistory === "boolean"
          ? candidate.versionHistory
          : DEFAULT_BACKUP_PREFERENCES.versionHistory,
    };
  } catch {
    return DEFAULT_BACKUP_PREFERENCES;
  }
}

export function shouldPromoteToVault(
  residency: FileResidency,
  mutation: VaultMutation,
) {
  return residency === "reading" && PROMOTION_MUTATIONS.has(mutation);
}

export function resolveBackupInclusion(
  inherited: boolean,
  override: BackupScopeOverride,
) {
  if (override === "always") return true;
  if (override === "device-only") return false;
  return inherited;
}

export function evaluateDriveQuota(quota: DriveQuota): DriveQuotaState {
  const limitBytes = finiteNonNegative(quota.limitBytes);
  const usageBytes = Math.min(finiteNonNegative(quota.usageBytes), limitBytes);
  const safetyReserveBytes = Math.min(
    limitBytes,
    Math.max(
      DRIVE_SAFETY_RESERVE_MIN_BYTES,
      Math.round(limitBytes * DRIVE_SAFETY_RESERVE_RATIO),
    ),
  );
  const freeBytes = Math.max(0, limitBytes - usageBytes);
  const usableBytes = Math.max(0, limitBytes - safetyReserveBytes);
  const usageRatio = limitBytes > 0 ? usageBytes / limitBytes : 1;
  const level =
    usageRatio >= 0.95 || freeBytes <= safetyReserveBytes
      ? "critical"
      : usageRatio >= 0.9
        ? "action"
        : usageRatio >= 0.8
          ? "warning"
          : "normal";
  return {
    level,
    usageRatio,
    freeBytes,
    safetyReserveBytes,
    usableBytes,
    mediaUploadAllowed: level !== "critical",
  };
}

export function selectRetainedVersions(
  candidates: readonly VersionRetentionCandidate[],
  now = Date.now(),
) {
  const protectedVersions = candidates.filter(
    (candidate) => candidate.current || candidate.pinned,
  );
  const protectedIds = new Set(protectedVersions.map((candidate) => candidate.id));
  const recent = candidates
    .filter(
      (candidate) =>
        !protectedIds.has(candidate.id) &&
        now - candidate.createdAt <= TEXT_HISTORY_MAX_AGE_MS,
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, TEXT_HISTORY_MAX_VERSIONS);
  return [...protectedVersions, ...recent];
}

export function selectCollectableAssets(
  candidates: readonly AssetRetentionCandidate[],
  now = Date.now(),
) {
  return candidates.filter(
    (candidate) =>
      !candidate.referencedByCurrent &&
      !candidate.referencedByRetainedVersion &&
      !candidate.pinned &&
      typeof candidate.unreferencedAt === "number" &&
      now - candidate.unreferencedAt >= ASSET_GC_GRACE_MS,
  );
}

export function nextResidencyAfterLocalSave(
  residency: FileResidency,
): FileResidency {
  return residency === "reading" ? "reading" : "vault-local";
}
