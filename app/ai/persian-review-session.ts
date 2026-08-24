import type { PersianAiSuggestion } from "./persian-review";

export type PersianAiSuggestionState =
  | "pending"
  | "rewriting"
  | "exiting-applied"
  | "rejected";

export type PersianAiReviewPhase =
  | "idle"
  | "confirm"
  | "checking"
  | "suggestions"
  | "disconnected"
  | "quota"
  | "error"
  | "success";

export type PersianAiReviewSession = {
  phase: PersianAiReviewPhase;
  sourceSnapshot: string;
  summary: string;
  suggestions: PersianAiSuggestion[];
  visibleSuggestionCount: number;
  suggestionStates: Record<string, PersianAiSuggestionState>;
  confirmAll: boolean;
  statusMessage: string;
};

type SessionListener = (session: PersianAiReviewSession) => void;

const sessions = new Map<string, PersianAiReviewSession>();
const listeners = new Map<string, Set<SessionListener>>();

function createSession(): PersianAiReviewSession {
  return {
    phase: "idle",
    sourceSnapshot: "",
    summary: "",
    suggestions: [],
    visibleSuggestionCount: 0,
    suggestionStates: {},
    confirmAll: false,
    statusMessage: "",
  };
}

export function readPersianAiReviewSession(reviewKey: string) {
  const existing = sessions.get(reviewKey);
  if (existing) return existing;
  const session = createSession();
  sessions.set(reviewKey, session);
  return session;
}

export function updatePersianAiReviewSession(
  reviewKey: string,
  update: (current: PersianAiReviewSession) => PersianAiReviewSession,
) {
  const next = update(readPersianAiReviewSession(reviewKey));
  sessions.set(reviewKey, next);
  for (const listener of listeners.get(reviewKey) ?? []) listener(next);
  return next;
}

export function subscribeToPersianAiReviewSession(
  reviewKey: string,
  listener: SessionListener,
) {
  const sessionListeners = listeners.get(reviewKey) ?? new Set<SessionListener>();
  sessionListeners.add(listener);
  listeners.set(reviewKey, sessionListeners);
  return () => {
    sessionListeners.delete(listener);
    if (!sessionListeners.size) listeners.delete(reviewKey);
  };
}
