$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRoot = Join-Path $repositoryRoot 'project'
$reviewRoot = Join-Path $projectRoot 'dist\PageSpace'
$localReleaseParent = Join-Path $repositoryRoot 'localrelease'
$localReleaseRoot = Join-Path $localReleaseParent 'PageSpace'
$localReleaseZip = Join-Path $localReleaseParent 'PageSpace.zip'

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

if (Test-Path -LiteralPath $localReleaseParent) {
  $resolvedRepository = $repositoryRoot
  $resolvedTarget = (Resolve-Path $localReleaseParent).Path
  if (-not $resolvedTarget.StartsWith($resolvedRepository, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Destino de localrelease inválido: $resolvedTarget"
  }

  Remove-Item -LiteralPath $localReleaseParent -Recurse -Force
}

New-Item -ItemType Directory -Path $localReleaseRoot | Out-Null

Get-ChildItem -LiteralPath $reviewRoot -Force |
  Where-Object { $_.Name -ne 'Pages' } |
  Copy-Item -Destination $localReleaseRoot -Recurse -Force

New-Item -ItemType Directory -Path (Join-Path $localReleaseRoot 'Pages') | Out-Null

$packageVersion = (Get-Content -Raw (Join-Path $projectRoot 'package.json') | ConvertFrom-Json).version
if ($packageVersion -notmatch '^\d+\.\d+\.\d+$') {
  throw "Versão inválida no package.json: $packageVersion"
}
$releaseManifest = @{ schemaVersion = 1; version = $packageVersion } | ConvertTo-Json -Compress
[IO.File]::WriteAllText(
  (Join-Path $localReleaseRoot 'pagespace-release.json'),
  $releaseManifest,
  (New-Object Text.UTF8Encoding($false))
)

$forbiddenEntries = Get-ChildItem -LiteralPath $localReleaseRoot -Recurse -Force |
  Where-Object {
    $_.Name -in @('.git', '.pagemaker', '.pagespace', '.git-identity', '.env') -or
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

Compress-Archive -LiteralPath $localReleaseRoot -DestinationPath $localReleaseZip -CompressionLevel Optimal

Write-Output "localrelease limpa criada em: $localReleaseRoot"
Write-Output "arquivo ZIP limpo criado em: $localReleaseZip"
