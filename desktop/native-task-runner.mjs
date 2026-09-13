import { Worker } from "node:worker_threads";

// CreateProcess can block synchronously on Windows even when spawn/execFile
// return asynchronous children. Keep that work away from Electron's UI/IPC.
export function createNativeTaskRunner(url = new URL("./native-task-worker.mjs", import.meta.url)) {
  let worker;
  let nextId = 0;
  const pending = new Map();
  function start() {
    if (worker) return worker;
    const current = new Worker(url);
    worker = current;
    const fail = error => {
      if (worker !== current) return;
      worker = undefined;
      for (const request of pending.values()) request.reject(error);
      pending.clear();
    };
    current.on("message", ({ id, value, error }) => {
      const request = pending.get(id);
      if (!request) return;
      pending.delete(id);
      if (error) request.reject(Object.assign(new Error(error.message), { code: error.code }));
      else request.resolve(value);
      if (!pending.size) current.unref();
    });
    current.on("error", fail);
    current.on("exit", code => fail(new Error(`Native task worker exited (${code}).`)));
    current.unref();
    return current;
  }
  return (task, payload) => new Promise((resolve, reject) => {
    const id = ++nextId;
    try {
      const current = start();
      pending.set(id, { resolve, reject });
      current.ref();
      current.postMessage({ id, task, payload });
    } catch (error) {
      pending.delete(id);
      if (!pending.size) worker?.unref();
      reject(error);
    }
  });
}

export const runNativeTask = createNativeTaskRunner();
