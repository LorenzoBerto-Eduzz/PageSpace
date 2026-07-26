$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\project')).Path
$reviewRoot = Join-Path $projectRoot 'dist\PageMaker'
$localReleaseParent = Join-Path $projectRoot 'dist\localrelease'
$localReleaseRoot = Join-Path $localReleaseParent 'PageMaker'

Push-Location $projectRoot
try {
  & npm.cmd run build:unpack
  if ($LASTEXITCODE -ne 0) {
    throw 'A compilação da cópia de desenvolvimento do PageMaker falhou.'
  }
}
finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath (Join-Path $reviewRoot 'PageMaker.exe'))) {
  throw "O executável esperado não foi encontrado: $reviewRoot"
}

if (Test-Path -LiteralPath $localReleaseParent) {
  $resolvedDist = (Resolve-Path (Join-Path $projectRoot 'dist')).Path
  $resolvedTarget = (Resolve-Path $localReleaseParent).Path
  if (-not $resolvedTarget.StartsWith($resolvedDist, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Destino de localrelease inválido: $resolvedTarget"
  }

  Remove-Item -LiteralPath $localReleaseParent -Recurse -Force
}

New-Item -ItemType Directory -Path $localReleaseRoot | Out-Null

Get-ChildItem -LiteralPath $reviewRoot -Force |
  Where-Object { $_.Name -ne 'Pages' } |
  Copy-Item -Destination $localReleaseRoot -Recurse -Force

New-Item -ItemType Directory -Path (Join-Path $localReleaseRoot 'Pages') | Out-Null

$forbiddenEntries = Get-ChildItem -LiteralPath $localReleaseRoot -Recurse -Force |
  Where-Object {
    $_.Name -in @('.git', '.pagemaker', '.git-identity', '.env') -or
    $_.Name -like '.env.*'
  }

if ($forbiddenEntries) {
  $paths = ($forbiddenEntries | Select-Object -ExpandProperty FullName) -join [Environment]::NewLine
  throw "A localrelease contém arquivos privados ou internos proibidos:$([Environment]::NewLine)$paths"
}

$pageEntries = Get-ChildItem -LiteralPath (Join-Path $localReleaseRoot 'Pages') -Force
if ($pageEntries) {
  throw 'A pasta Pages da localrelease não está vazia.'
}

Write-Output "localrelease limpa criada em: $localReleaseRoot"
