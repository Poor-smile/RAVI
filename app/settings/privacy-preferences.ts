export type ExternalImagePolicy = "block" | "ask" | "allow";

export type PrivacyPreferences = {
  externalImagePolicy: ExternalImagePolicy;
  warnBeforeExternalLinks: boolean;
};

export const PRIVACY_PREFERENCES_STORAGE_KEY =
  "raavi:privacy-preferences:v1";

export const DEFAULT_PRIVACY_PREFERENCES: PrivacyPreferences = {
  externalImagePolicy: "ask",
  warnBeforeExternalLinks: true,
};

export function parsePrivacyPreferences(
  stored: string | null,
): PrivacyPreferences {
  if (!stored) return DEFAULT_PRIVACY_PREFERENCES;
  try {
    const value = JSON.parse(stored) as Partial<PrivacyPreferences>;
    return {
      externalImagePolicy:
        value.externalImagePolicy === "block" ||
        value.externalImagePolicy === "allow"
          ? value.externalImagePolicy
          : "ask",
      warnBeforeExternalLinks:
        typeof value.warnBeforeExternalLinks === "boolean"
          ? value.warnBeforeExternalLinks
          : true,
    };
  } catch {
    return DEFAULT_PRIVACY_PREFERENCES;
  }
}
