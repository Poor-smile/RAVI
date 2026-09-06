import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
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
  const powershell = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  await execute(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], {
    env: { ...process.env, RAAVI_SAVE_SOURCE: path.toNamespacedPath(source), RAAVI_SAVE_TEMPORARY: path.toNamespacedPath(temporary) },
    windowsHide: true,
    timeout: 15_000,
    maxBuffer: 64 * 1024,
  });
}
