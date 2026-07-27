import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PublicationDiagnostics } from './publication-diagnostics'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('publication diagnostics', () => {
  it('stores only bounded operational fields', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'pagemaker-diagnostics-'))
    temporaryDirectories.push(directory)
    const diagnostics = new PublicationDiagnostics(directory)

    await diagnostics.record({
      event: 'failed',
      at: '2026-07-27T00:00:00.000Z',
      pageId: 'page-id',
      durationMs: 1250,
      code: 'push_failed'
    })

    const content = await readFile(join(directory, 'publication-diagnostics.jsonl'), 'utf8')
    expect(JSON.parse(content.trim())).toEqual({
      event: 'failed',
      at: '2026-07-27T00:00:00.000Z',
      pageId: 'page-id',
      durationMs: 1250,
      code: 'push_failed'
    })
    expect(content).not.toMatch(/token|content|folder|repository|account/i)
  })

  it('rotates an oversized diagnostic file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'pagemaker-diagnostics-'))
    temporaryDirectories.push(directory)
    const diagnostics = new PublicationDiagnostics(directory)
    const path = join(directory, 'publication-diagnostics.jsonl')
    await diagnostics.record({
      event: 'started',
      at: '2026-07-27T00:00:00.000Z',
      pageId: 'initial'
    })
    const { writeFile } = await import('node:fs/promises')
    await writeFile(path, 'x'.repeat(256_001), 'utf8')

    await diagnostics.record({
      event: 'completed',
      at: '2026-07-27T00:00:01.000Z',
      pageId: 'page-id',
      durationMs: 1000
    })

    expect((await stat(path)).size).toBeLessThan(10_000)
  })
})
