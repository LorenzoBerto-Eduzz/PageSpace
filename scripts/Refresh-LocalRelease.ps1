$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRoot = Join-Path $repositoryRoot 'project'
$reviewRoot = Join-Path $projectRoot 'dist\PageSpace'
$releaseParent = Join-Path $repositoryRoot 'localrelease'
$releaseRoot = Join-Path $releaseParent 'PageSpace'
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

$resolvedRepository = $repositoryRoot
$resolvedRelease = (Resolve-Path $releaseRoot).Path
if (-not $resolvedRelease.StartsWith($resolvedRepository, [System.StringComparison]::OrdinalIgnoreCase)) {
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

$packageVersion = (Get-Content -Raw (Join-Path $projectRoot 'package.json') | ConvertFrom-Json).version
if ($packageVersion -notmatch '^\d+\.\d+\.\d+$') {
  throw "Versão inválida no package.json: $packageVersion"
}
$releaseManifest = @{ schemaVersion = 1; version = $packageVersion } | ConvertTo-Json -Compress
[IO.File]::WriteAllText(
  (Join-Path $releaseRoot 'pagespace-release.json'),
  $releaseManifest,
  (New-Object Text.UTF8Encoding($false))
)

if (-not (Test-Path -LiteralPath (Join-Path $releaseRoot 'PageSpace.exe'))) {
  throw 'A atualização da localrelease não produziu PageSpace.exe.'
}

Write-Output "localrelease atualizada preservando Pages em: $releaseRoot"
