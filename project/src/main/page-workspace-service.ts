import * as fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { promises as fileSystem } from 'node:fs'
import { join } from 'node:path'
import git from 'isomorphic-git'
import type { CreatePageInput, PageSummary } from '../shared/page-contracts'

type StoredPage = PageSummary & {
  schemaVersion: 1
  folderName: string
  deployment: { kind: 'local-only' }
}

const METADATA_FOLDER = '.pagemaker'
const METADATA_FILE = 'page.json'

export class PageWorkspaceService {
  private creationTail: Promise<void> = Promise.resolve()

  constructor(private readonly pagesRoot: string) {}

  async listPages(): Promise<PageSummary[]> {
    await fileSystem.mkdir(this.pagesRoot, { recursive: true })
    const entries = await fileSystem.readdir(this.pagesRoot, { withFileTypes: true })
    const pages = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => this.readPage(join(this.pagesRoot, entry.name)))
    )

    return pages
      .filter((page): page is PageSummary => page !== null)
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
  }

  async createPage(input: CreatePageInput): Promise<PageSummary> {
    return this.runCreationExclusively(() => this.createPageSafely(input))
  }

  private async createPageSafely(input: CreatePageInput): Promise<PageSummary> {
    const pageInput = this.validateCreateInput(input)
    await fileSystem.mkdir(this.pagesRoot, { recursive: true })

    const folderName = await this.getAvailableFolderName(pageInput.name)
    const destination = join(this.pagesRoot, folderName)
    const stagingDirectory = await fileSystem.mkdtemp(join(this.pagesRoot, '.creating-'))
    const timestamp = new Date().toISOString()
    const storedPage: StoredPage = {
      id: randomUUID(),
      name: pageInput.name,
      description: pageInput.description,
      status: 'local',
      createdAt: timestamp,
      updatedAt: timestamp,
      schemaVersion: 1,
      folderName,
      deployment: { kind: 'local-only' }
    }

    try {
      await fileSystem.mkdir(join(stagingDirectory, METADATA_FOLDER), { recursive: true })
      await fileSystem.mkdir(join(stagingDirectory, 'assets'), { recursive: true })
      await this.writeJsonAtomically(
        join(stagingDirectory, METADATA_FOLDER, METADATA_FILE),
        storedPage
      )
      await fileSystem.writeFile(
        join(stagingDirectory, '.gitignore'),
        `${METADATA_FOLDER}/\n`,
        'utf8'
      )
      await git.init({ fs, dir: stagingDirectory, defaultBranch: 'main' })
      await fileSystem.rename(stagingDirectory, destination)

      return this.toSummary(storedPage)
    } catch {
      await fileSystem.rm(stagingDirectory, { recursive: true, force: true })
      throw new Error('Não foi possível criar a página local.')
    }
  }

  private async runCreationExclusively<T>(operation: () => Promise<T>): Promise<T> {
    const previousCreation = this.creationTail
    let releaseCreation: () => void = () => undefined
    this.creationTail = new Promise<void>((resolve) => {
      releaseCreation = resolve
    })

    await previousCreation

    try {
      return await operation()
    } finally {
      releaseCreation()
    }
  }

  private async readPage(folderPath: string): Promise<PageSummary | null> {
    try {
      const rawPage = await fileSystem.readFile(
        join(folderPath, METADATA_FOLDER, METADATA_FILE),
        'utf8'
      )
      const page = this.parseStoredPage(JSON.parse(rawPage))
      return page ? this.toSummary(page) : null
    } catch {
      return null
    }
  }

  private async getAvailableFolderName(name: string): Promise<string> {
    const baseName = this.toFolderName(name)
    let candidate = baseName
    let suffix = 2

    while (await this.pathExists(join(this.pagesRoot, candidate))) {
      candidate = `${baseName} (${suffix})`
      suffix += 1
    }

    return candidate
  }

  private validateCreateInput(input: CreatePageInput): CreatePageInput {
    if (!input || typeof input.name !== 'string' || typeof input.description !== 'string') {
      throw new Error('Dados da página inválidos.')
    }

    const name = input.name.normalize('NFC').trim().replace(/\s+/g, ' ')
    const description = input.description.normalize('NFC').trim().replace(/\s+/g, ' ')

    if (name.length === 0 || name.length > 80 || description.length > 180) {
      throw new Error('Revise o nome e a descrição da página.')
    }

    return { name, description }
  }

  private parseStoredPage(value: unknown): StoredPage | null {
    if (!value || typeof value !== 'object') return null

    const candidate = value as Partial<StoredPage>
    if (
      candidate.schemaVersion !== 1 ||
      typeof candidate.id !== 'string' ||
      typeof candidate.name !== 'string' ||
      typeof candidate.description !== 'string' ||
      candidate.status !== 'local' ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.updatedAt !== 'string' ||
      typeof candidate.folderName !== 'string' ||
      candidate.deployment?.kind !== 'local-only'
    ) {
      return null
    }

    return candidate as StoredPage
  }

  private toSummary(page: StoredPage): PageSummary {
    return {
      id: page.id,
      name: page.name,
      description: page.description,
      status: page.status,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt
    }
  }

  private toFolderName(name: string): string {
    const windowsSafeName = name
      .normalize('NFC')
      .replace(/[<>:"/\\|?*]/g, '-')
      .split('')
      .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
      .join('')
      .replace(/\s+/g, ' ')
      .replace(/[. ]+$/g, '')
      .trim()

    if (!windowsSafeName) return 'Página'

    const reservedWindowsName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i
    return reservedWindowsName.test(windowsSafeName)
      ? `${windowsSafeName} - Página`
      : windowsSafeName
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await fileSystem.access(path)
      return true
    } catch {
      return false
    }
  }

  private async writeJsonAtomically(path: string, value: StoredPage): Promise<void> {
    const temporaryPath = `${path}.${randomUUID()}.tmp`
    await fileSystem.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await fileSystem.rename(temporaryPath, path)
  }
}
