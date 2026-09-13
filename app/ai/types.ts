export type AiContextKind = "document" | "block" | "selection";

export type AiFrozenContext = {
  sessionId: string;
  documentId?: string;
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

export type CodexSetupProgress = {
  phase: "idle" | "checking" | "downloading" | "verifying" | "installing" | "authorizing" | "connected" | "error";
  percent?: number;
  code?: string;
};

export type ChatGPTModelOption = {
  id: string;
  displayName: string;
  description: string;
  isDefault: boolean;
};

export type ChatGPTModelList = {
  models: ChatGPTModelOption[];
  defaultModel: string | null;
};

export type CodexResult = {
  answer: string;
  replacement: string | null;
};
