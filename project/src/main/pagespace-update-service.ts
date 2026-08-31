import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, lstat, mkdir, open, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile, spawn } from 'node:child_process'
import type { AppUpdateInstallResult, AppUpdateStatus } from '../shared/page-contracts'

const RELEASE_API_URL = 'https://api.github.com/repos/LorenzoBerto-Eduzz/PageSpace/releases/latest'
const RELEASE_ASSET_NAME = 'PageSpace.zip'
const MAX_RELEASE_BYTES = 500 * 1024 * 1024
const MAX_EXTRACTED_BYTES = 1024 * 1024 * 1024
const MAX_EXTRACTED_FILES = 25_000
const REQUEST_TIMEOUT_MS = 30_000
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000
const CHECK_CACHE_MS = 10 * 60_000

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

type VerifiedRelease = {
  version: string
  releaseName: string
  publishedAt: string
  assetUrl: string
  assetSize: number
  digest: string
}

export type PageSpaceUpdateServiceOptions = {
  currentVersion: string
  installDirectory: string
  executablePath: string
  isPackaged: boolean
  fetch: FetchLike
  requestQuit: () => void
}

export class PageSpaceUpdateService {
  private checkedRelease: VerifiedRelease | null = null
  private cachedStatus: AppUpdateStatus | null = null
  private checkedAt = 0
  private installation: Promise<AppUpdateInstallResult> | null = null

  constructor(private readonly options: PageSpaceUpdateServiceOptions) {}

