import * as fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { promises as fileSystem } from 'node:fs'
import { join } from 'node:path'
import git from 'isomorphic-git'
import { generatePublicSite, type GeneratedSite } from './public-site-generator'
import type {
  CreatePageInput,
  PageContent,
  PageEditorData,
  PageSummary,
  SavePageContentInput,
  UpdatePageDetailsInput
} from '../shared/page-contracts'

type StoredPage = Omit<
  PageSummary,
  'previewDataUrl' | 'health' | 'canRecover' | 'healthMessage'
> & {
  schemaVersion: 1
  folderName: string
  deployment: { kind: 'local-only' }
}

const METADATA_FOLDER = '.pagemaker'
const METADATA_FILE = 'page.json'
const PREVIEW_FILE = 'preview.png'
const CONTENT_FILE = 'data.json'
const BACKUP_FOLDER = 'backup'
const BACKUP_METADATA_FILE = 'page.json'
const BACKUP_CONTENT_FILE = 'data.json'
const DEFAULT_SIDE_MARGIN = 80
const DEFAULT_VERTICAL_GAP = 48

export class PageWorkspaceService {
  private creationTail: Promise<void> = Promise.resolve()

  constructor(private readonly pagesRoot: string) {}

  async ensurePagesRoot(): Promise<void> {
    await fileSystem.mkdir(this.pagesRoot, { recursive: true })
  }

