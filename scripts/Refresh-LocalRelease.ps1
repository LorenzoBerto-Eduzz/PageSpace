$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRoot = Join-Path $repositoryRoot 'project'
$reviewRoot = Join-Path $projectRoot 'dist\PageSpace'
$releaseParent = Join-Path $repositoryRoot 'localrelease'
$releaseRoot = Join-Path $releaseParent 'PageSpace'
$releasePages = Join-Path $releaseRoot 'Pages'
$releaseZip = Join-Path $releaseParent 'PageSpace.zip'
$zipStagingParent = Join-Path $releaseParent '.zip-staging'
$zipStagingRoot = Join-Path $zipStagingParent 'PageSpace'

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

if (-not (Test-Path -LiteralPath (Join-Path $releaseRoot 'PageSpace.exe'))) {
  throw 'A atualização da localrelease não produziu PageSpace.exe.'
}

if (Test-Path -LiteralPath $zipStagingParent) {
  Remove-Item -LiteralPath $zipStagingParent -Recurse -Force
}
New-Item -ItemType Directory -Path $zipStagingRoot | Out-Null
Get-ChildItem -LiteralPath $releaseRoot -Force |
  Where-Object { $_.Name -ne 'Pages' } |
  Copy-Item -Destination $zipStagingRoot -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $zipStagingRoot 'Pages') | Out-Null
if (Test-Path -LiteralPath $releaseZip) {
  Remove-Item -LiteralPath $releaseZip -Force
}
Compress-Archive -LiteralPath $zipStagingRoot -DestinationPath $releaseZip -CompressionLevel Optimal
Remove-Item -LiteralPath $zipStagingParent -Recurse -Force

Write-Output "localrelease atualizada preservando Pages em: $releaseRoot"
Write-Output "arquivo ZIP limpo atualizado em: $releaseZip"
