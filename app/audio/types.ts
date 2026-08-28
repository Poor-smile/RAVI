export const AUDIO_BLOCK_TITLE = "raavi-audio";
export const AUDIO_MAX_DURATION_MS = 60 * 60 * 1000;

export type AudioDescriptor = {
  fileName: string;
  source: string;
  title: typeof AUDIO_BLOCK_TITLE;
};

export type AudioBlock = AudioDescriptor & {
  raw: string;
  startOffset: number;
  endOffset: number;
};

export type AudioAssetSelection = {
  fileName: string;
  relativePath: string;
  sourceUrl: string;
  mimeType: string;
  size: number;
  durationMs: number;
};

export type AudioSourceResolution =
  | { status: "ready"; source: string }
  | { status: "blocked"; message: string };

export type AudioModelTierId = "light" | "balanced" | "accurate";

export type AudioModelTier = {
  id: AudioModelTierId;
  label: string;
  suitableFor: string;
  detail: string;
  sizeBytes: number;
  installed: boolean;
  recommended: boolean;
};

export type AudioModelState = {
  supported: boolean;
  activeTier: AudioModelTierId | null;
  installState: "idle" | "downloading" | "paused" | "verifying" | "installing" | "error";
  installTier: AudioModelTierId | null;
  installComponent: "ffmpeg" | "engine" | "model" | null;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  error: string;
  tiers: AudioModelTier[];
};

export type AudioTranscriptSegment = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence: number;
  uncertain: boolean;
};

export type AudioTranscriptionJobPhase =
  | "queued"
  | "preparing"
  | "transcribing"
  | "paused"
  | "complete"
  | "cancelled"
  | "error";

export type AudioTranscriptionJob = {
  id: string;
  documentPath: string;
  relativePath: string;
  fileName: string;
  durationMs: number;
  tier: AudioModelTierId;
  phase: AudioTranscriptionJobPhase;
  progress: number;
  currentChunk: number;
  chunkMs?: number;
  totalChunks: number;
  etaSeconds: number | null;
  segments: AudioTranscriptSegment[];
  structured?: AudioStructuredResult | null;
  cleanedAt?: string;
  error: string;
  updatedAt: string;
};

export type AudioLocalEvent =
  | { type: "model"; state: AudioModelState }
  | { type: "transcription"; job: AudioTranscriptionJob };

export type AudioContentKind =
  | "meeting"
  | "interview"
  | "lecture"
  | "phone-call"
  | "voice-note"
  | "conversation"
  | "general";

export type AudioStructuredResult = {
  kind: AudioContentKind;
  kindLabel: string;
  title: string;
  markdown: string;
};

export type AudioCleanupResult = {
  kind: AudioContentKind;
  title: string;
  markdown: string;
};
