param(
  [string]$SourceRoot = "D:\raavi-f5-build\model",
  [string]$RuntimeArchive = "D:\raavi-f5-build\runtime\f5ipa-runtime-py311-raavi1.zip",
  [string]$ReleaseRoot = "D:\raavi-f5-build\release-v1"
)

$ErrorActionPreference = "Stop"
$engineRoot = Join-Path $ReleaseRoot "f5ipa"
$runtimeRoot = Join-Path $ReleaseRoot "runtime"
New-Item -ItemType Directory -Force -Path $engineRoot, $runtimeRoot | Out-Null

$files = @(
  "speech\model.safetensors",
  "speech\vocab.txt",
  "speech\config.yaml",
  "g2p\model.safetensors",
  "g2p\added_tokens.json",
  "g2p\config.json",
  "g2p\generation_config.json",
  "g2p\tokenizer_config.json",
  "vocos\pytorch_model.bin",
  "vocos\config.yaml",
  "NOTICE.md",
  "reference.wav"
)

foreach ($relative in $files) {
  $source = Join-Path $SourceRoot $relative
  if (-not (Test-Path -LiteralPath $source)) {
    throw "F5 IPA release asset is missing: $source"
  }
  $target = Join-Path $engineRoot $relative
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
}

Copy-Item -LiteralPath (Join-Path $PSScriptRoot "..\desktop\licenses\f5ipa-attribution.txt") `
  -Destination (Join-Path $engineRoot "ATTRIBUTION.txt") -Force
Copy-Item -LiteralPath $RuntimeArchive `
  -Destination (Join-Path $runtimeRoot "f5ipa-runtime-py311-raavi1.zip") -Force

Write-Output "Persian IPA F5-TTS release staged at $ReleaseRoot"
