/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

// No file, account, window or arbitrary IPC access in the diagram process.
contextBridge.exposeInMainWorld("raaviMermaidHost", Object.freeze({
  ready: () => ipcRenderer.send("mermaid:ready"),
  onJob: (callback) => {
    const listener = (_event, job) => callback(job);
    ipcRenderer.on("mermaid:job", listener);
    return () => ipcRenderer.removeListener("mermaid:job", listener);
  },
  result: (jobId, result) => ipcRenderer.send("mermaid:result", jobId, result),
}));
