$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRoot = Join-Path $repositoryRoot 'project'
$releaseParent = Join-Path $repositoryRoot 'localrelease'
$releaseRoot = Join-Path $releaseParent 'PageSpace'
$releasePages = Join-Path $releaseRoot 'Pages'
$releaseZip = Join-Path $releaseParent 'PageSpace.zip'
$stagingParent = Join-Path $releaseParent '.remote-release-staging'
$stagingRoot = Join-Path $stagingParent 'PageSpace'

if (-not (Test-Path -LiteralPath (Join-Path $releaseRoot 'PageSpace.exe'))) {
  throw 'A localrelease do PageSpace ainda não foi criada.'
}

$packageVersion = (Get-Content -Raw (Join-Path $projectRoot 'package.json') | ConvertFrom-Json).version
$manifest = Get-Content -Raw (Join-Path $releaseRoot 'pagespace-release.json') | ConvertFrom-Json
if ($manifest.schemaVersion -ne 1 -or $manifest.version -ne $packageVersion) {
  throw 'O manifesto da localrelease não corresponde à versão do projeto.'
}

if ((Get-ChildItem -LiteralPath $releasePages -Force).Count -ne 0) {
  throw 'A pasta Pages precisa estar vazia antes de criar o ZIP remoto.'
}

$forbiddenEntries = Get-ChildItem -LiteralPath $releaseRoot -Recurse -Force |
  Where-Object {
    $_.Name -in @('.git', '.pagemaker', '.pagespace', '.git-identity', '.env') -or
    $_.Name -like '.env.*'
  }
if ($forbiddenEntries) {
  throw 'A localrelease contém arquivos privados ou internos proibidos.'
}

if (Test-Path -LiteralPath $stagingParent) {
  Remove-Item -LiteralPath $stagingParent -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingRoot | Out-Null
Get-ChildItem -LiteralPath $releaseRoot -Force |
  Copy-Item -Destination $stagingRoot -Recurse -Force

if (Test-Path -LiteralPath $releaseZip) {
  Remove-Item -LiteralPath $releaseZip -Force
}
Compress-Archive -LiteralPath $stagingRoot -DestinationPath $releaseZip -CompressionLevel Optimal
Remove-Item -LiteralPath $stagingParent -Recurse -Force

Write-Output "ZIP remoto criado em: $releaseZip"
