import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSET_GC_GRACE_MS,
  DEFAULT_BACKUP_PREFERENCES,
  DRIVE_SAFETY_RESERVE_MIN_BYTES,
  evaluateDriveQuota,
  parseBackupPreferences,
  resolveBackupInclusion,
  selectCollectableAssets,
  selectRetainedVersions,
  shouldPromoteToVault,
  TEXT_HISTORY_MAX_AGE_MS,
} from "../app/backup/policy";

test("backup preferences use conservative media defaults", () => {
  assert.deepEqual(parseBackupPreferences(null), DEFAULT_BACKUP_PREFERENCES);
  assert.deepEqual(parseBackupPreferences("not-json"), DEFAULT_BACKUP_PREFERENCES);
  assert.deepEqual(
    parseBackupPreferences(JSON.stringify({ audio: true, optimizedImages: false })),
    { ...DEFAULT_BACKUP_PREFERENCES, audio: true, optimizedImages: false },
  );
});

test("reading activity never promotes, while the first real change does", () => {
  for (const action of ["open", "scroll", "search", "play-media", "save-reading-position"] as const) {
    assert.equal(shouldPromoteToVault("reading", action), false);
  }
  for (const action of ["edit-content", "add-highlight", "add-comment", "change-attachment", "move-to-vault"] as const) {
    assert.equal(shouldPromoteToVault("reading", action), true);
  }
  assert.equal(shouldPromoteToVault("vault-local", "edit-content"), false);
});

test("per-file backup overrides inherit, force, or disable the vault policy", () => {
  assert.equal(resolveBackupInclusion(true, "inherit"), true);
  assert.equal(resolveBackupInclusion(false, "inherit"), false);
  assert.equal(resolveBackupInclusion(false, "always"), true);
  assert.equal(resolveBackupInclusion(true, "device-only"), false);
});

test("Drive quota has no Raavi cap and reserves max of five percent or 500MB", () => {
  const tenGiB = 10 * 1024 ** 3;
  const normal = evaluateDriveQuota({ limitBytes: tenGiB, usageBytes: 7 * 1024 ** 3 });
  assert.equal(normal.level, "normal");
  assert.equal(normal.safetyReserveBytes, Math.round(tenGiB * 0.05));
  assert.equal(normal.mediaUploadAllowed, true);

  const small = evaluateDriveQuota({ limitBytes: 2 * 1024 ** 3, usageBytes: 1.6 * 1024 ** 3 });
  assert.equal(small.safetyReserveBytes, DRIVE_SAFETY_RESERVE_MIN_BYTES);
  assert.equal(small.level, "critical");
  assert.equal(small.mediaUploadAllowed, false);

  const large = evaluateDriveQuota({ limitBytes: 100 * 1024 ** 3, usageBytes: 91 * 1024 ** 3 });
  assert.equal(large.level, "action");
});

test("retention always protects current and pinned versions", () => {
  const now = Date.now();
  const retained = selectRetainedVersions(
    [
      { id: "current", createdAt: now - TEXT_HISTORY_MAX_AGE_MS * 3, current: true },
      { id: "pinned", createdAt: now - TEXT_HISTORY_MAX_AGE_MS * 2, pinned: true },
      { id: "recent", createdAt: now - 1_000 },
      { id: "expired", createdAt: now - TEXT_HISTORY_MAX_AGE_MS - 1 },
    ],
    now,
  );
  assert.deepEqual(new Set(retained.map((version) => version.id)), new Set(["current", "pinned", "recent"]));
});

test("asset GC only collects unreferenced assets after the grace period", () => {
  const now = Date.now();
  const collectable = selectCollectableAssets(
    [
      { id: "current", referencedByCurrent: true, referencedByRetainedVersion: false, unreferencedAt: 0 },
      { id: "history", referencedByCurrent: false, referencedByRetainedVersion: true, unreferencedAt: 0 },
      { id: "grace", referencedByCurrent: false, referencedByRetainedVersion: false, unreferencedAt: now - ASSET_GC_GRACE_MS + 1 },
      { id: "old", referencedByCurrent: false, referencedByRetainedVersion: false, unreferencedAt: now - ASSET_GC_GRACE_MS },
    ],
    now,
  );
  assert.deepEqual(collectable.map((asset) => asset.id), ["old"]);
});
