// Keep navigation and native privileges bound to the application's main frame.
export function isTrustedAppUrl(value, origin) {
  try {
    const url = new URL(value);
    const expected = new URL(origin);
    return expected.protocol === "http:" && url.origin === expected.origin &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isTrustedIpcSender(event, { window, origin }) {
  try {
    return Boolean(window && !window.isDestroyed() &&
      event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame &&
      isTrustedAppUrl(event.senderFrame.url, origin));
  } catch {
    // A frame can be destroyed between dispatch and validation.
    return false;
  }
}

export function createTrustedIpc(ipcMain, getContext) {
  return {
    handle(channel, handler) {
      ipcMain.handle(channel, (event, ...args) => {
        if (!isTrustedIpcSender(event, getContext())) {
          throw new Error("Untrusted IPC sender.");
        }
        return handler(event, ...args);
      });
    },
    on(channel, handler) {
      ipcMain.on(channel, (event, ...args) => {
        if (!isTrustedIpcSender(event, getContext())) {
          // Also answer sendSync callers, without throwing out of EventEmitter.
          event.returnValue = { error: "Untrusted IPC sender." };
          return;
        }
        return handler(event, ...args);
      });
    },
  };
}