  async check(force = false): Promise<AppUpdateStatus> {
    if (process.platform !== 'win32') {
      return { state: 'unsupported', currentVersion: this.options.currentVersion }
    }
    if (!force && this.cachedStatus && Date.now() - this.checkedAt < CHECK_CACHE_MS) {
      return this.cachedStatus
    }

    const response = await this.fetchWithTimeout(RELEASE_API_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': `PageSpace/${this.options.currentVersion}`
      }
    })
    if (response.status === 404) {
      this.checkedRelease = null
      return this.cacheStatus({ state: 'unavailable', currentVersion: this.options.currentVersion })
    }
    if (!response.ok) {
      throw new Error(
        'Não foi possível consultar as atualizações agora. Tente novamente. | UPD-CHECK-01'
      )
    }

    const release = validateLatestRelease(await response.json())
    if (compareVersions(release.version, this.options.currentVersion) <= 0) {
      this.checkedRelease = null
      return this.cacheStatus({
        state: 'up-to-date',
        currentVersion: this.options.currentVersion,
        latestVersion: release.version
      })
    }

    this.checkedRelease = release
    return this.cacheStatus({
      state: 'available',
      currentVersion: this.options.currentVersion,
      latestVersion: release.version,
      releaseName: release.releaseName,
      publishedAt: release.publishedAt
    })
  }

  install(): Promise<AppUpdateInstallResult> {
    if (this.installation) return this.installation
    this.installation = this.installOnce().finally(() => {
      this.installation = null
    })
    return this.installation
  }

  private async installOnce(): Promise<AppUpdateInstallResult> {
    if (!this.options.isPackaged || process.platform !== 'win32') {
      throw new Error('A atualização automática está disponível apenas no PageSpace instalado.')
    }
    const release = this.checkedRelease ?? (await this.checkForInstall())
    const installDirectory = resolve(this.options.installDirectory)
    if (resolve(dirname(this.options.executablePath)) !== installDirectory) {
      throw new Error('A pasta atual do PageSpace não pôde ser confirmada. | UPD-SYSTEM-02')
    }
    const installParent = dirname(installDirectory)
    const updateId = randomUUID()
    const updateContainer = join(installParent, `.pagespace-update-${updateId}`)
    const archivePath = join(updateContainer, RELEASE_ASSET_NAME)
    const extractedParent = join(updateContainer, 'extracted')
    const stagedDirectory = join(extractedParent, 'PageSpace')
    const backupDirectory = join(installParent, `.pagespace-backup-${updateId}`)
    const helperPath = join(tmpdir(), `pagespace-update-${updateId}.ps1`)
    const completionMarker = join(tmpdir(), `pagespace-update-ready-${updateId}.txt`)

    await mkdir(updateContainer, { recursive: false })
    try {
      await this.downloadRelease(release, archivePath)
      await mkdir(extractedParent)
      await expandArchive(archivePath, extractedParent)
      await validateStagedRelease(stagedDirectory, release.version)
      await writeFile(helperPath, createUpdaterScript(), 'utf8')
      await launchUpdaterHelper({
        helperPath,
        parentPid: process.pid,
        installDirectory,
        stagedDirectory,
        backupDirectory,
        updateContainer,
        completionMarker,
        executableName: 'PageSpace.exe'
      })
    } catch (error) {
      await rm(updateContainer, { recursive: true, force: true })
      await rm(helperPath, { force: true })
      throw error
    }

    setTimeout(this.options.requestQuit, 250)
    return { state: 'restarting' }
  }

  private async checkForInstall(): Promise<VerifiedRelease> {
    const status = await this.check(true)
    if (status.state !== 'available' || !this.checkedRelease) {
      throw new Error('Nenhuma atualização nova está disponível para instalar.')
    }
    return this.checkedRelease
  }

  private cacheStatus(status: AppUpdateStatus): AppUpdateStatus {
    this.cachedStatus = status
    this.checkedAt = Date.now()
    return status
  }

  private async downloadRelease(release: VerifiedRelease, destination: string): Promise<void> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)
    let receivedBytes = 0
    const output = await open(destination, 'wx')
    try {
      const response = await this.options.fetch(release.assetUrl, {
        headers: { 'User-Agent': `PageSpace/${this.options.currentVersion}` },
        signal: controller.signal
      })
      if (!response.ok || !response.body) {
        throw new Error('Não foi possível baixar a atualização. Tente novamente. | UPD-DOWNLOAD-01')
      }
      const reportedLength = Number(response.headers.get('content-length') ?? release.assetSize)
      if (
        !Number.isFinite(reportedLength) ||
        reportedLength <= 0 ||
        reportedLength > MAX_RELEASE_BYTES
      ) {
        throw new Error('O arquivo da atualização possui um tamanho inválido. | UPD-DOWNLOAD-02')
      }
      const reader = response.body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          receivedBytes += value.byteLength
          if (receivedBytes > MAX_RELEASE_BYTES || receivedBytes > release.assetSize) {
            throw new Error(
              'O arquivo da atualização excede o tamanho publicado. | UPD-DOWNLOAD-02'
            )
          }
          await output.write(value)
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('| UPD-')) throw error
      throw new Error('Não foi possível baixar a atualização. Tente novamente. | UPD-DOWNLOAD-01')
    } finally {
      clearTimeout(timeout)
      await output.close()
    }
    if (receivedBytes !== release.assetSize) {
      throw new Error(
        'O download da atualização ficou incompleto. Tente novamente. | UPD-DOWNLOAD-03'
      )
    }
    const digest = await sha256File(destination)
    if (digest !== release.digest) {
      throw new Error('A verificação de segurança da atualização falhou. | UPD-VERIFY-01')
    }
  }

  private async fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      return await this.options.fetch(input, { ...init, signal: controller.signal })
    } catch {
      throw new Error(
        'Não foi possível acessar o serviço de atualizações. Verifique sua conexão. | UPD-NET-01'
      )
    } finally {
      clearTimeout(timeout)
    }
  }
}

export function compareVersions(first: string, second: string): number {
  const firstParts = parseVersion(first)
  const secondParts = parseVersion(second)
  for (let index = 0; index < firstParts.length; index += 1) {
    if (firstParts[index] !== secondParts[index]) {
      return firstParts[index] > secondParts[index] ? 1 : -1
    }
  }
  return 0
}

