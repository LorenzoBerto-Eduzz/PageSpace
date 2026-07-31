import * as fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { promises as fileSystem } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import git from 'isomorphic-git'
import {
  generateImportedWebsiteSite,
  generatePackageSite,
  getPageSpacePackageSourceSignature,
  getStaticWebsiteSourceSignature,
  installValidatedPackage,
  installValidatedStaticWebsite,
  readInstalledPackage,
  reconcileEditableContent,
  replaceInstalledPackage,
  replaceInstalledStaticWebsite,
  validateEditableContent,
  validatePageSpacePackage,
  validateStaticWebsite,
  type PackageGeneratedSite,
  type ValidatedPageSpacePackage,
  type ValidatedStaticWebsite
} from './pagespace-package-service'
import { generatePublicSite, type GeneratedSite } from './public-site-generator'
import type {
  CreatePageInput,
  ImportPageResult,
  PageContent,
  PageDeployment,
  PageEditorData,
  PageSourceSync,
  PageSummary,
  SavePackageContentInput,
  SavePageContentInput,
  UpdatePageDetailsInput
} from '../shared/page-contracts'
import type {
  PageSource,
  PageSpaceEditableContent,
  PageSpaceEditableSchema
} from '../shared/pagespace-package-contracts'

type StoredPage = Omit<
  PageSummary,
  'previewDataUrl' | 'health' | 'canRecover' | 'healthMessage' | 'deployment' | 'sourceSync'
> & {
  schemaVersion: 2
  folderName: string
  deployment: PageDeployment
  source: PageSource
  sourceLink?: {
    directory: string
    signature: string
  }
}

type StoredContent = PageContent | PageSpaceEditableContent | null

type BackupSnapshot = {
  schemaVersion: 1
  page: StoredPage
  content: StoredContent
}

export type PublishingWorkspace = {
  folderPath: string
  name: string
  description: string
  deployment: PageDeployment
  publishablePaths: string[]
}

const METADATA_FOLDER = '.pagespace'
const METADATA_FILE = 'page.json'
const PREVIEW_FILE = 'preview.png'
const CONTENT_FILE = 'content.json'
const PACKAGE_FOLDER = 'package'
const WEBSITE_FOLDER = 'website'
const USER_ASSETS_FOLDER = 'user-assets'
const BACKUP_FOLDER = 'backup'
const BACKUP_FILE = 'snapshot.json'
const DEFAULT_SIDE_MARGIN = 80
const DEFAULT_VERTICAL_GAP = 48
const MAX_IMAGE_BYTES = 20_000_000

export class PageSpaceWorkspaceService {
  private creationTail: Promise<void> = Promise.resolve()

  constructor(private readonly pagesRoot: string) {}

  async ensurePagesRoot(): Promise<void> {
    await fileSystem.mkdir(this.pagesRoot, { recursive: true })
  }

