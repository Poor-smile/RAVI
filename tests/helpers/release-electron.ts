import { _electron } from "playwright";
import path from "node:path";

// Run the complete native suite against one immutable release executable.
export const releaseElectron = {
  async launch(options: Parameters<typeof _electron.launch>[0] = {}) {
    const executablePath = process.env.RAAVI_RELEASE_EXECUTABLE;
    const root = path.resolve(options.cwd ?? process.cwd());
    const sourceEntries = new Set([root, path.join(root, "desktop", "main.mjs")]);
    const args = executablePath
      ? (options.args ?? []).filter(arg => arg.startsWith("--") || !sourceEntries.has(path.resolve(root, arg)))
      : options.args ?? [];
    const profile = args.find(arg => arg.startsWith("--user-data-dir="))?.slice("--user-data-dir=".length);
    if (!profile) throw new Error("Native release tests require an isolated --user-data-dir.");
    const app = await _electron.launch({ ...options, ...(executablePath ? { executablePath } : {}), args });
    try {
      const actual = await app.evaluate(({ app }) => ({ profile: app.getPath("userData"), executable: process.execPath }));
      if (path.resolve(actual.profile) !== path.resolve(root, profile)) throw new Error("Native test profile is not isolated.");
      if (executablePath && path.resolve(actual.executable).toLowerCase() !== path.resolve(executablePath).toLowerCase()) throw new Error("Native test did not launch the release executable.");
      // Close the document window through Chromium first: this exercises the
      // real checkpoint while its renderer and the native debugger remain alive.
      // The hidden diagram renderer must not be mistaken for the document window.
      const closeContext = app.close.bind(app);
      app.close = async () => {
        if (app.process().exitCode !== null || app.process().signalCode !== null) return;
        const mainPage = app.windows().find(page => /^http:\/\/127\.0\.0\.1:\d+\/$/.test(page.url()));
        if (mainPage && !mainPage.isClosed()) {
          const closed = mainPage.waitForEvent("close", { timeout: 45_000 });
          await mainPage.evaluate(() => { setTimeout(() => window.close(), 0); });
          await closed;
        }
        await closeContext();
      };
      return app;
    } catch (error) {
      await app.close();
      throw error;
    }
  },
};