  async listPages(): Promise<PageSummary[]> {
    await fileSystem.mkdir(this.pagesRoot, { recursive: true })
    const entries = await fileSystem.readdir(this.pagesRoot, { withFileTypes: true })
    const pages = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => this.inspectPage(join(this.pagesRoot, entry.name), entry.name))
    )

    return pages
      .filter((page): page is PageSummary => page !== null)
      .sort((first, second) => {
        if (first.lastSavedAt && second.lastSavedAt) {
          return second.lastSavedAt.localeCompare(first.lastSavedAt)
        }
        if (first.lastSavedAt) return -1
        if (second.lastSavedAt) return 1
        return first.createdAt.localeCompare(second.createdAt)
      })
  }

  async createPage(input: CreatePageInput): Promise<PageSummary> {
    const validatedInput = this.validateCreateInput(input)
    return this.runCreationExclusively(async () => {
      let lastError: unknown

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          return await this.createPageSafely(validatedInput)
        } catch (error) {
          lastError = error
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 120))
          }
        }
      }

      throw lastError
    })
  }

  async getPage(pageId: string): Promise<PageEditorData> {
    const locatedPage = await this.findPage(pageId)
    const content = await this.readContent(locatedPage.folderPath, locatedPage.page)
    const previewDataUrl = await this.readPreview(locatedPage.folderPath)

    return {
      page: this.toSummary(locatedPage.page, previewDataUrl),
      content
    }
  }

  async savePreview(pageId: string, png: Uint8Array): Promise<string> {
    if (!(png instanceof Uint8Array) || png.byteLength === 0 || png.byteLength > 20_000_000) {
      throw new Error('Prévia da página inválida.')
    }

    const locatedPage = await this.findPage(pageId)
    const previewPath = join(locatedPage.folderPath, METADATA_FOLDER, PREVIEW_FILE)
    const temporaryPath = `${previewPath}.${randomUUID()}.tmp`
    await fileSystem.writeFile(temporaryPath, png)
    await fileSystem.rename(temporaryPath, previewPath)
    return this.toPngDataUrl(png)
  }

  async savePageContent(input: SavePageContentInput): Promise<PageEditorData> {
    const validatedInput = this.validateSaveInput(input)
    const locatedPage = await this.findPage(validatedInput.pageId)
    const updatedAt = new Date().toISOString()
    const content = validatedInput.content
    const updatedPage: StoredPage = {
      ...locatedPage.page,
      updatedAt,
      lastSavedAt: updatedAt
    }

    await this.backupCurrentSnapshot(locatedPage.folderPath)
    await this.writeJsonAtomically(join(locatedPage.folderPath, CONTENT_FILE), content)
    await this.writeJsonAtomically(
      join(locatedPage.folderPath, METADATA_FOLDER, METADATA_FILE),
      updatedPage
    )
    await generatePublicSite(join(locatedPage.folderPath, METADATA_FOLDER), content)

    return {
      page: this.toSummary(updatedPage),
      content
    }
  }

  async generatePageSite(pageId: string): Promise<GeneratedSite> {
    const locatedPage = await this.findPage(pageId)
    const content = await this.readContent(locatedPage.folderPath, locatedPage.page)
    return generatePublicSite(join(locatedPage.folderPath, METADATA_FOLDER), content)
  }

  async updatePageDetails(input: UpdatePageDetailsInput): Promise<PageSummary> {
    const validatedInput = this.validateUpdateDetailsInput(input)
    const locatedPage = await this.findPage(validatedInput.pageId)
    const updatedPage: StoredPage = {
      ...locatedPage.page,
      name: validatedInput.name,
      description: validatedInput.description,
      updatedAt: new Date().toISOString()
    }

    await this.backupCurrentSnapshot(locatedPage.folderPath)
    await this.writeJsonAtomically(
      join(locatedPage.folderPath, METADATA_FOLDER, METADATA_FILE),
      updatedPage
    )
    return this.toSummary(updatedPage, await this.readPreview(locatedPage.folderPath))
  }

  async getPageFolderPath(pageId: string): Promise<string> {
    return (await this.findPageWorkspace(pageId)).folderPath
  }

  async recoverPage(pageId: string): Promise<PageSummary> {
    const workspace = await this.findPageWorkspace(pageId)
    const backup = await this.readBackupSnapshot(workspace.folderPath)
    if (!backup) throw new Error('Nenhum backup válido foi encontrado para esta página.')

    await this.writeJsonAtomically(
      join(workspace.folderPath, METADATA_FOLDER, METADATA_FILE),
      backup.page
    )
    await this.writeJsonAtomically(join(workspace.folderPath, CONTENT_FILE), backup.content)
    await generatePublicSite(join(workspace.folderPath, METADATA_FOLDER), backup.content)

    return this.toSummary(
      backup.page,
      await this.readPreview(workspace.folderPath),
      'healthy',
      true
    )
  }

  private async createPageSafely(input: CreatePageInput): Promise<PageSummary> {
    const pageInput = input
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
      lastSavedAt: null,
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
      await this.writeJsonAtomically(join(stagingDirectory, CONTENT_FILE), {
        schemaVersion: 2,
        elements: [{ id: randomUUID(), type: 'title', text: pageInput.name }],
        layout: {
          marginLeft: DEFAULT_SIDE_MARGIN,
          marginRight: DEFAULT_SIDE_MARGIN,
          gaps: [DEFAULT_VERTICAL_GAP, DEFAULT_VERTICAL_GAP]
        }
      } satisfies PageContent)
      const initialContent = await this.readContent(stagingDirectory, storedPage)
      await generatePublicSite(join(stagingDirectory, METADATA_FOLDER), initialContent)
      await this.writeBackupSnapshot(stagingDirectory, storedPage, initialContent)
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

  private async inspectPage(folderPath: string, folderName: string): Promise<PageSummary> {
    const page = await this.readStoredPage(folderPath)
    const content = page ? await this.readValidatedContent(folderPath, page) : null
    const backup = await this.readBackupSnapshot(folderPath)

    if (page && content) {
      let canRecover = Boolean(backup)
      if (!backup) {
        try {
          await this.writeBackupSnapshot(folderPath, page, content)
          canRecover = true
        } catch {
          // A healthy page remains usable if its first safety snapshot cannot be created.
        }
      }
      return this.toSummary(page, await this.readPreview(folderPath), 'healthy', canRecover)
    }

    const fallbackPage = page ?? backup?.page
    if (fallbackPage) {
      return this.toSummary(
        fallbackPage,
        await this.readPreview(folderPath),
        'damaged',
        Boolean(backup),
        page
          ? 'O conteúdo editável da página está ausente ou danificado.'
          : 'Os dados de identificação da página estão ausentes ou danificados.'
      )
    }

    const timestamp = new Date(0).toISOString()
    return {
      id: this.damagedWorkspaceId(folderName),
      name: folderName,
      description: 'A pasta desta página precisa de atenção.',
      status: 'local',
      createdAt: timestamp,
      updatedAt: timestamp,
      lastSavedAt: null,
      folderName,
      health: 'damaged',
      canRecover: false,
      healthMessage: 'Não foi possível encontrar dados válidos nem um backup desta página.'
    }
  }

  private async readPreview(folderPath: string): Promise<string | undefined> {
    try {
      const preview = await fileSystem.readFile(join(folderPath, METADATA_FOLDER, PREVIEW_FILE))
      return this.toPngDataUrl(preview)
    } catch {
      return undefined
    }
  }

  private toPngDataUrl(png: Uint8Array): string {
    return `data:image/png;base64,${Buffer.from(png).toString('base64')}`
  }

  private async findPage(pageId: string): Promise<{ folderPath: string; page: StoredPage }> {
    if (typeof pageId !== 'string' || !pageId) {
      throw new Error('Página inválida.')
    }

    await fileSystem.mkdir(this.pagesRoot, { recursive: true })
    const entries = await fileSystem.readdir(this.pagesRoot, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue

      const folderPath = join(this.pagesRoot, entry.name)
      const page = await this.readStoredPage(folderPath)
      if (page?.id === pageId) return { folderPath, page }
    }

    throw new Error('Página local não encontrada.')
  }

  private async findPageWorkspace(
    pageId: string
  ): Promise<{ folderPath: string; folderName: string }> {
    if (typeof pageId !== 'string' || !pageId) throw new Error('Página inválida.')

    await fileSystem.mkdir(this.pagesRoot, { recursive: true })
    const entries = await fileSystem.readdir(this.pagesRoot, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const folderPath = join(this.pagesRoot, entry.name)
      const page = await this.readStoredPage(folderPath)
      const backup = await this.readBackupSnapshot(folderPath)
      if (
        page?.id === pageId ||
        backup?.page.id === pageId ||
        this.damagedWorkspaceId(entry.name) === pageId
      ) {
        return { folderPath, folderName: entry.name }
      }
    }
    throw new Error('Página local não encontrada.')
  }

  private async readStoredPage(folderPath: string): Promise<StoredPage | null> {
    try {
      const rawPage = await fileSystem.readFile(
        join(folderPath, METADATA_FOLDER, METADATA_FILE),
        'utf8'
      )
      return this.parseStoredPage(JSON.parse(rawPage))
    } catch {
      return null
    }
  }

  private async readContent(folderPath: string, page: StoredPage): Promise<PageContent> {
    try {
      const rawContent = await fileSystem.readFile(join(folderPath, CONTENT_FILE), 'utf8')
      const candidate = JSON.parse(rawContent) as unknown
      const parsedContent = this.parsePageContent(candidate)
      if (parsedContent) return parsedContent

      if (
        candidate &&
        typeof candidate === 'object' &&
        (candidate as { schemaVersion?: unknown }).schemaVersion === 1 &&
        typeof (candidate as { title?: unknown }).title === 'string'
      ) {
        return this.createInitialContent(page, (candidate as { title: string }).title)
      }
    } catch {
      // Pages created before the editor foundation receive their card name as initial content.
    }

    return this.createInitialContent(page, page.name)
  }

  private async readValidatedContent(
    folderPath: string,
    page: StoredPage
  ): Promise<PageContent | null> {
    try {
      const candidate = JSON.parse(
        await fileSystem.readFile(join(folderPath, CONTENT_FILE), 'utf8')
      ) as unknown
      const parsedContent = this.parsePageContent(candidate)
      if (parsedContent) return parsedContent
      if (
        candidate &&
        typeof candidate === 'object' &&
        (candidate as { schemaVersion?: unknown }).schemaVersion === 1 &&
        typeof (candidate as { title?: unknown }).title === 'string'
      ) {
        return this.createInitialContent(page, (candidate as { title: string }).title)
      }
      return null
    } catch {
      return null
    }
  }

  private async backupCurrentSnapshot(folderPath: string): Promise<void> {
    const page = await this.readStoredPage(folderPath)
    if (!page) throw new Error('Os dados atuais da página estão danificados.')
    const content = await this.readValidatedContent(folderPath, page)
    if (!content) throw new Error('O conteúdo atual da página está danificado.')
    await this.writeBackupSnapshot(folderPath, page, content)
  }

  private async writeBackupSnapshot(
    folderPath: string,
    page: StoredPage,
    content: PageContent
  ): Promise<void> {
    const backupFolder = join(folderPath, METADATA_FOLDER, BACKUP_FOLDER)
    await fileSystem.mkdir(backupFolder, { recursive: true })
    await this.writeJsonAtomically(join(backupFolder, BACKUP_METADATA_FILE), page)
    await this.writeJsonAtomically(join(backupFolder, BACKUP_CONTENT_FILE), content)
  }

  private async readBackupSnapshot(
    folderPath: string
  ): Promise<{ page: StoredPage; content: PageContent } | null> {
    try {
      const backupFolder = join(folderPath, METADATA_FOLDER, BACKUP_FOLDER)
      const page = this.parseStoredPage(
        JSON.parse(await fileSystem.readFile(join(backupFolder, BACKUP_METADATA_FILE), 'utf8'))
      )
      if (!page) return null
      const content = this.parsePageContent(
        JSON.parse(await fileSystem.readFile(join(backupFolder, BACKUP_CONTENT_FILE), 'utf8'))
      )
      return content ? { page, content } : null
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

  private validateSaveInput(input: SavePageContentInput): SavePageContentInput {
    if (!input || typeof input.pageId !== 'string') {
      throw new Error('Conteúdo da página inválido.')
    }

    const content = this.parsePageContent(input.content)
    if (!content) throw new Error('Conteúdo da página inválido.')

    return { pageId: input.pageId, content }
  }

  private validateUpdateDetailsInput(input: UpdatePageDetailsInput): UpdatePageDetailsInput {
    if (!input || typeof input.pageId !== 'string') {
      throw new Error('Dados da página inválidos.')
    }

    const details = this.validateCreateInput({
      name: input.name,
      description: input.description
    })
    return { pageId: input.pageId, ...details }
  }

  private parsePageContent(value: unknown): PageContent | null {
    if (!value || typeof value !== 'object') return null

    const candidate = value as Partial<PageContent>
    if (
      candidate.schemaVersion !== 2 ||
      !Array.isArray(candidate.elements) ||
      candidate.elements.length > 200 ||
      !candidate.layout ||
      !Array.isArray(candidate.layout.gaps) ||
      candidate.layout.gaps.length !== candidate.elements.length + 1 ||
      !this.isLayoutNumber(candidate.layout.marginLeft) ||
      !this.isLayoutNumber(candidate.layout.marginRight) ||
      !candidate.layout.gaps.every((gap) => this.isLayoutNumber(gap))
    ) {
      return null
    }

    const ids = new Set<string>()
    const elements: PageContent['elements'] = []
    for (const element of candidate.elements) {
      if (
        !element ||
        element.type !== 'title' ||
        typeof element.id !== 'string' ||
        !element.id ||
        element.id.length > 100 ||
        ids.has(element.id) ||
        typeof element.text !== 'string' ||
        element.text.length > 120
      ) {
        return null
      }
      ids.add(element.id)
      elements.push({
        id: element.id,
        type: 'title' as const,
        text: element.text.normalize('NFC').replace(/[\r\n]+/g, ' ')
      })
    }

    return {
      schemaVersion: 2,
      elements,
      layout: {
        marginLeft: candidate.layout.marginLeft,
        marginRight: candidate.layout.marginRight,
        gaps: [...candidate.layout.gaps]
      }
    }
  }

  private createInitialContent(page: StoredPage, title: string): PageContent {
    return {
      schemaVersion: 2,
      elements: [{ id: `title-${page.id}`, type: 'title', text: title }],
      layout: {
        marginLeft: DEFAULT_SIDE_MARGIN,
        marginRight: DEFAULT_SIDE_MARGIN,
        gaps: [DEFAULT_VERTICAL_GAP, DEFAULT_VERTICAL_GAP]
      }
    }
  }

  private isLayoutNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 480
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
      (candidate.lastSavedAt !== undefined &&
        candidate.lastSavedAt !== null &&
        typeof candidate.lastSavedAt !== 'string') ||
      typeof candidate.folderName !== 'string' ||
      candidate.deployment?.kind !== 'local-only'
    ) {
      return null
    }

    return {
      ...(candidate as StoredPage),
      lastSavedAt: candidate.lastSavedAt ?? null
    }
  }

  private toSummary(
    page: StoredPage,
    previewDataUrl?: string,
    health: PageSummary['health'] = 'healthy',
    canRecover = true,
    healthMessage?: string
  ): PageSummary {
    return {
      id: page.id,
      name: page.name,
      description: page.description,
      status: page.status,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      lastSavedAt: page.lastSavedAt,
      folderName: page.folderName,
      health,
      canRecover,
      ...(healthMessage ? { healthMessage } : {}),
      ...(previewDataUrl ? { previewDataUrl } : {})
    }
  }

  private damagedWorkspaceId(folderName: string): string {
    return `damaged-${createHash('sha256').update(folderName, 'utf8').digest('hex')}`
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

  private async writeJsonAtomically(path: string, value: unknown): Promise<void> {
    const temporaryPath = `${path}.${randomUUID()}.tmp`
    await fileSystem.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await fileSystem.rename(temporaryPath, path)
  }
}