export function validateLatestRelease(value: unknown): VerifiedRelease {
  if (!isRecord(value))
    throw new Error('A resposta de atualização recebida é inválida. | UPD-CHECK-02')
  const tagName = value.tag_name
  const assets = value.assets
  if (
    typeof tagName !== 'string' ||
    value.draft !== false ||
    value.prerelease !== false ||
    typeof value.published_at !== 'string' ||
    !Array.isArray(assets)
  ) {
    throw new Error('A versão publicada está incompleta. | UPD-CHECK-03')
  }
  if (!tagName.startsWith('v')) {
    throw new Error('A versão publicada possui um formato inválido. | UPD-CHECK-06')
  }
  const version = tagName.slice(1)
  parseVersion(version)
  const rawAsset = assets.find(
    (asset) => isRecord(asset) && asset.name === RELEASE_ASSET_NAME && asset.state === 'uploaded'
  )
  if (!rawAsset || !isRecord(rawAsset)) {
    throw new Error('A versão publicada não possui o arquivo PageSpace.zip. | UPD-CHECK-04')
  }
  const size = rawAsset.size
  const digest = rawAsset.digest
  const downloadUrl = rawAsset.browser_download_url
  if (
    typeof size !== 'number' ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > MAX_RELEASE_BYTES ||
    typeof digest !== 'string' ||
    !/^sha256:[a-f0-9]{64}$/.test(digest) ||
    typeof downloadUrl !== 'string' ||
    !isOfficialAssetUrl(downloadUrl, version)
  ) {
    throw new Error('O arquivo publicado não passou na verificação de segurança. | UPD-CHECK-05')
  }
  return {
    version,
    releaseName:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim()
        : `PageSpace v${version}`,
    publishedAt: value.published_at,
    assetUrl: downloadUrl,
    assetSize: size,
    digest: digest.slice('sha256:'.length)
  }
}

function parseVersion(value: string): [number, number, number] {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value)
  if (!match) throw new Error('A versão publicada possui um formato inválido. | UPD-CHECK-06')
  const parts = [Number(match[1]), Number(match[2]), Number(match[3])] as [number, number, number]
  if (parts.some((part) => !Number.isSafeInteger(part))) {
    throw new Error('A versão publicada possui um formato inválido. | UPD-CHECK-06')
  }
  return parts
}

function isOfficialAssetUrl(value: string, version: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      url.pathname ===
        `/LorenzoBerto-Eduzz/PageSpace/releases/download/v${version}/${RELEASE_ASSET_NAME}`
    )
  } catch {
    return false
  }
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function expandArchive(archivePath: string, destination: string): Promise<void> {
  const powerShell = powerShellPath()
  await new Promise<void>((resolvePromise, rejectPromise) => {
    execFile(
      powerShell,
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        'Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force',
        archivePath,
        destination
      ],
      { windowsHide: true, timeout: 120_000 },
      (error) => {
        if (error) {
          rejectPromise(
            new Error('Não foi possível preparar a atualização baixada. | UPD-EXTRACT-01')
          )
        } else resolvePromise()
      }
    )
  })
}

async function validateStagedRelease(root: string, expectedVersion: string): Promise<void> {
  await access(join(root, 'PageSpace.exe'))
  const manifest = JSON.parse(
    await readFile(join(root, 'pagespace-release.json'), 'utf8')
  ) as unknown
  if (!isRecord(manifest) || manifest.schemaVersion !== 1 || manifest.version !== expectedVersion) {
    throw new Error('A atualização baixada não corresponde à versão publicada. | UPD-VERIFY-02')
  }
  const pagesDirectory = join(root, 'Pages')
  const pages = await readdir(pagesDirectory)
  if (pages.length !== 0) {
    throw new Error('A atualização baixada contém dados de páginas inesperados. | UPD-VERIFY-03')
  }
  let fileCount = 0
  let totalBytes = 0
  const pending = [root]
  while (pending.length) {
    const directory = pending.pop()
    if (!directory) continue
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(directory, entry.name)
      const details = await lstat(path)
      if (details.isSymbolicLink()) {
        throw new Error(
          'A atualização baixada contém um atalho de arquivo proibido. | UPD-VERIFY-04'
        )
      }
      if (details.isDirectory()) pending.push(path)
      else if (details.isFile()) {
        fileCount += 1
        totalBytes += details.size
        if (fileCount > MAX_EXTRACTED_FILES || totalBytes > MAX_EXTRACTED_BYTES) {
          throw new Error('A atualização baixada excede os limites permitidos. | UPD-VERIFY-05')
        }
      } else {
        throw new Error('A atualização baixada contém um arquivo inválido. | UPD-VERIFY-06')
      }
    }
  }
}

