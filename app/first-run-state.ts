import type { CodexConnectionStatus } from "./ai/types";
import type {
  BackupProviderConnections,
  BackupProviderId,
  BackupStatus,
} from "./backup/policy";

export type FirstRunChatGPTState =
  | "checking"
  | "cli_missing"
  | "auth_required"
  | "auth_waiting"
  | "connected"
  | "connection_error";

export type FirstRunProviderState =
  | "idle"
  | "connecting"
  | "connected"
  | "selected"
  | "error"
  | "disconnected";

const PROVIDER_IDS: readonly BackupProviderId[] = [
  "google-drive",
  "proton-drive",
];

export function chatGPTStateFromConnection(
  status: CodexConnectionStatus,
): FirstRunChatGPTState {
  return status.state;
}

export function shouldAutoOpenFirstRun(
  installation: { firstLaunch: boolean },
  completed: boolean,
) {
  return installation.firstLaunch && !completed;
}

export function firstRunProviderSelection(
  backupStatus: BackupStatus,
  connections?: Partial<BackupProviderConnections>,
): {
  states: Record<BackupProviderId, FirstRunProviderState>;
  selectedProvider: BackupProviderId | null;
} {
  const selectedProvider =
    backupStatus.connection.state === "connected"
      ? backupStatus.providerId
      : null;

  const states = Object.fromEntries(
    PROVIDER_IDS.map((providerId) => {
      const connection =
        connections?.[providerId] ??
        (backupStatus.providerId === providerId
          ? backupStatus.connection
          : { state: "disconnected" as const, accountEmail: "" });
      const state: FirstRunProviderState =
        connection.state === "connected"
          ? providerId === selectedProvider
            ? "selected"
            : "connected"
          : connection.state === "reauth"
            ? "disconnected"
            : connection.state === "error"
              ? "error"
              : "idle";
      return [providerId, state];
    }),
  ) as Record<BackupProviderId, FirstRunProviderState>;

  return { states, selectedProvider };
}
