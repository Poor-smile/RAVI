export function createCodexConnector({ readStatus, resolveCommand, install, login, onProgress }) {
  let pending;
  let progress = { phase: "idle" };
  const report = value => { progress = value; onProgress(value); };
  return {
    getProgress: () => progress,
    connect() {
      if (pending) return pending;
      pending = (async () => {
        report({ phase: "checking" });
        try {
          if ((await readStatus()).state === "connected") {
            report({ phase: "connected" });
            return { started: false, state: "connected" };
          }
          if (!await resolveCommand()) await install(report);
          report({ phase: "authorizing" });
          const result = await login();
          if (!result.started) throw new Error("CODEX_LOGIN_FAILED");
          return result;
        } catch (error) {
          const code = /^CODEX_[A-Z_]+$/.test(error?.message || "") ? error.message : "CODEX_CONNECT_FAILED";
          report({ phase: "error", code });
          return { started: false, state: "connection_error", code };
        }
      })().finally(() => { pending = undefined; });
      return pending;
    },
  };
}
