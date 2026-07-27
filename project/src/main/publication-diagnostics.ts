import { promises as fileSystem } from 'node:fs'
import { join } from 'node:path'
import type { PublicationErrorCode } from './publication-errors'

type PublicationDiagnostic =
  | { event: 'started'; at: string; pageId: string }
  | { event: 'completed'; at: string; pageId: string; durationMs: number }
  | {
      event: 'failed'
      at: string
      pageId: string
      durationMs: number
      code: PublicationErrorCode
    }

const DIAGNOSTIC_FILE = 'publication-diagnostics.jsonl'
const MAX_DIAGNOSTIC_BYTES = 256_000

export class PublicationDiagnostics {
  constructor(private readonly storageDirectory: string) {}

  async record(entry: PublicationDiagnostic): Promise<void> {
    try {
      await fileSystem.mkdir(this.storageDirectory, { recursive: true })
      const path = join(this.storageDirectory, DIAGNOSTIC_FILE)
      const currentSize = await fileSystem
        .stat(path)
        .then((value) => value.size)
        .catch(() => 0)
      if (currentSize > MAX_DIAGNOSTIC_BYTES) {
        await fileSystem.writeFile(path, '', 'utf8')
      }
      await fileSystem.appendFile(path, `${JSON.stringify(entry)}\n`, 'utf8')
    } catch {
      // Diagnostics must never change the result of a publication.
    }
  }
}
