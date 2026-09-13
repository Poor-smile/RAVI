import assert from "node:assert/strict";
import test from "node:test";
import {
  chatGPTStateFromConnection,
  firstRunProviderSelection,
  shouldAutoOpenFirstRun,
} from "../app/first-run-state";
import {
  DEFAULT_BACKUP_STATUS,
  type BackupProviderConnections,
} from "../app/backup/policy";

test("first run accepts an existing ChatGPT connection", () => {
  assert.equal(
    chatGPTStateFromConnection({ state: "connected" }),
    "connected",
  );
  assert.equal(
    chatGPTStateFromConnection({ state: "auth_required" }),
    "auth_required",
  );
  assert.equal(
    chatGPTStateFromConnection({ state: "cli_missing" }),
    "cli_missing",
  );
  assert.equal(
    chatGPTStateFromConnection({ state: "auth_waiting" }),
    "auth_waiting",
  );
  assert.equal(
    chatGPTStateFromConnection({ state: "connection_error" }),
    "connection_error",
  );
});

test("first run detects every already connected cloud provider", () => {
  const connections: BackupProviderConnections = {
    "google-drive": { state: "connected", accountEmail: "user@example.com" },
    "proton-drive": { state: "connected", accountEmail: "" },
  };
  const result = firstRunProviderSelection(
    {
      ...DEFAULT_BACKUP_STATUS,
      providerId: "google-drive",
      connection: connections["google-drive"],
    },
    connections,
  );

  assert.equal(result.selectedProvider, "google-drive");
  assert.equal(result.states["google-drive"], "selected");
  assert.equal(result.states["proton-drive"], "connected");
});

test("a connected but inactive provider is reusable without another login", () => {
  const result = firstRunProviderSelection(
    DEFAULT_BACKUP_STATUS,
    {
      "google-drive": { state: "disconnected", accountEmail: "" },
      "proton-drive": { state: "connected", accountEmail: "" },
    },
  );

  assert.equal(result.selectedProvider, null);
  assert.equal(result.states["proton-drive"], "connected");
  assert.equal(result.states["google-drive"], "idle");
});

test("automatic tour is limited to a new installation, independently of account connections", () => {
  assert.equal(shouldAutoOpenFirstRun({ firstLaunch: true }, false), true);
  assert.equal(shouldAutoOpenFirstRun({ firstLaunch: true }, true), false);
  assert.equal(shouldAutoOpenFirstRun({ firstLaunch: false }, false), false);
  assert.equal(shouldAutoOpenFirstRun({ firstLaunch: false }, true), false);
});
