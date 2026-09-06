param(
  [Parameter(Mandatory=$true)][string]$ContractPath,
  [Parameter(Mandatory=$true)][string]$EvidenceDirectory,
  [string]$NodePath = "node",
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
  [switch]$PreflightOnly,
  [switch]$AllowUnsigned
)
$ErrorActionPreference = 'Stop'
$contractFile = (Resolve-Path -LiteralPath $ContractPath).Path
$contractRoot = Split-Path -Parent $contractFile
$contract = Get-Content -LiteralPath $contractFile -Raw | ConvertFrom-Json
$evidence = [IO.Path]::GetFullPath($EvidenceDirectory)
New-Item -ItemType Directory -Path $evidence -Force | Out-Null
$candidate = [IO.Path]::GetFullPath((Join-Path $contractRoot $contract.candidate.file))
$previous = [IO.Path]::GetFullPath((Join-Path $contractRoot $contract.previous.file))
foreach ($entry in @(@{Path=$candidate;Hash=$contract.candidate.sha256}, @{Path=$previous;Hash=$contract.previous.sha256})) {
  if ((Get-FileHash -LiteralPath $entry.Path -Algorithm SHA256).Hash -ne $entry.Hash) { throw "Installer identity mismatch: $($entry.Path)" }
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdministrator = ([Security.Principal.WindowsPrincipal]::new($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$signature = Get-AuthenticodeSignature -LiteralPath $candidate
function Get-RaaviInstallations {
  @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*') |
    ForEach-Object { Get-ItemProperty -Path $_ -ErrorAction SilentlyContinue } |
    Where-Object { $_.DisplayName -match '^(Raavi|راوی)(\s|$)' }
}
$existing = @(Get-RaaviInstallations)
$preflight = [ordered]@{ isAdministrator=$isAdministrator; authenticode=$signature.Status.ToString(); allowUnsigned=[bool]$AllowUnsigned; existingInstallations=$existing.Count; candidate=$candidate; previous=$previous; installerHashesMatch=$true; installationExecuted=$false }
$preflight | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $evidence 'preflight.json') -Encoding UTF8
if ($PreflightOnly) { $preflight | ConvertTo-Json; return }
if (!$isAdministrator) { throw 'Run in an elevated PowerShell on a disposable Windows test machine.' }
if ($existing.Count -ne 0) { throw 'This test requires a clean Windows test machine without Raavi installed.' }
if ($signature.Status -ne 'Valid' -and !($AllowUnsigned -and $signature.Status -eq 'NotSigned')) { throw 'The installer must have valid Windows Authenticode, or explicitly opt into testing a NotSigned release with -AllowUnsigned.' }

$installRoot = Join-Path ${env:ProgramFiles} ('Raavi Release Verification ' + [Guid]::NewGuid().ToString('N'))
$fixtureRoot = Join-Path $evidence 'داده پایدار'
New-Item -ItemType Directory -Path $fixtureRoot -Force | Out-Null
$document = Join-Path $fixtureRoot 'سند فارسی.md'
$documentText = "# سند فارسی`r`n`r`nاین متن باید پس از نصب، ارتقا و حذف باقی بماند. 📝`r`n"
[IO.File]::WriteAllText($document, $documentText, [Text.UTF8Encoding]::new($false))
$documentHash = (Get-FileHash -LiteralPath $document -Algorithm SHA256).Hash
$profile = Join-Path $env:APPDATA 'Raavi'
if (Test-Path -LiteralPath $profile) { throw 'The test requires a clean user profile without existing Raavi data.' }
New-Item -ItemType Directory -Path $profile | Out-Null
$sentinel = Join-Path $profile 'release-upgrade-preservation.json'
[IO.File]::WriteAllText($sentinel, '{"theme":"dark","note":"حفظ داده هنگام ارتقا"}', [Text.UTF8Encoding]::new($false))
$profileHash = (Get-FileHash -LiteralPath $sentinel -Algorithm SHA256).Hash
$results = [Collections.Generic.List[object]]::new()
function Record-Result([string]$Name, [object]$Details) {
  $results.Add([pscustomobject]@{name=$Name;passed=$true;details=$Details})
  $results | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $evidence 'install-upgrade-results.json') -Encoding UTF8
}
function Assert-Preserved {
  if ((Get-FileHash -LiteralPath $document -Algorithm SHA256).Hash -ne $documentHash) { throw 'Markdown content changed during installer operation.' }
  if ((Get-FileHash -LiteralPath $sentinel -Algorithm SHA256).Hash -ne $profileHash) { throw 'User profile data changed during installer operation.' }
}
function Install-Version([string]$Installer, [string]$Version) {
  # NSIS consumes the unquoted /D path as the final argument, including spaces.
  $process = Start-Process -FilePath $Installer -ArgumentList @('/S', "/D=$installRoot") -WindowStyle Hidden -PassThru
  if (!$process.WaitForExit(180000)) { throw 'Installer did not finish within three minutes; inspect the test VM.' }
  if ($process.ExitCode -ne 0) { throw "Installer exit code: $($process.ExitCode); reboot-required codes are not counted as a pass." }
  $preflight.installationExecuted = $true
  $preflight | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $evidence 'preflight.json') -Encoding UTF8
  $registrations = @(Get-RaaviInstallations)
  $registrations | Select-Object DisplayName, DisplayVersion, UninstallString, InstallLocation, PSPath | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $evidence "registry-$Version.json") -Encoding UTF8
  # NSIS stores InstallLocation in its separate application key. The uninstall
  # registration records the same directory in its quoted UninstallString.
  $installed = @($registrations | Where-Object {
    $uninstallMatch = [regex]::Match([string]$_.UninstallString, '^"([^"]+)"')
    $uninstallMatch.Success -and (Split-Path -Parent $uninstallMatch.Groups[1].Value).TrimEnd('\') -eq $installRoot.TrimEnd('\')
  })
  if ($installed.Count -ne 1 -or $installed[0].DisplayVersion -ne $Version) { throw 'Installed version or upgrade identity is incorrect.' }
  $exe = Join-Path $installRoot 'Raavi.exe'
  if (!(Test-Path -LiteralPath $exe)) { throw 'Installed executable is missing.' }
  foreach ($extension in @('.md', '.markdown')) {
    $key = Get-Item -LiteralPath "Registry::HKEY_LOCAL_MACHINE\Software\Classes\$extension"
    if ($key.GetValue('') -ne 'Raavi.Markdown') { throw "Missing association: $extension" }
  }
  $openCommand = (Get-Item -LiteralPath 'Registry::HKEY_LOCAL_MACHINE\Software\Classes\Raavi.Markdown\shell\open\command').GetValue('')
  if (!$openCommand.Contains($exe) -or !$openCommand.Contains('%1')) { throw 'File association does not point to the installed executable.' }
  foreach ($folder in @([Environment]::GetFolderPath('CommonDesktopDirectory'), [Environment]::GetFolderPath('CommonPrograms'))) {
    $shortcut = Join-Path $folder 'راوی.lnk'
    if (!(Test-Path -LiteralPath $shortcut)) { throw "Missing shortcut: $shortcut" }
    $shell = New-Object -ComObject WScript.Shell
    $actualTarget = $shell.CreateShortcut($shortcut).TargetPath
    [pscustomobject]@{ shortcut=$shortcut;actualTarget=$actualTarget;expectedTarget=$exe;targetExists=(Test-Path -LiteralPath $actualTarget) } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidence "shortcut-$Version-$([IO.Path]::GetFileName($folder)).json") -Encoding UTF8
    if ($actualTarget -ne $exe) { throw "Shortcut target does not match the installation: '$actualTarget' != '$exe'." }
  }
  Assert-Preserved
  Record-Result "installed-$Version" @{installLocation=$installRoot;associations=$true;shortcuts=$true;dataPreserved=$true}
}
function Uninstall-Version {
  $uninstaller = Join-Path $installRoot 'Uninstall Raavi.exe'
  if (!(Test-Path -LiteralPath $uninstaller)) { throw 'Expected uninstaller is missing.' }
  $process = Start-Process -FilePath $uninstaller -ArgumentList @('/S','/allusers') -WindowStyle Hidden -PassThru
  if (!$process.WaitForExit(180000) -or $process.ExitCode -ne 0) { throw 'Uninstaller did not complete successfully.' }
  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  while ((Test-Path -LiteralPath (Join-Path $installRoot 'Raavi.exe')) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 250 }
  if (Test-Path -LiteralPath (Join-Path $installRoot 'Raavi.exe')) { throw 'Executable remains after uninstall.' }
  if (@(Get-RaaviInstallations).Count -ne 0) { throw 'Uninstall registration remains.' }
  if (Test-Path -LiteralPath 'Registry::HKEY_LOCAL_MACHINE\Software\Classes\Raavi.Markdown') { throw 'File association remains after uninstall.' }
  Assert-Preserved
  Record-Result 'uninstalled' @{dataPreserved=$true;associationRemoved=$true}
}

