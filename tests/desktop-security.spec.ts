import { releaseElectron as electron } from "./helpers/release-electron";
import { expect, test } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { waitForRaaviWindow } from "./helpers/electron-main-window";

test("desktop isolates its profile and rejects IPC from another window", async () => {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const profile = await mkdtemp(path.join(os.tmpdir(), "raavi-security-desktop-"));
  const app = await electron.launch({
    cwd: projectRoot,
    args: [path.join(projectRoot, "desktop/main.mjs"), `--user-data-dir=${profile}`],
  });
  try {
    // Verify isolation before interacting with any user state.
    expect(await app.evaluate(({ app }) => app.getPath("userData"))).toBe(profile);
    const page = await waitForRaaviWindow(app);
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
    const result = await app.evaluate(async ({ BrowserWindow }, root) => {
      const main = BrowserWindow.getAllWindows().find((window) => window.webContents.getURL().startsWith("http://127.0.0.1:"));
      if (!main) throw new Error("Main window unavailable");
      const other = new BrowserWindow({ show: false, webPreferences: {
        preload: `${root}/desktop/preload.cjs`, contextIsolation: true,
        nodeIntegration: false, sandbox: true,
      } });
      try {
        // Even another window loading the same trusted origin gets no privileges.
        await other.loadURL(main.webContents.getURL());
        return await other.webContents.executeJavaScript(`
          window.raaviDesktop.getLocalDocumentSnapshot().then(
            () => 'unexpected access', error => error.message
          )
        `);
      } finally { other.destroy(); }
    }, projectRoot.replaceAll("\\", "/"));
    expect(result).toContain("Untrusted IPC sender");
  } finally {
    await app.close();
    await rm(profile, { recursive: true, force: true });
  }
});
