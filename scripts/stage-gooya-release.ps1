[CmdletBinding()]
param(
  [string]$SourceRoot = (Join-Path $env:TEMP "raavi-gooya-audit\models"),
  [string]$ReleaseRoot = (Join-Path $env:LOCALAPPDATA "Temp\raavi-tts-release-v1")
)

$ErrorActionPreference = "Stop"
$target = Join-Path $ReleaseRoot "gooya"
New-Item -ItemType Directory -Path $target -Force | Out-Null

$files = @(
  @{ Source = "gooya\pytorch_model.bin"; Target = "gooya\pytorch_model.bin" },
  @{ Source = "gooya\__init__.py"; Target = "gooya\__init__.py" },
  @{ Source = "gooya\config.json"; Target = "gooya\config.json" },
  @{ Source = "gooya\configuration_moss_tts_nano.py"; Target = "gooya\configuration_moss_tts_nano.py" },
  @{ Source = "gooya\gpt2_decoder.py"; Target = "gooya\gpt2_decoder.py" },
  @{ Source = "gooya\modeling_moss_tts_nano.py"; Target = "gooya\modeling_moss_tts_nano.py" },
  @{ Source = "gooya\prompting.py"; Target = "gooya\prompting.py" },
  @{ Source = "gooya\special_tokens_map.json"; Target = "gooya\special_tokens_map.json" },
  @{ Source = "gooya\tokenization_moss_tts_nano.py"; Target = "gooya\tokenization_moss_tts_nano.py" },
  @{ Source = "gooya\tokenizer_config.json"; Target = "gooya\tokenizer_config.json" },
  @{ Source = "gooya\tokenizer.model"; Target = "gooya\tokenizer.model" },
  @{ Source = "gooya\gate_c\00_manaref.wav"; Target = "reference.wav" },
  @{ Source = "g2p\model.safetensors"; Target = "g2p\model.safetensors" },
  @{ Source = "g2p\config.json"; Target = "g2p\config.json" },
  @{ Source = "g2p\generation_config.json"; Target = "g2p\generation_config.json" },
  @{ Source = "g2p\tokenizer_config.json"; Target = "g2p\tokenizer_config.json" },
  @{ Source = "g2p\added_tokens.json"; Target = "g2p\added_tokens.json" },
  @{ Source = "g2p\special_tokens_map.json"; Target = "g2p\special_tokens_map.json" },
  @{ Source = "g2p\overlay.json"; Target = "g2p\overlay.json" },
  @{ Source = "codec\model-00001-of-00001.safetensors"; Target = "codec\model-00001-of-00001.safetensors" },
  @{ Source = "codec\model.safetensors.index.json"; Target = "codec\model.safetensors.index.json" },
  @{ Source = "codec\__init__.py"; Target = "codec\__init__.py" },
  @{ Source = "codec\config.json"; Target = "codec\config.json" },
  @{ Source = "codec\configuration_moss_audio_tokenizer.py"; Target = "codec\configuration_moss_audio_tokenizer.py" },
  @{ Source = "codec\modeling_moss_audio_tokenizer.py"; Target = "codec\modeling_moss_audio_tokenizer.py" }
)

foreach ($entry in $files) {
  $source = Join-Path $SourceRoot $entry.Source
  $destination = Join-Path $target $entry.Target
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Missing Gooya release file: $source"
  }
  New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination -Force
}

Copy-Item -LiteralPath (Join-Path $PSScriptRoot "..\desktop\licenses\gooya-attribution.txt") `
  -Destination (Join-Path $target "LICENSE-NOTICE.txt") -Force

Get-ChildItem -LiteralPath $target -Recurse -File |
  Sort-Object FullName |
  Select-Object FullName, Length, @{ Name = "Sha256"; Expression = { (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() } }