# Fresh final installation, then an actual upgrade from the verified public version.
Install-Version $candidate $contract.candidate.version
if ((Get-FileHash -LiteralPath (Join-Path $installRoot 'resources\app.asar') -Algorithm SHA256).Hash -ne $contract.candidate.asarSha256) { throw 'Installed payload differs from the fully tested candidate.' }
Uninstall-Version
Install-Version $previous $contract.previous.version
$probe = Join-Path $ProjectRoot 'scripts/check-installed-upgrade.mts'
$probeEvidence = Join-Path $evidence 'upgrade-document.json'
Push-Location -LiteralPath $ProjectRoot
try {
  & $NodePath --import tsx $probe seed (Join-Path $installRoot 'Raavi.exe') $profile $document $probeEvidence
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the real saved document/comment in the previous version.' }
  & $NodePath --import tsx $probe baseline (Join-Path $installRoot 'Raavi.exe') $profile $document $probeEvidence
  if ($LASTEXITCODE -ne 0) { throw 'Could not reopen the saved document with the previous version before upgrade.' }
} finally { Pop-Location }
$documentHash = (Get-FileHash -LiteralPath $document -Algorithm SHA256).Hash
Install-Version $candidate $contract.candidate.version
if ((Get-FileHash -LiteralPath (Join-Path $installRoot 'resources\app.asar') -Algorithm SHA256).Hash -ne $contract.candidate.asarSha256) { throw 'Upgraded payload differs from the fully tested candidate.' }
$installedSignature = (Get-AuthenticodeSignature -LiteralPath (Join-Path $installRoot 'Raavi.exe')).Status.ToString()
if ($installedSignature -ne 'Valid' -and !($AllowUnsigned -and $installedSignature -eq 'NotSigned')) { throw 'Installed application signature is invalid.' }
Push-Location -LiteralPath $ProjectRoot
try {
  & $NodePath --import tsx $probe verify (Join-Path $installRoot 'Raavi.exe') $profile $document $probeEvidence
  if ($LASTEXITCODE -ne 0) { throw 'Installed upgrade did not preserve the real document and comment.' }
} finally { Pop-Location }
Record-Result 'fresh-install-and-upgrade' @{from=$contract.previous.version;to=$contract.candidate.version;payloadIdentical=$true;installerAuthenticode=$signature.Status.ToString();applicationAuthenticode=$installedSignature;allowUnsigned=[bool]$AllowUnsigned}
Write-Output "Installer checks passed. Installed application retained for manual Windows file-association open testing: $installRoot"
