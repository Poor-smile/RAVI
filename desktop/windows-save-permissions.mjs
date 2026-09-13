import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import os from "node:os";
import { isMainThread } from "node:worker_threads";
import { runNativeTask } from "./native-task-runner.mjs";

const execute = promisify(execFile);
let replacementStarted = false;
// Use the Windows .NET API to attach the original security descriptor when the
// empty temporary file is created, before any document bytes can reach it.
const script = `
$ErrorActionPreference = 'Stop'
$security = [System.IO.File]::GetAccessControl($env:RAAVI_SAVE_SOURCE)
$stream = [System.IO.FileStream]::new(
  $env:RAAVI_SAVE_TEMPORARY,
  [System.IO.FileMode]::CreateNew,
  [System.Security.AccessControl.FileSystemRights]::Write,
  [System.IO.FileShare]::None,
  4096,
  [System.IO.FileOptions]::None,
  $security
)
$stream.Dispose()
`;

export async function createWindowsReplacement(source, temporary) {
  replacementStarted = true;
  if (isMainThread) return runNativeTask("windows-replacement", { source, temporary });
  const powershell = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  await execute(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], {
    env: { ...process.env, RAAVI_SAVE_SOURCE: path.toNamespacedPath(source), RAAVI_SAVE_TEMPORARY: path.toNamespacedPath(temporary) },
    windowsHide: true,
    timeout: 15_000,
    maxBuffer: 64 * 1024,
  });
}

// The first PowerShell/.NET launch on Windows can take several seconds. Warm
// the exact ACL-preserving operation after the UI is usable, on owned empty
// scratch files only. Actual saves retain the same validation and atomic path.
export async function warmWindowsSavePermissions() {
  if (process.platform !== "win32" || replacementStarted) return;
  replacementStarted = true;
  const directory = await mkdtemp(path.join(os.tmpdir(), "raavi-save-warm-"));
  const source = path.join(directory, "source.tmp");
  const replacement = path.join(directory, "replacement.tmp");
  try {
    await writeFile(source, "", { flag: "wx" });
    await createWindowsReplacement(source, replacement);
  } finally {
    await unlink(replacement).catch(() => {});
    await unlink(source).catch(() => {});
    await rmdir(directory).catch(() => {});
  }
}
