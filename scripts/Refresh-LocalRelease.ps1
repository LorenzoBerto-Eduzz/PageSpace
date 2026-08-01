$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\project')).Path
$reviewRoot = Join-Path $projectRoot 'dist\PageSpace'
$releaseRoot = Join-Path $projectRoot 'dist\localrelease\PageSpace'
$releasePages = Join-Path $releaseRoot 'Pages'

Push-Location $projectRoot
try {
  & npm.cmd run build:unpack
  if ($LASTEXITCODE -ne 0) {
    throw 'A compilação da cópia de desenvolvimento do PageSpace falhou.'
  }
}
finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath (Join-Path $reviewRoot 'PageSpace.exe'))) {
  throw "O executável esperado não foi encontrado: $reviewRoot"
}

if (-not (Test-Path -LiteralPath $releaseRoot)) {
  throw 'A localrelease ainda não existe. Execute primeiro npm run export:localrelease.'
}

$resolvedDist = (Resolve-Path (Join-Path $projectRoot 'dist')).Path
$resolvedRelease = (Resolve-Path $releaseRoot).Path
if (-not $resolvedRelease.StartsWith($resolvedDist, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Destino de localrelease inválido: $resolvedRelease"
}

if (-not (Test-Path -LiteralPath $releasePages)) {
  New-Item -ItemType Directory -Path $releasePages | Out-Null
}

Get-ChildItem -LiteralPath $releaseRoot -Force |
  Where-Object { $_.Name -ne 'Pages' } |
  Remove-Item -Recurse -Force

Get-ChildItem -LiteralPath $reviewRoot -Force |
  Where-Object { $_.Name -ne 'Pages' } |
  Copy-Item -Destination $releaseRoot -Recurse -Force

if (-not (Test-Path -LiteralPath (Join-Path $releaseRoot 'PageSpace.exe'))) {
  throw 'A atualização da localrelease não produziu PageSpace.exe.'
}

Write-Output "localrelease atualizada preservando Pages em: $releaseRoot"