async function launchUpdaterHelper(input: {
  helperPath: string
  parentPid: number
  installDirectory: string
  stagedDirectory: string
  backupDirectory: string
  updateContainer: string
  completionMarker: string
  executableName: string
}): Promise<void> {
  const child = spawn(
    powerShellPath(),
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      input.helperPath,
      '-ParentPid',
      String(input.parentPid),
      '-InstallDirectory',
      input.installDirectory,
      '-StagedDirectory',
      input.stagedDirectory,
      '-BackupDirectory',
      input.backupDirectory,
      '-UpdateContainer',
      input.updateContainer,
      '-CompletionMarker',
      input.completionMarker,
      '-ExecutableName',
      input.executableName
    ],
    { detached: true, windowsHide: true, stdio: 'ignore' }
  )
  await new Promise<void>((resolvePromise, rejectPromise) => {
    child.once('spawn', () => {
      child.unref()
      resolvePromise()
    })
    child.once('error', () => {
      rejectPromise(
        new Error('Não foi possível iniciar o instalador da atualização. | UPD-SYSTEM-03')
      )
    })
  })
}

function powerShellPath(): string {
  const windowsRoot = process.env.SystemRoot
  if (!windowsRoot)
    throw new Error('O Windows não disponibilizou o atualizador do sistema. | UPD-SYSTEM-01')
  return join(windowsRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}

export function createUpdaterScript(): string {
  return `param(
  [Parameter(Mandatory=$true)][int]$ParentPid,
  [Parameter(Mandatory=$true)][string]$InstallDirectory,
  [Parameter(Mandatory=$true)][string]$StagedDirectory,
  [Parameter(Mandatory=$true)][string]$BackupDirectory,
  [Parameter(Mandatory=$true)][string]$UpdateContainer,
  [Parameter(Mandatory=$true)][string]$CompletionMarker,
  [Parameter(Mandatory=$true)][string]$ExecutableName
)
$ErrorActionPreference = 'Stop'
try {
  Wait-Process -Id $ParentPid -Timeout 60 -ErrorAction SilentlyContinue
  if (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue) { exit 21 }
  if (Test-Path -LiteralPath $BackupDirectory) { exit 22 }
  Move-Item -LiteralPath $InstallDirectory -Destination $BackupDirectory
  try {
    Move-Item -LiteralPath $StagedDirectory -Destination $InstallDirectory
    $newPages = Join-Path $InstallDirectory 'Pages'
    if (Test-Path -LiteralPath $newPages) { Remove-Item -LiteralPath $newPages -Recurse -Force }
    $oldPages = Join-Path $BackupDirectory 'Pages'
    if (Test-Path -LiteralPath $oldPages) {
      Move-Item -LiteralPath $oldPages -Destination $newPages
    } else {
      New-Item -ItemType Directory -Path $newPages | Out-Null
    }
    $newExecutable = Join-Path $InstallDirectory $ExecutableName
    $newProcess = Start-Process -FilePath $newExecutable -ArgumentList @('--pagespace-update-marker', $CompletionMarker) -WindowStyle Normal -PassThru
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
      if (Test-Path -LiteralPath $CompletionMarker) { $ready = $true; break }
      if ($newProcess.HasExited) { break }
      Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'The updated application did not confirm startup.' }
    Remove-Item -LiteralPath $CompletionMarker -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $BackupDirectory -Recurse -Force
    Remove-Item -LiteralPath $UpdateContainer -Recurse -Force
  } catch {
    if ($newProcess -and -not $newProcess.HasExited) {
      Stop-Process -Id $newProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $InstallDirectory) {
      $newPages = Join-Path $InstallDirectory 'Pages'
      $backupPages = Join-Path $BackupDirectory 'Pages'
      if ((Test-Path -LiteralPath $newPages) -and -not (Test-Path -LiteralPath $backupPages)) {
        Move-Item -LiteralPath $newPages -Destination $backupPages
      }
      Remove-Item -LiteralPath $InstallDirectory -Recurse -Force
    }
    Move-Item -LiteralPath $BackupDirectory -Destination $InstallDirectory
    Start-Process -FilePath (Join-Path $InstallDirectory $ExecutableName) -WindowStyle Normal
    throw
  }
} finally {
  Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $CompletionMarker -Force -ErrorAction SilentlyContinue
}
`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
