param(
  [Parameter(Mandatory = $true)]
  [string]$Destination
)

$ErrorActionPreference = "Stop"

$sourcePath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$destinationPath = [System.IO.Path]::GetFullPath($Destination)
$sourcePrefix = $sourcePath.TrimEnd([char[]]@('\', '/')) + [System.IO.Path]::DirectorySeparatorChar

if (Test-Path -LiteralPath $destinationPath) {
  throw "Destination already exists: $destinationPath"
}

if ($destinationPath.StartsWith($sourcePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Destination cannot be inside the template folder: $destinationPath"
}

$excludedDirectories = @(
  ".git",
  "local_assets",
  "local_data",
  "private_data",
  "exports",
  "artifacts"
)

New-Item -ItemType Directory -Path $destinationPath | Out-Null

Get-ChildItem -LiteralPath $sourcePath -Force | ForEach-Object {
  if ($excludedDirectories -contains $_.Name) {
    return
  }

  if (-not $_.PSIsContainer -and $_.Name -like "*.zip") {
    return
  }

  Copy-Item -LiteralPath $_.FullName -Destination $destinationPath -Recurse -Force
}

Write-Host "Created new AI-ready project: $destinationPath"
Write-Host "Next steps:"
Write-Host "1. Open the copied folder with an AI."
Write-Host "2. Read AGENTS.md, docs/TEMPLATE_SETUP.md, and docs/NEW_PROJECT_CHECKLIST.md."
Write-Host "3. Adapt the template to the actual project before serious implementation."
Write-Host "4. Copy .git-identity.example to .git-identity, configure the allowed email and hooks, then initialize Git when ready."
