import type { CodexConnectionStatus } from "./types";

// One fresh native query at a time. Login tracking survives manual rechecks and
// closing settings, and every visible connection indicator gets the same result.
export function createConnectionMonitor(
  readStatus: () => Promise<CodexConnectionStatus>,
  now = Date.now,
) {
  const listeners = new Set<(status: CodexConnectionStatus) => void>();
  let inFlight: Promise<CodexConnectionStatus> | undefined;
  let loginUntil = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const publish = (status: CodexConnectionStatus) => {
    for (const listener of listeners) listener(status);
    return status;
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (loginUntil > now()) timer = setTimeout(() => void check(), 1_500);
  };
  const check = (): Promise<CodexConnectionStatus> => {
    if (inFlight) return inFlight;
    inFlight = Promise.resolve().then(readStatus)
      .catch((): CodexConnectionStatus => ({ state: "connection_error" }))
      .then(status => {
        if (status.state === "connected" || status.state === "cli_missing") loginUntil = 0;
        if (status.state === "auth_required" && loginUntil > now()) {
          return publish({ state: "auth_waiting" });
        }
        return publish(status);
      }).finally(() => { inFlight = undefined; schedule(); });
    return inFlight;
  };
  return {
    check,
    subscribe(listener: (status: CodexConnectionStatus) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    trackLogin() {
      loginUntil = now() + 5 * 60_000;
      publish({ state: "auth_waiting" });
      schedule();
    },
    dispose() { loginUntil = 0; if (timer) clearTimeout(timer); listeners.clear(); },
  };
}

export const chatGPTConnection = createConnectionMonitor(async () => {
  const read = window.raaviDesktop?.getCodexConnectionStatus;
  if (!read) return { state: "cli_missing" };
  return read();
});
