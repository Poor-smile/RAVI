param(
  [string]$HostName = "3264450084.cloudydl.com",
  [string]$LocalRoot = "$env:LOCALAPPDATA\Temp\raavi-tts-release-v1",
  [string]$RemoteRoot = "/domains/pz24978.parspack.net/public_html/downloads/raavi/tts/v1"
)

$ErrorActionPreference = "Stop"
$Uploader = Join-Path $PSScriptRoot "upload-tts-models.py"
python $Uploader --host $HostName --local-root $LocalRoot --remote-root $RemoteRoot
if ($LASTEXITCODE -ne 0) { throw "TTS model upload failed." }
