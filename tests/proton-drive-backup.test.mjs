import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createProtonDriveBackupProvider,
  protonDriveBackupInternals,
} from "../desktop/proton-drive-backup.mjs";

test("Proton Drive provider uses browser login and keeps credentials out of Raavi", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-proton-"));
  const cliPath = path.join(temporary, "proton-drive.exe");
  await writeFile(cliPath, "test-cli");
  let loggedIn = false;
  let openedUrl = "";
  const calls = [];
  const provider = createProtonDriveBackupProvider({
    userDataPath: temporary,
    cliPath,
    verifyCli: async () => true,
    openExternal: async (url) => {
      openedUrl = url;
    },
    runCommand: async (_executable, args, options = {}) => {
      calls.push(args);
      if (args[0] === "auth" && args[1] === "login") {
        options.onOutput?.(
          "Open following URL manually:\nhttps://account.proton.me/desktop/login?app=drive#payload=test\n",
        );
        loggedIn = true;
        return { exitCode: 0, stdout: "", stderr: "" };
      }
      if (args[0] === "filesystem" && args[1] === "list") {
        return loggedIn
          ? { exitCode: 0, stdout: "[]", stderr: "" }
          : { exitCode: 1, stdout: "You need to login first", stderr: "" };
      }
      return { exitCode: 0, stdout: "", stderr: "" };
    },
  });
  try {
    assert.equal((await provider.connectionInfo()).state, "disconnected");
    assert.deepEqual(await provider.connect(), {
      state: "connected",
      accountEmail: "",
      quota: null,
    });
    assert.deepEqual(calls.find((args) => args[0] === "auth"), ["auth", "login"]);
    assert.equal(
      openedUrl,
      "https://account.proton.me/desktop/login?app=drive#payload=test",
    );
    assert.equal(
      calls.flat().some((value) => /password|secret|token/iu.test(String(value))),
      false,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("Proton login URL extraction only accepts the official account origin", () => {
  assert.equal(
    protonDriveBackupInternals.protonLoginUrl(
      "Open manually: https://account.proton.me/desktop/login?app=drive#payload=abc",
    ),
    "https://account.proton.me/desktop/login?app=drive#payload=abc",
  );
  assert.equal(
    protonDriveBackupInternals.protonLoginUrl(
      "https://account.proton.me.evil.example/desktop/login?payload=abc",
    ),
    "",
  );
});

test("Proton Drive uploads a replaceable Vault folder with retained metadata and media", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-proton-"));
  const cliPath = path.join(temporary, "proton-drive.exe");
  await writeFile(cliPath, "test-cli");
  let captured = null;
  const provider = createProtonDriveBackupProvider({
    userDataPath: temporary,
    cliPath,
    verifyCli: async () => true,
    now: () => Date.UTC(2026, 7, 26, 10, 0, 0),
    runCommand: async (_executable, args) => {
      if (args[0] === "filesystem" && args[1] === "upload") {
        const localPath = args.at(-3);
        captured = {
          args,
          metadata: JSON.parse(
            await readFile(path.join(localPath, "raavi-metadata.json"), "utf8"),
          ),
          markdown: await readFile(path.join(localPath, "یادداشت.md"), "utf8"),
        };
      }
      return { exitCode: 0, stdout: "[]", stderr: "" };
    },
  });
  try {
    const remote = await provider.uploadDocument({
      documentId: "0123456789abcdef0123456789abcdef",
      payload: {
        fileName: "یادداشت.md",
        content: "# متن نهایی",
        annotations: [{ id: "comment-1" }],
        versions: [{ id: "version-1", savedAt: "2026-08-25T10:00:00.000Z" }],
        assets: [
          {
            id: "image-1",
            name: "cover.webp",
            mimeType: "image/webp",
            data: Buffer.from("optimized-image").toString("base64"),
          },
        ],
        audioAssets: [
          {
            id: "audio-1",
            name: "voice.opus",
            mimeType: "audio/ogg",
            data: Buffer.from("compressed-audio").toString("base64"),
          },
        ],
        attachments: [],
        backupCategories: {
          textAndStructure: true,
          optimizedImages: true,
          audio: true,
          otherAttachments: false,
          versionHistory: true,
        },
      },
    });
    assert.equal(
      remote.remoteId,
      "/my-files/Raavi/Vault/0123456789abcdef0123456789abcdef",
    );
    assert.equal(captured.markdown, "# متن نهایی");
    assert.equal(captured.metadata.provider, "proton-drive");
    assert.equal(captured.metadata.versions.length, 1);
    assert.equal(captured.metadata.assets.length, 1);
    assert.equal(captured.metadata.audio.length, 1);
    assert.ok(captured.args.includes("replace"));
    assert.ok(captured.args.includes("--skip-thumbnails"));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("Proton Drive rejects an unverified executable", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-proton-"));
  const cliPath = path.join(temporary, "proton-drive.exe");
  await writeFile(cliPath, "not-official");
  const provider = createProtonDriveBackupProvider({
    userDataPath: temporary,
    cliPath,
    verifyCli: async () => false,
  });
  try {
    await assert.rejects(
      provider.connect(),
      (error) => error?.code === "proton-cli-checksum",
    );
    assert.equal(
      protonDriveBackupInternals.PROTON_DRIVE_CLI_VERSION,
      "0.8.0",
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("Proton Drive reports an unreachable network instead of a false busy process", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-proton-"));
  const cliPath = path.join(temporary, "proton-drive.exe");
  await writeFile(cliPath, "test-cli");
  const provider = createProtonDriveBackupProvider({
    userDataPath: temporary,
    cliPath,
    verifyCli: async () => true,
    runCommand: async (_executable, args) =>
      args[0] === "filesystem"
        ? {
            exitCode: 1,
            stdout: "You need to login first",
            stderr: "",
          }
        : {
            exitCode: 1,
            stdout:
              "Unable to connect. Is the computer able to access the url?",
            stderr: "",
          },
  });
  try {
    await assert.rejects(
      provider.connect(),
      (error) => error?.code === "proton-network",
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("Proton Drive lists metadata and downloads a selected Vault folder", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "raavi-proton-restore-"));
  const cliPath = path.join(temporary, "proton-drive.exe");
  const documentId = "0123456789abcdef0123456789abcdef";
  await writeFile(cliPath, "test-cli");
  const metadata = {
    format: "raavi-vault-metadata",
    version: 1,
    provider: "proton-drive",
    documentId,
    backedUpAt: "2026-08-26T10:00:00.000Z",
    fileName: "یادداشت.md",
    annotations: [],
    versions: [{ number: 1, content: "# قبلی" }],
    assets: [
      {
        id: "image-1",
        name: "cover.webp",
        mimeType: "image/webp",
        file: "Assets/image.webp",
      },
    ],
    audio: [],
    attachments: [],
    categories: { textAndStructure: true, optimizedImages: true },
  };
  const provider = createProtonDriveBackupProvider({
    userDataPath: temporary,
    cliPath,
    verifyCli: async () => true,
    runCommand: async (_executable, args) => {
      if (args[0] === "filesystem" && args[1] === "list") {
        return {
          exitCode: 0,
          stdout: JSON.stringify([
            {
              type: "folder",
              name: { ok: true, value: documentId },
              modificationTime: "2026-08-26T10:00:00.000Z",
            },
          ]),
          stderr: "",
        };
      }
      if (args[0] === "filesystem" && args[1] === "download") {
        const remotePath = args.at(-3);
        const localFolder = args.at(-2);
        if (remotePath.endsWith("raavi-metadata.json")) {
          await mkdir(localFolder, { recursive: true });
          await writeFile(
            path.join(localFolder, "raavi-metadata.json"),
            JSON.stringify(metadata),
            "utf8",
          );
        } else {
          const documentRoot = path.join(localFolder, documentId);
          await mkdir(path.join(documentRoot, "Assets"), { recursive: true });
          await writeFile(
            path.join(documentRoot, "raavi-metadata.json"),
            JSON.stringify(metadata),
            "utf8",
          );
          await writeFile(path.join(documentRoot, "یادداشت.md"), "# متن نهایی", "utf8");
          await writeFile(path.join(documentRoot, "Assets", "image.webp"), "image-bytes");
        }
        return { exitCode: 0, stdout: "{}", stderr: "" };
      }
      return { exitCode: 0, stdout: "[]", stderr: "" };
    },
  });
  try {
    const list = await provider.listBackups();
    assert.equal(list.length, 1);
    assert.equal(list[0].fileName, "یادداشت.md");
    const restored = await provider.downloadBackup(documentId);
    assert.equal(restored.content, "# متن نهایی");
    assert.equal(
      Buffer.from(restored.assets[0].data, "base64").toString("utf8"),
      "image-bytes",
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
