export type AiContextKind = "document" | "block" | "selection";

export type AiFrozenContext = {
  sessionId: string;
  kind: AiContextKind;
  label: string;
  content: string;
  editor: "main" | "writing";
  source: "editor" | "table";
  from?: number;
  to?: number;
  blockFrom?: number;
  blockTo?: number;
  blockContent?: string;
  tableKey?: string;
};

export type AiFrozenContextDraft = Omit<AiFrozenContext, "sessionId">;

export type CodexConnectionState =
  | "checking"
  | "connected"
  | "cli_missing"
  | "auth_required"
  | "auth_waiting"
  | "connection_error"
  | "unavailable";

export type CodexConnectionStatus = {
  state: Exclude<CodexConnectionState, "checking" | "unavailable">;
};

export type CodexResult = {
  answer: string;
  replacement: string | null;
};
