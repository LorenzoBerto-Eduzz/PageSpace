import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import {
  compareVersions,
  createUpdaterScript,
  PageSpaceUpdateService,
  validateLatestRelease
} from './pagespace-update-service'

const temporaryDirectories: string[] = []
const execFileAsync = promisify(execFile)

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

const digest = `sha256:${'a'.repeat(64)}`

function release(
  version: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    tag_name: `v${version}`,
    name: `PageSpace v${version}`,
    draft: false,
    prerelease: false,
    published_at: '2026-08-02T18:00:00Z',
    assets: [
      {
        name: 'PageSpace.zip',
        state: 'uploaded',
        size: 1024,
        digest,
        browser_download_url: `https://github.com/LorenzoBerto-Eduzz/PageSpace/releases/download/v${version}/PageSpace.zip`
      }
    ],
    ...overrides
  }
}

function service(currentVersion: string, response: Response): PageSpaceUpdateService {
  return new PageSpaceUpdateService({
    currentVersion,
    installDirectory: 'C:\\PageSpace',
    executablePath: 'C:\\PageSpace\\PageSpace.exe',
    isPackaged: true,
    fetch: async () => response,
    requestQuit: () => undefined
  })
}

describe('PageSpace update policy', () => {
  it('compares stable semantic versions without lexical mistakes', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1)
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0)
    expect(compareVersions('0.9.9', '1.0.0')).toBe(-1)
  })

  it('accepts only the exact official uploaded ZIP with a GitHub SHA-256 digest', () => {
    expect(validateLatestRelease(release('1.2.3'))).toEqual({
      version: '1.2.3',
      releaseName: 'PageSpace v1.2.3',
      publishedAt: '2026-08-02T18:00:00Z',
      assetUrl:
        'https://github.com/LorenzoBerto-Eduzz/PageSpace/releases/download/v1.2.3/PageSpace.zip',
      assetSize: 1024,
      digest: 'a'.repeat(64)
    })
  })

  it('rejects release assets outside the official repository', () => {
    const invalid = release('1.2.3')
    const assets = invalid.assets as Array<Record<string, unknown>>
    assets[0].browser_download_url = 'https://example.com/PageSpace.zip'
    expect(() => validateLatestRelease(invalid)).toThrow('UPD-CHECK-05')
  })

  it('reports an available newer release', async () => {
    const updater = service(
      '1.0.0',
      new Response(JSON.stringify(release('1.1.0')), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    )
    await expect(updater.check()).resolves.toEqual({
      state: 'available',
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      releaseName: 'PageSpace v1.1.0',
      publishedAt: '2026-08-02T18:00:00Z'
    })
  })

  it('does not offer the same or an older release', async () => {
    const updater = service(
      '1.1.0',
      new Response(JSON.stringify(release('1.1.0')), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    )
    await expect(updater.check()).resolves.toEqual({
      state: 'up-to-date',
      currentVersion: '1.1.0',
      latestVersion: '1.1.0'
    })
  })

  it('handles a repository with no public release', async () => {
    const updater = service('1.0.0', new Response(null, { status: 404 }))
    await expect(updater.check()).resolves.toEqual({
      state: 'unavailable',
      currentVersion: '1.0.0'
    })
  })

  it.runIf(process.platform === 'win32')(
    'generates a syntactically valid Windows updater helper',
    async () => {
      const directory = await mkdtemp(join(tmpdir(), 'pagespace-updater-test-'))
      temporaryDirectories.push(directory)
      const scriptPath = join(directory, 'updater.ps1')
      await writeFile(scriptPath, createUpdaterScript(), 'utf8')
      const powerShell = join(
        process.env.SystemRoot ?? 'C:\\Windows',
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe'
      )
      await expect(
        execFileAsync(
          powerShell,
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            '$tokens=$null; $errors=$null; [Management.Automation.Language.Parser]::ParseFile($env:PAGESPACE_TEST_SCRIPT,[ref]$tokens,[ref]$errors) | Out-Null; if ($errors.Count) { $errors | ForEach-Object { Write-Error $_.Message }; exit 1 }'
          ],
          { env: { ...process.env, PAGESPACE_TEST_SCRIPT: scriptPath } }
        )
      ).resolves.toBeDefined()
    }
  )
})