  async listPages(): Promise<PageSummary[]> {
    await this.ensurePagesRoot()
    const entries = await fileSystem.readdir(this.pagesRoot, { withFileTypes: true })
    const pages = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => this.inspectPage(join(this.pagesRoot, entry.name), entry.name))
    )
    return pages.sort((first, second) => {
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
    return this.runCreationExclusively(() => this.createSimplePageSafely(validatedInput))
  }

  async importPage(sourceDirectory: string): Promise<ImportPageResult> {
    if (typeof sourceDirectory !== 'string' || !sourceDirectory) {
      throw new Error('Selecione uma pasta de página.')
    }
    const isPageSpacePackage = await this.pathExists(join(sourceDirectory, 'pagespace.json'))
    if (!isPageSpacePackage) {
      const website = await validateStaticWebsite(sourceDirectory)
      const sourceKey = this.staticWebsiteSourceKey(website.sourceDirectory)
      const sourceLink = {
        directory: website.sourceDirectory,
        signature: await getStaticWebsiteSourceSignature(website)
      }
      return this.runCreationExclusively(async () => {
        const existing = await this.findWebsiteBySourceKey(sourceKey)
        return existing
          ? this.updateWebsitePage(existing.folderPath, existing.page, website, sourceLink)
          : this.createWebsitePageSafely(website, sourceKey, sourceLink)
      })
    }
    const candidate = await validatePageSpacePackage(sourceDirectory)
    const sourceLink = {
      directory: candidate.sourceDirectory,
      signature: await getPageSpacePackageSourceSignature(candidate)
    }
    return this.runCreationExclusively(async () => {
      const existing = await this.findPackageById(candidate.manifest.packageId)
      return existing
        ? this.updatePackagePage(existing.folderPath, existing.page, candidate, sourceLink)
        : this.createPackagePageSafely(candidate, sourceLink)
    })
  }

  async refreshPageFromSource(pageId: string): Promise<PageSummary> {
    const located = await this.findPage(pageId)
    const sourceLink = located.page.sourceLink
    if (located.page.source.kind === 'simple') {
      throw new Error('Esta página foi criada no PageSpace e não possui pasta de origem.')
    }
    if (!sourceLink) {
      throw new Error('Importe esta página novamente uma vez para vincular sua pasta de origem.')
    }

    if (located.page.source.kind === 'website') {
      const candidate = await validateStaticWebsite(sourceLink.directory)
      const nextLink = {
        directory: candidate.sourceDirectory,
        signature: await getStaticWebsiteSourceSignature(candidate)
      }
      const result = await this.runCreationExclusively(() =>
        this.updateWebsitePage(located.folderPath, located.page, candidate, nextLink)
      )
      return result.page
    }

    const candidate = await validatePageSpacePackage(sourceLink.directory)
    if (candidate.manifest.packageId !== located.page.source.packageId) {
      throw new Error('A pasta de origem agora contém outro pacote PageSpace.')
    }
    const nextLink = {
      directory: candidate.sourceDirectory,
      signature: await getPageSpacePackageSourceSignature(candidate)
    }
    const result = await this.runCreationExclusively(() =>
      this.updatePackagePage(located.folderPath, located.page, candidate, nextLink)
    )
    return result.page
  }

  async getPage(pageId: string): Promise<PageEditorData> {
    const located = await this.findPage(pageId)
    const page = this.toSummary(
      located.page,
      await this.readPreview(located.folderPath),
      'healthy',
      true,
      undefined,
      await this.getSourceSync(located.page)
    )
    if (located.page.source.kind === 'simple') {
      return {
        kind: 'simple',
        page,
        content: await this.readSimpleContent(located.folderPath, located.page)
      }
    }

    if (located.page.source.kind === 'website') {
      return { kind: 'website', page }
    }

    const installed = await readInstalledPackage(this.packageDirectory(located.folderPath))
    return {
      kind: 'package',
      page,
      manifest: installed.manifest,
      schema: installed.schema,
      content:
        installed.manifest.mode === 'editable'
          ? await this.readPackageContent(located.folderPath, installed.schema!)
          : null
    }
  }

  async savePageContent(input: SavePageContentInput): Promise<PageEditorData> {
    const validatedInput = this.validateSimpleSaveInput(input)
    const located = await this.findPage(validatedInput.pageId)
    if (located.page.source.kind !== 'simple') {
      throw new Error('Use o formulário definido pelo pacote para editar esta página.')
    }
    await this.writeUpdatedContent(located.folderPath, located.page, validatedInput.content)
    return this.getPage(input.pageId)
  }

  async savePackageContent(input: SavePackageContentInput): Promise<PageEditorData> {
    if (!input || typeof input.pageId !== 'string') {
      throw new Error('Conteúdo da página inválido.')
    }
    const located = await this.findPage(input.pageId)
    if (located.page.source.kind !== 'package' || located.page.source.mode !== 'editable') {
      throw new Error('Esta página não possui edição configurada.')
    }
    const installed = await readInstalledPackage(this.packageDirectory(located.folderPath))
    if (!installed.schema) throw new Error('A definição de edição da página está ausente.')
    const content = validateEditableContent(input.content, installed.schema)
    await this.writeUpdatedContent(located.folderPath, located.page, content)
    return this.getPage(input.pageId)
  }

  async savePackageImage(pageId: string, png: Uint8Array): Promise<string> {
    if (!(png instanceof Uint8Array) || png.byteLength === 0 || png.byteLength > MAX_IMAGE_BYTES) {
      throw new Error('A imagem selecionada é inválida.')
    }
    const located = await this.findPage(pageId)
    if (located.page.source.kind !== 'package' || located.page.source.mode !== 'editable') {
      throw new Error('Esta página não aceita imagens editáveis.')
    }
    const assetsDirectory = this.userAssetsDirectory(located.folderPath)
    await fileSystem.mkdir(assetsDirectory, { recursive: true })
    const fileName = `${randomUUID()}.png`
    const temporaryPath = join(assetsDirectory, `${fileName}.tmp`)
    await fileSystem.writeFile(temporaryPath, png)
    await fileSystem.rename(temporaryPath, join(assetsDirectory, fileName))
    return `${USER_ASSETS_FOLDER}/${fileName}`
  }

  async savePreview(pageId: string, png: Uint8Array): Promise<string> {
    if (!(png instanceof Uint8Array) || png.byteLength === 0 || png.byteLength > MAX_IMAGE_BYTES) {
      throw new Error('Prévia da página inválida.')
    }
    const located = await this.findPage(pageId)
    const previewPath = join(located.folderPath, METADATA_FOLDER, PREVIEW_FILE)
    const temporaryPath = `${previewPath}.${randomUUID()}.tmp`
    await fileSystem.writeFile(temporaryPath, png)
    await fileSystem.rename(temporaryPath, previewPath)
    return this.toPngDataUrl(png)
  }

  async generatePageSite(pageId: string): Promise<GeneratedSite | PackageGeneratedSite> {
    const located = await this.findPage(pageId)
    if (located.page.source.kind === 'simple') {
      const content = await this.readSimpleContent(located.folderPath, located.page)
      return generatePublicSite(this.metadataDirectory(located.folderPath), content)
    }

    if (located.page.source.kind === 'website') {
      return generateImportedWebsiteSite(
        this.metadataDirectory(located.folderPath),
        this.websiteDirectory(located.folderPath)
      )
    }

    const installed = await readInstalledPackage(this.packageDirectory(located.folderPath))
    const content =
      installed.manifest.mode === 'editable'
        ? await this.readPackageContent(located.folderPath, installed.schema!)
        : null
    return generatePackageSite(
      this.metadataDirectory(located.folderPath),
      this.packageDirectory(located.folderPath),
      content,
      this.userAssetsDirectory(located.folderPath)
    )
  }

  async updatePageDetails(input: UpdatePageDetailsInput): Promise<PageSummary> {
    const validatedInput = this.validateUpdateDetailsInput(input)
    const located = await this.findPage(validatedInput.pageId)
    await this.backupCurrentSnapshot(located.folderPath, located.page)
    const updatedPage: StoredPage = {
      ...located.page,
      name: validatedInput.name,
      description: validatedInput.description,
      updatedAt: new Date().toISOString()
    }
    await this.writeStoredPage(located.folderPath, updatedPage)
    return this.toSummary(updatedPage, await this.readPreview(located.folderPath))
  }

  async getPageFolderPath(pageId: string): Promise<string> {
    return (await this.findPageWorkspace(pageId)).folderPath
  }

  async preparePageForPublishing(pageId: string): Promise<PublishingWorkspace> {
    const located = await this.findPage(pageId)
    const generated = await this.generatePageSite(pageId)
    const publishablePaths = await this.replacePublishableDocs(
      located.folderPath,
      generated.directoryPath
    )
    await fileSystem.writeFile(
      join(located.folderPath, '.gitignore'),
      `${METADATA_FOLDER}/\n${CONTENT_FILE}\n`,
      'utf8'
    )
    return {
      folderPath: located.folderPath,
      name: located.page.name,
      description: located.page.description,
      deployment: located.page.deployment,
      publishablePaths: ['.gitignore', ...publishablePaths.map((path) => `docs/${path}`)]
    }
  }

  async updatePageDeployment(pageId: string, deployment: PageDeployment): Promise<PageSummary> {
    const located = await this.findPage(pageId)
    await this.backupCurrentSnapshot(located.folderPath, located.page)
    const updatedPage: StoredPage = {
      ...located.page,
      status: deployment.kind === 'published' ? 'published' : 'local',
      deployment,
      updatedAt: new Date().toISOString()
    }
    await this.writeStoredPage(located.folderPath, updatedPage)
    return this.toSummary(updatedPage, await this.readPreview(located.folderPath))
  }

  async recoverPage(pageId: string): Promise<PageSummary> {
    const workspace = await this.findPageWorkspace(pageId)
    const backup = await this.readBackupSnapshot(workspace.folderPath)
    if (!backup) throw new Error('Nenhum backup válido foi encontrado para esta página.')
    await this.writeStoredPage(workspace.folderPath, backup.page)
    if (backup.content) {
      await this.writeJsonAtomically(join(workspace.folderPath, CONTENT_FILE), backup.content)
    }
    await this.generatePageSite(backup.page.id)
    return this.toSummary(
      backup.page,
      await this.readPreview(workspace.folderPath),
      'healthy',
      true
    )
  }

  private async createSimplePageSafely(input: CreatePageInput): Promise<PageSummary> {
    await this.ensurePagesRoot()
    const folderName = await this.getAvailableFolderName(input.name)
    const destination = join(this.pagesRoot, folderName)
    const staging = await fileSystem.mkdtemp(join(this.pagesRoot, '.creating-'))
    const timestamp = new Date().toISOString()
    const page: StoredPage = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      status: 'local',
      createdAt: timestamp,
      updatedAt: timestamp,
      lastSavedAt: null,
      schemaVersion: 2,
      folderName,
      deployment: { kind: 'local-only' },
      source: { kind: 'simple' }
    }
    const content = this.createInitialSimpleContent(page, input.name)
    try {
      await fileSystem.mkdir(this.metadataDirectory(staging), { recursive: true })
      await this.writeStoredPage(staging, page)
      await this.writeJsonAtomically(join(staging, CONTENT_FILE), content)
      await generatePublicSite(this.metadataDirectory(staging), content)
      await this.writeBackupSnapshot(staging, page, content)
      await fileSystem.writeFile(join(staging, '.gitignore'), `${METADATA_FOLDER}/\n`, 'utf8')
      await git.init({ fs, dir: staging, defaultBranch: 'main' })
      await fileSystem.rename(staging, destination)
      return this.toSummary(page)
    } catch (error) {
      await fileSystem.rm(staging, { recursive: true, force: true })
      throw error instanceof Error ? error : new Error('Não foi possível criar a página local.')
    }
  }

  private async createPackagePageSafely(
    candidate: ValidatedPageSpacePackage,
    sourceLink: NonNullable<StoredPage['sourceLink']>
  ): Promise<ImportPageResult> {
    await this.ensurePagesRoot()
    const folderName = await this.getAvailableFolderName(candidate.manifest.name)
    const destination = join(this.pagesRoot, folderName)
    const staging = await fileSystem.mkdtemp(join(this.pagesRoot, '.importing-'))
    const timestamp = new Date().toISOString()
    const page: StoredPage = {
      id: randomUUID(),
      name: candidate.manifest.name,
      description: candidate.manifest.description,
      status: 'local',
      createdAt: timestamp,
      updatedAt: timestamp,
      lastSavedAt: null,
      schemaVersion: 2,
      folderName,
      deployment: { kind: 'local-only' },
      source: {
        kind: 'package',
        packageId: candidate.manifest.packageId,
        packageVersion: candidate.manifest.packageVersion,
        mode: candidate.manifest.mode
      },
      sourceLink
    }
    try {
      await fileSystem.mkdir(this.metadataDirectory(staging), { recursive: true })
      await installValidatedPackage(candidate, this.packageDirectory(staging))
      await this.writeStoredPage(staging, page)
      if (candidate.content) {
        await this.writeJsonAtomically(join(staging, CONTENT_FILE), candidate.content)
      }
      await generatePackageSite(
        this.metadataDirectory(staging),
        this.packageDirectory(staging),
        candidate.content,
        this.userAssetsDirectory(staging)
      )
      await this.writeBackupSnapshot(staging, page, candidate.content)
      await fileSystem.writeFile(
        join(staging, '.gitignore'),
        `${METADATA_FOLDER}/\n${CONTENT_FILE}\n`,
        'utf8'
      )
      await git.init({ fs, dir: staging, defaultBranch: 'main' })
      await fileSystem.rename(staging, destination)
      return {
        page: this.toSummary(page, undefined, 'healthy', true, undefined, { state: 'synced' }),
        outcome: 'imported'
      }
    } catch (error) {
      await fileSystem.rm(staging, { recursive: true, force: true })
      throw error
    }
  }

  private async createWebsitePageSafely(
    candidate: ValidatedStaticWebsite,
    sourceKey: string,
    sourceLink: NonNullable<StoredPage['sourceLink']>
  ): Promise<ImportPageResult> {
    await this.ensurePagesRoot()
    const pageName = candidate.name || 'Página importada'
    const folderName = await this.getAvailableFolderName(pageName)
    const destination = join(this.pagesRoot, folderName)
    const staging = await fileSystem.mkdtemp(join(this.pagesRoot, '.importing-'))
    const timestamp = new Date().toISOString()
    const page: StoredPage = {
      id: randomUUID(),
      name: pageName,
      description: '',
      status: 'local',
      createdAt: timestamp,
      updatedAt: timestamp,
      lastSavedAt: null,
      schemaVersion: 2,
      folderName,
      deployment: { kind: 'local-only' },
      source: { kind: 'website', sourceKey },
      sourceLink
    }
    try {
      await fileSystem.mkdir(this.metadataDirectory(staging), { recursive: true })
      await installValidatedStaticWebsite(candidate, this.websiteDirectory(staging))
      await this.writeStoredPage(staging, page)
      await generateImportedWebsiteSite(
        this.metadataDirectory(staging),
        this.websiteDirectory(staging)
      )
      await this.writeBackupSnapshot(staging, page, null)
      await fileSystem.writeFile(
        join(staging, '.gitignore'),
        `${METADATA_FOLDER}/\n${CONTENT_FILE}\n`,
        'utf8'
      )
      await git.init({ fs, dir: staging, defaultBranch: 'main' })
      await fileSystem.rename(staging, destination)
      return {
        page: this.toSummary(page, undefined, 'healthy', true, undefined, { state: 'synced' }),
        outcome: 'imported'
      }
    } catch (error) {
      await fileSystem.rm(staging, { recursive: true, force: true })
      throw error
    }
  }

  private async updateWebsitePage(
    folderPath: string,
    currentPage: StoredPage,
    candidate: ValidatedStaticWebsite,
    sourceLink: NonNullable<StoredPage['sourceLink']>
  ): Promise<ImportPageResult> {
    if (currentPage.source.kind !== 'website') throw new Error('Página incompatível.')
    await this.backupCurrentSnapshot(folderPath, currentPage)
    await replaceInstalledStaticWebsite(candidate, this.websiteDirectory(folderPath))
    const updatedPage: StoredPage = {
      ...this.markUnpublishedChanges(currentPage),
      updatedAt: new Date().toISOString(),
      sourceLink
    }
    await this.writeStoredPage(folderPath, updatedPage)
    await generateImportedWebsiteSite(
      this.metadataDirectory(folderPath),
      this.websiteDirectory(folderPath)
    )
    return {
      page: this.toSummary(
        updatedPage,
        await this.readPreview(folderPath),
        'healthy',
        true,
        undefined,
        { state: 'synced' }
      ),
      outcome: 'updated'
    }
  }

  private async updatePackagePage(
    folderPath: string,
    currentPage: StoredPage,
    candidate: ValidatedPageSpacePackage,
    sourceLink: NonNullable<StoredPage['sourceLink']>
  ): Promise<ImportPageResult> {
    if (currentPage.source.kind !== 'package') throw new Error('Página incompatível.')
    await this.backupCurrentSnapshot(folderPath, currentPage)
    const previousInstalled = await readInstalledPackage(this.packageDirectory(folderPath))
    let nextContent = candidate.content
    if (
      previousInstalled.manifest.mode === 'editable' &&
      previousInstalled.schema &&
      candidate.manifest.mode === 'editable' &&
      candidate.schema &&
      candidate.content
    ) {
      const currentContent = await this.readPackageContent(folderPath, previousInstalled.schema)
      nextContent = reconcileEditableContent(
        currentContent,
        previousInstalled.schema,
        candidate.content,
        candidate.schema
      )
    }

    await replaceInstalledPackage(candidate, this.packageDirectory(folderPath))
    if (nextContent) {
      await this.writeJsonAtomically(join(folderPath, CONTENT_FILE), nextContent)
    } else {
      await fileSystem.rm(join(folderPath, CONTENT_FILE), { force: true })
    }
    const updatedPage: StoredPage = {
      ...this.markUnpublishedChanges(currentPage),
      updatedAt: new Date().toISOString(),
      source: {
        kind: 'package',
        packageId: candidate.manifest.packageId,
        packageVersion: candidate.manifest.packageVersion,
        mode: candidate.manifest.mode
      },
      sourceLink
    }
    await this.writeStoredPage(folderPath, updatedPage)
    await generatePackageSite(
      this.metadataDirectory(folderPath),
      this.packageDirectory(folderPath),
      nextContent,
      this.userAssetsDirectory(folderPath)
    )
    return {
      page: this.toSummary(
        updatedPage,
        await this.readPreview(folderPath),
        'healthy',
        true,
        undefined,
        { state: 'synced' }
      ),
      outcome: 'updated'
    }
  }

  private async inspectPage(folderPath: string, folderName: string): Promise<PageSummary> {
    const page = await this.readStoredPage(folderPath)
    const backup = await this.readBackupSnapshot(folderPath)
    if (page) {
      try {
        if (page.source.kind === 'simple') {
          await this.readValidatedSimpleContent(folderPath)
        } else if (page.source.kind === 'website') {
          await validateStaticWebsite(this.websiteDirectory(folderPath))
        } else {
          const candidate = await validatePageSpacePackage(this.packageDirectory(folderPath))
          if (
            candidate.manifest.packageId !== page.source.packageId ||
            candidate.manifest.mode !== page.source.mode
          ) {
            throw new Error('O pacote instalado não corresponde aos dados da página.')
          }
          if (candidate.schema) await this.readPackageContent(folderPath, candidate.schema)
        }
        if (!backup) {
          await this.backupCurrentSnapshot(folderPath, page)
        }
        return this.toSummary(
          page,
          await this.readPreview(folderPath),
          'healthy',
          true,
          undefined,
          await this.getSourceSync(page)
        )
      } catch {
        return this.toSummary(
          page,
          await this.readPreview(folderPath),
          'damaged',
          Boolean(backup),
          'Os arquivos ou dados internos desta página estão ausentes ou danificados.'
        )
      }
    }

    if (backup) {
      return this.toSummary(
        backup.page,
        await this.readPreview(folderPath),
        'damaged',
        true,
        'Os dados de identificação da página estão ausentes ou danificados.'
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
      deployment: { kind: 'local-only' },
      source: { kind: 'simple' },
      sourceSync: { state: 'not-applicable' },
      healthMessage: 'Não foi possível encontrar dados válidos nem um backup desta página.'
    }
  }

  private async writeUpdatedContent(
    folderPath: string,
    page: StoredPage,
    content: Exclude<StoredContent, null>
  ): Promise<void> {
    await this.backupCurrentSnapshot(folderPath, page)
    const updatedAt = new Date().toISOString()
    await this.writeJsonAtomically(join(folderPath, CONTENT_FILE), content)
    await this.writeStoredPage(folderPath, {
      ...this.markUnpublishedChanges(page),
      updatedAt,
      lastSavedAt: updatedAt
    })
    if (page.source.kind === 'simple') {
      await generatePublicSite(this.metadataDirectory(folderPath), content as PageContent)
    } else if (page.source.kind === 'package') {
      await generatePackageSite(
        this.metadataDirectory(folderPath),
        this.packageDirectory(folderPath),
        content as PageSpaceEditableContent,
        this.userAssetsDirectory(folderPath)
      )
    } else {
      throw new Error('Esta página importada não possui conteúdo editável.')
    }
  }

  private async readSimpleContent(folderPath: string, page: StoredPage): Promise<PageContent> {
    try {
      return await this.readValidatedSimpleContent(folderPath)
    } catch {
      return this.createInitialSimpleContent(page, page.name)
    }
  }

  private async readValidatedSimpleContent(folderPath: string): Promise<PageContent> {
    const candidate = JSON.parse(
      await fileSystem.readFile(join(folderPath, CONTENT_FILE), 'utf8')
    ) as unknown
    const parsed = this.parsePageContent(candidate)
    if (!parsed) throw new Error('Conteúdo simples inválido.')
    return parsed
  }

  private async readPackageContent(
    folderPath: string,
    schema: PageSpaceEditableSchema
  ): Promise<PageSpaceEditableContent> {
    const value = JSON.parse(
      await fileSystem.readFile(join(folderPath, CONTENT_FILE), 'utf8')
    ) as unknown
    return validateEditableContent(value, schema)
  }

  private async readCurrentContent(folderPath: string, page: StoredPage): Promise<StoredContent> {
    if (page.source.kind === 'simple') return this.readValidatedSimpleContent(folderPath)
    if (page.source.kind === 'website') return null
    if (page.source.mode === 'static') return null
    const installed = await readInstalledPackage(this.packageDirectory(folderPath))
    if (!installed.schema) throw new Error('Definição de edição ausente.')
    return this.readPackageContent(folderPath, installed.schema)
  }

  private async backupCurrentSnapshot(folderPath: string, page: StoredPage): Promise<void> {
    await this.writeBackupSnapshot(
      folderPath,
      page,
      await this.readCurrentContent(folderPath, page)
    )
  }

  private async writeBackupSnapshot(
    folderPath: string,
    page: StoredPage,
    content: StoredContent
  ): Promise<void> {
    const directory = join(this.metadataDirectory(folderPath), BACKUP_FOLDER)
    await fileSystem.mkdir(directory, { recursive: true })
    await this.writeJsonAtomically(join(directory, BACKUP_FILE), {
      schemaVersion: 1,
      page,
      content
    } satisfies BackupSnapshot)
  }

  private async readBackupSnapshot(folderPath: string): Promise<BackupSnapshot | null> {
    try {
      const value = JSON.parse(
        await fileSystem.readFile(
          join(this.metadataDirectory(folderPath), BACKUP_FOLDER, BACKUP_FILE),
          'utf8'
        )
      ) as Partial<BackupSnapshot>
      const page = this.parseStoredPage(value.page)
      if (value.schemaVersion !== 1 || !page) return null
      let content: StoredContent = null
      if (page.source.kind === 'simple') {
        content = this.parsePageContent(value.content)
        if (!content) return null
      } else if (page.source.kind === 'package' && page.source.mode === 'editable') {
        const installed = await readInstalledPackage(this.packageDirectory(folderPath))
        if (!installed.schema) return null
        content = validateEditableContent(value.content, installed.schema)
      }
      return { schemaVersion: 1, page, content }
    } catch {
      return null
    }
  }

  private async replacePublishableDocs(
    folderPath: string,
    generatedDirectory: string
  ): Promise<string[]> {
    const files = await this.collectRegularFiles(generatedDirectory)
    const destination = join(folderPath, 'docs')
    const staging = join(this.metadataDirectory(folderPath), `.docs-${randomUUID()}.tmp`)
    const backup = join(this.metadataDirectory(folderPath), `.docs-${randomUUID()}.backup`)
    await fileSystem.mkdir(staging, { recursive: false })
    try {
      await this.copyRelativeFiles(generatedDirectory, staging, files)
      const hadDestination = await this.pathExists(destination)
      if (hadDestination) await fileSystem.rename(destination, backup)
      try {
        await fileSystem.rename(staging, destination)
        if (hadDestination) await fileSystem.rm(backup, { recursive: true, force: true })
      } catch (error) {
        if (hadDestination && !(await this.pathExists(destination))) {
          await fileSystem.rename(backup, destination)
        }
        throw error
      }
      return files
    } catch (error) {
      await fileSystem.rm(staging, { recursive: true, force: true })
      await fileSystem.rm(backup, { recursive: true, force: true })
      throw error
    }
  }

  private async collectRegularFiles(root: string): Promise<string[]> {
    const resolvedRoot = resolve(root)
    const files: string[] = []
    const visit = async (directory: string): Promise<void> => {
      for (const entry of await fileSystem.readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name)
        const relativePath = relative(resolvedRoot, path)
        if (
          relativePath.startsWith(`..${sep}`) ||
          relativePath === '..' ||
          entry.isSymbolicLink()
        ) {
          throw new Error('A saída pública contém um caminho inseguro.')
        }
        if (entry.isDirectory()) await visit(path)
        else if (entry.isFile()) files.push(relativePath.split(sep).join('/'))
        else throw new Error('A saída pública contém uma entrada não suportada.')
      }
    }
    await visit(resolvedRoot)
    return files.sort((first, second) => first.localeCompare(second))
  }

  private async copyRelativeFiles(
    sourceRoot: string,
    destinationRoot: string,
    files: string[]
  ): Promise<void> {
    for (const filePath of files) {
      const destination = join(destinationRoot, ...filePath.split('/'))
      await fileSystem.mkdir(dirname(destination), { recursive: true })
      await fileSystem.copyFile(join(sourceRoot, ...filePath.split('/')), destination)
    }
  }

  private async findPage(pageId: string): Promise<{ folderPath: string; page: StoredPage }> {
    if (typeof pageId !== 'string' || !pageId) throw new Error('Página inválida.')
    await this.ensurePagesRoot()
    for (const entry of await fileSystem.readdir(this.pagesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const folderPath = join(this.pagesRoot, entry.name)
      const page = await this.readStoredPage(folderPath)
      if (page?.id === pageId) return { folderPath, page }
    }
    throw new Error('Página local não encontrada.')
  }

  private async findPackageById(
    packageId: string
  ): Promise<{ folderPath: string; page: StoredPage } | null> {
    await this.ensurePagesRoot()
    for (const entry of await fileSystem.readdir(this.pagesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const folderPath = join(this.pagesRoot, entry.name)
      const page = await this.readStoredPage(folderPath)
      if (page?.source.kind === 'package' && page.source.packageId === packageId) {
        return { folderPath, page }
      }
    }
    return null
  }

  private async findWebsiteBySourceKey(
    sourceKey: string
  ): Promise<{ folderPath: string; page: StoredPage } | null> {
    await this.ensurePagesRoot()
    for (const entry of await fileSystem.readdir(this.pagesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const folderPath = join(this.pagesRoot, entry.name)
      const page = await this.readStoredPage(folderPath)
      if (page?.source.kind === 'website' && page.source.sourceKey === sourceKey) {
        return { folderPath, page }
      }
    }
    return null
  }

  private async findPageWorkspace(
    pageId: string
  ): Promise<{ folderPath: string; folderName: string }> {
    await this.ensurePagesRoot()
    for (const entry of await fileSystem.readdir(this.pagesRoot, { withFileTypes: true })) {
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
      return this.parseStoredPage(
        JSON.parse(
          await fileSystem.readFile(join(this.metadataDirectory(folderPath), METADATA_FILE), 'utf8')
        )
      )
    } catch {
      return null
    }
  }

  private parseStoredPage(value: unknown): StoredPage | null {
    if (!value || typeof value !== 'object') return null
    const candidate = value as Partial<StoredPage>
    if (
      candidate.schemaVersion !== 2 ||
      typeof candidate.id !== 'string' ||
      typeof candidate.name !== 'string' ||
      typeof candidate.description !== 'string' ||
      (candidate.status !== 'local' && candidate.status !== 'published') ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.updatedAt !== 'string' ||
      (candidate.lastSavedAt !== null && typeof candidate.lastSavedAt !== 'string') ||
      typeof candidate.folderName !== 'string' ||
      !this.isPageDeployment(candidate.deployment) ||
      !this.isPageSource(candidate.source) ||
      !this.isSourceLink(candidate.sourceLink) ||
      (candidate.status === 'published' && candidate.deployment.kind !== 'published')
    ) {
      return null
    }
    return candidate as StoredPage
  }

  private isPageSource(value: unknown): value is PageSource {
    if (!value || typeof value !== 'object') return false
    const source = value as Partial<PageSource>
    if (source.kind === 'simple') return true
    if (source.kind === 'website') {
      return typeof source.sourceKey === 'string' && /^[a-f0-9]{64}$/.test(source.sourceKey)
    }
    return (
      source.kind === 'package' &&
      typeof source.packageId === 'string' &&
      typeof source.packageVersion === 'string' &&
      (source.mode === 'static' || source.mode === 'editable')
    )
  }

  private isSourceLink(value: unknown): value is StoredPage['sourceLink'] {
    if (value === undefined) return true
    if (!value || typeof value !== 'object') return false
    const sourceLink = value as Partial<NonNullable<StoredPage['sourceLink']>>
    return (
      typeof sourceLink.directory === 'string' &&
      sourceLink.directory.length > 0 &&
      typeof sourceLink.signature === 'string' &&
      /^[a-f0-9]{64}$/.test(sourceLink.signature)
    )
  }

  private isPageDeployment(value: unknown): value is PageDeployment {
    if (!value || typeof value !== 'object') return false
    const deployment = value as Partial<PageDeployment>
    if (deployment.kind === 'local-only') return true
    if (
      (deployment.kind !== 'publishing' && deployment.kind !== 'published') ||
      typeof deployment.owner !== 'string' ||
      typeof deployment.repository !== 'string' ||
      typeof deployment.repositoryUrl !== 'string' ||
      typeof deployment.publicUrl !== 'string'
    ) {
      return false
    }
    if (deployment.kind === 'publishing') {
      return deployment.phase === 'repository-created' || deployment.phase === 'content-pushed'
    }
    const published = deployment as Partial<Extract<PageDeployment, { kind: 'published' }>>
    return (
      typeof published.publishedAt === 'string' &&
      typeof published.lastPublishedAt === 'string' &&
      typeof published.lastCommitOid === 'string' &&
      (published.pendingCommitOid === undefined ||
        typeof published.pendingCommitOid === 'string') &&
      (published.hasUnpublishedChanges === undefined ||
        typeof published.hasUnpublishedChanges === 'boolean')
    )
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

  private validateSimpleSaveInput(input: SavePageContentInput): SavePageContentInput {
    if (!input || typeof input.pageId !== 'string') {
      throw new Error('Conteúdo da página inválido.')
    }
    const content = this.parsePageContent(input.content)
    if (!content) throw new Error('Conteúdo da página inválido.')
    return { pageId: input.pageId, content }
  }

  private validateUpdateDetailsInput(input: UpdatePageDetailsInput): UpdatePageDetailsInput {
    if (!input || typeof input.pageId !== 'string') throw new Error('Dados da página inválidos.')
    return { pageId: input.pageId, ...this.validateCreateInput(input) }
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
        type: 'title',
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

  private createInitialSimpleContent(page: StoredPage, title: string): PageContent {
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

  private async runCreationExclusively<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.creationTail
    let release: () => void = () => undefined
    this.creationTail = new Promise<void>((resolvePromise) => {
      release = resolvePromise
    })
    await previous
    try {
      return await operation()
    } finally {
      release()
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
    return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(windowsSafeName)
      ? `${windowsSafeName} - Página`
      : windowsSafeName
  }

  private toSummary(
    page: StoredPage,
    previewDataUrl?: string,
    health: PageSummary['health'] = 'healthy',
    canRecover = true,
    healthMessage?: string,
    sourceSync: PageSourceSync = page.source.kind === 'simple'
      ? { state: 'not-applicable' }
      : { state: 'unlinked' }
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
      deployment: page.deployment,
      source: page.source,
      sourceSync,
      ...(healthMessage ? { healthMessage } : {}),
      ...(previewDataUrl ? { previewDataUrl } : {})
    }
  }

  private async readPreview(folderPath: string): Promise<string | undefined> {
    try {
      return this.toPngDataUrl(
        await fileSystem.readFile(join(this.metadataDirectory(folderPath), PREVIEW_FILE))
      )
    } catch {
      return undefined
    }
  }

  private toPngDataUrl(png: Uint8Array): string {
    return `data:image/png;base64,${Buffer.from(png).toString('base64')}`
  }

  private metadataDirectory(folderPath: string): string {
    return join(folderPath, METADATA_FOLDER)
  }

  private packageDirectory(folderPath: string): string {
    return join(this.metadataDirectory(folderPath), PACKAGE_FOLDER)
  }

  private websiteDirectory(folderPath: string): string {
    return join(this.metadataDirectory(folderPath), WEBSITE_FOLDER)
  }

  private userAssetsDirectory(folderPath: string): string {
    return join(this.metadataDirectory(folderPath), USER_ASSETS_FOLDER)
  }

  private damagedWorkspaceId(folderName: string): string {
    return `damaged-${createHash('sha256').update(folderName, 'utf8').digest('hex')}`
  }

  private staticWebsiteSourceKey(sourceDirectory: string): string {
    return createHash('sha256').update(resolve(sourceDirectory).toLowerCase(), 'utf8').digest('hex')
  }

  private markUnpublishedChanges(page: StoredPage): StoredPage {
    if (page.deployment.kind !== 'published') return page
    return {
      ...page,
      deployment: {
        ...page.deployment,
        hasUnpublishedChanges: true
      }
    }
  }

  private async getSourceSync(page: StoredPage): Promise<PageSourceSync> {
    if (page.source.kind === 'simple') return { state: 'not-applicable' }
    if (!page.sourceLink) return { state: 'unlinked' }
    try {
      const signature =
        page.source.kind === 'website'
          ? await getStaticWebsiteSourceSignature(
              await validateStaticWebsite(page.sourceLink.directory)
            )
          : await getPageSpacePackageSourceSignature(
              await validatePageSpacePackage(page.sourceLink.directory)
            )
      return signature === page.sourceLink.signature
        ? { state: 'synced' }
        : { state: 'update-available' }
    } catch {
      return { state: 'unavailable' }
    }
  }

  private async writeStoredPage(folderPath: string, page: StoredPage): Promise<void> {
    await fileSystem.mkdir(this.metadataDirectory(folderPath), { recursive: true })
    await this.writeJsonAtomically(join(this.metadataDirectory(folderPath), METADATA_FILE), page)
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
