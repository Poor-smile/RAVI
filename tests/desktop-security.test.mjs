import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { createTrustedIpc, isTrustedAppUrl, isTrustedIpcSender } from "../desktop/ipc-security.mjs";
import { resolveUserDataPaths } from "../desktop/user-data-paths.mjs";

const origin = "http://127.0.0.1:3137";

test("navigation validates the entire origin and rejects credential/prefix tricks", () => {
  assert.equal(isTrustedAppUrl(`${origin}/?document=test#anchor`, origin), true);
  for (const value of [
    `${origin}@example.invalid/`, `${origin}0/`,
    "http://127.0.0.1:3138/", "http://localhost:3137/",
    "http://user@127.0.0.1:3137/", "https://127.0.0.1:3137/",
    "file:///etc/passwd", "javascript:alert(1)", "about:blank", "invalid",
  ]) assert.equal(isTrustedAppUrl(value, origin), false, value);
  assert.equal(isTrustedAppUrl(origin, undefined), false);
});

function senderFixture() {
  const frame = { url: origin };
  const contents = { mainFrame: frame };
  const window = { isDestroyed: () => false, webContents: contents };
  return { event: { sender: contents, senderFrame: frame }, context: { window, origin } };
}

test("native IPC requires the live main window, its main frame, and its origin", () => {
  const { event, context } = senderFixture();
  assert.equal(isTrustedIpcSender(event, context), true);
  assert.equal(isTrustedIpcSender({ ...event, sender: {} }, context), false);
  assert.equal(isTrustedIpcSender({ ...event, senderFrame: { url: origin } }, context), false);
  assert.equal(isTrustedIpcSender({ ...event, senderFrame: null }, context), false);
  event.senderFrame.url = "https://example.invalid";
  assert.equal(isTrustedIpcSender(event, context), false);
  assert.equal(isTrustedIpcSender(event, { window: null, origin }), false);
});

test("IPC guard rejects invokes and synchronous events before any native side effect", async () => {
  const { event, context } = senderFixture();
  const handlers = new Map();
  const listeners = new Map();
  const ipc = createTrustedIpc({
    handle: (name, fn) => handlers.set(name, fn),
    on: (name, fn) => listeners.set(name, fn),
  }, () => context);
  let calls = 0;
  ipc.handle("save", async (_event, value) => { calls++; return value; });
  ipc.on("save-sync", (_event) => { calls++; _event.returnValue = "saved"; });
  const foreign = { sender: {}, senderFrame: { url: origin } };
  assert.throws(() => handlers.get("save")(foreign, "data"), /Untrusted IPC/);
  listeners.get("save-sync")(foreign);
  assert.deepEqual(foreign.returnValue, { error: "Untrusted IPC sender." });
  assert.equal(calls, 0);
  assert.equal(await handlers.get("save")(event, "data"), "data");
  listeners.get("save-sync")(event);
  assert.equal(event.returnValue, "saved");
  assert.equal(calls, 2);
});

test("explicit profiles stay isolated and never trigger migration of the real profile", () => {
  const appData = path.resolve("profile-parent");
  const explicit = path.resolve("isolated-test-profile");
  assert.deepEqual(resolveUserDataPaths(appData, explicit), {
    directory: explicit, legacyDirectory: null,
  });
  assert.deepEqual(resolveUserDataPaths(appData), {
    directory: path.join(appData, "Raavi"),
    legacyDirectory: path.join(appData, "راوی"),
  });
});
