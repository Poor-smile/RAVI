export type SoftwareUpdatePhase =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "paused"
  | "ready"
  | "error";

export type SoftwareUpdateState = {
  phase: SoftwareUpdatePhase;
  currentVersion: string;
  version: string;
  notesUrl: string;
  downloadedBytes: number;
  totalBytes: number;
  progress: number;
  checkedAt: string;
  message: string;
  installerPath: string;
};

export const DEFAULT_SOFTWARE_UPDATE_STATE: SoftwareUpdateState = {
  phase: "idle",
  currentVersion: "",
  version: "",
  notesUrl: "",
  downloadedBytes: 0,
  totalBytes: 0,
  progress: 0,
  checkedAt: "",
  message: "",
  installerPath: "",
};
