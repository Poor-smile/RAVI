export type TtsEngineId = "mana" | "ava" | "mms" | "gooya" | "f5ipa";

export type TtsEngineSizeBreakdown = {
  primaryModelBytes: number;
  supportFilesBytes: number;
  runtimeBytes: number;
  sharedPythonBytes: number;
};

export type TtsInstallState =
  | "idle"
  | "downloading"
  | "paused"
  | "verifying"
  | "installing"
  | "warming"
  | "error";

export type TtsEngine = {
  id: TtsEngineId;
  label: string;
  description: string;
  downloadBytes: number;
  requiredDownloadBytes: number;
  sizeBreakdown: TtsEngineSizeBreakdown;
  installed: boolean;
  selected: boolean;
  version: string;
  license: string;
  restriction?: string;
  verification: "not-installed" | "verified" | "invalid" | "outdated";
  checksum: string;
};

export type TtsModelState = {
  supported: boolean;
  activeEngine: TtsEngineId | null;
  installState: TtsInstallState;
  installEngine: TtsEngineId | null;
  installComponent: "runtime" | "model" | "voice" | null;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  error: string;
  engines: TtsEngine[];
};

export type TtsSynthesisResult = {
  engine: TtsEngineId;
  source: string;
  cached: boolean;
  durationMs?: number;
  recovered?: boolean;
  segmentCount?: number;
  nativeSpeed?: number;
};

export type TtsNarrationSegmentInput = {
  id: string;
  sourceText: string;
};

export type TtsNarrationSegment = TtsNarrationSegmentInput & {
  spokenText: string;
  pauseAfterMs: number;
};

export type TtsNarrationPreparationResult = {
  mode: "smart";
  cached: boolean;
  segments: TtsNarrationSegment[];
};

export type TtsLocalEvent = { type: "model"; state: TtsModelState };
