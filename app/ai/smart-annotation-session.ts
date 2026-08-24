import type { RaaviAnnotation } from "../raavi";

export type SmartAnnotationPhase = "idle" | "confirm" | "checking" | "complete" | "disconnected" | "quota" | "error";
export type SmartAnnotationSession = {
  phase: SmartAnnotationPhase;
  sourceSnapshot: string;
  summary: string;
  annotations: RaaviAnnotation[];
  visibleCount: number;
  statusMessage: string;
  startedAt: string;
};
type Listener = (session: SmartAnnotationSession) => void;
const sessions = new Map<string, SmartAnnotationSession>();
const listeners = new Map<string, Set<Listener>>();
const requests = new Map<string, Promise<unknown>>();

function createSession(): SmartAnnotationSession {
  return { phase: "idle", sourceSnapshot: "", summary: "", annotations: [], visibleCount: 0, statusMessage: "", startedAt: "" };
}

export function readSmartAnnotationSession(key: string) {
  const current = sessions.get(key);
  if (current) return current;
  const created = createSession();
  sessions.set(key, created);
  return created;
}

export function updateSmartAnnotationSession(key: string, update: (current: SmartAnnotationSession) => SmartAnnotationSession) {
  const next = update(readSmartAnnotationSession(key));
  sessions.set(key, next);
  for (const listener of listeners.get(key) ?? []) listener(next);
  return next;
}

export function subscribeToSmartAnnotationSession(key: string, listener: Listener) {
  const current = listeners.get(key) ?? new Set<Listener>();
  current.add(listener);
  listeners.set(key, current);
  return () => {
    current.delete(listener);
    if (!current.size) listeners.delete(key);
  };
}

export function runDocumentScopedSmartAnnotationRequest<T>(key: string, request: () => Promise<T>) {
  const existing = requests.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const pending = request().finally(() => requests.delete(key));
  requests.set(key, pending);
  return pending;
}
