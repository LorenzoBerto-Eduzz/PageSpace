$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\project')).Path
$releaseRoot = Join-Path $projectRoot 'dist\PageMaker'
$buildOutput = Join-Path $projectRoot 'dist\win-unpacked'
$pagesPath = Join-Path $releaseRoot 'Pages'
$legacyPagesPath = Join-Path $buildOutput 'Pages'
$backupPath = Join-Path $projectRoot 'dist\.pagemaker-pages-backup'
$pagesWereMoved = $false

if (Test-Path -LiteralPath $backupPath) {
  throw "A recuperação anterior da pasta Pages não foi concluída: $backupPath"
}

if (Test-Path -LiteralPath $pagesPath) {
  Move-Item -LiteralPath $pagesPath -Destination $backupPath
  $pagesWereMoved = $true
}
elseif (Test-Path -LiteralPath $legacyPagesPath) {
  Move-Item -LiteralPath $legacyPagesPath -Destination $backupPath
  $pagesWereMoved = $true
}

try {
  Push-Location $projectRoot
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw 'A compilação do PageMaker falhou.'
  }

  & .\node_modules\.bin\electron-builder.cmd --dir
  if ($LASTEXITCODE -ne 0) {
    throw 'O empacotamento portátil do PageMaker falhou.'
  }

  if (Test-Path -LiteralPath $releaseRoot) {
    Remove-Item -LiteralPath $releaseRoot -Recurse -Force
  }

  Move-Item -LiteralPath $buildOutput -Destination $releaseRoot
}
finally {
  Pop-Location

  if ($pagesWereMoved -and (Test-Path -LiteralPath $backupPath)) {
    if (-not (Test-Path -LiteralPath $releaseRoot)) {
      New-Item -ItemType Directory -Path $releaseRoot | Out-Null
    }

    Move-Item -LiteralPath $backupPath -Destination $pagesPath
  }
}
