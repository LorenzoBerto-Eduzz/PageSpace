import * as fs from 'node:fs'
import git from 'isomorphic-git'
import http from 'isomorphic-git/http/node'
import type {
  DeletePublicationInput,
  DeletePublicationResult,
  PageDeployment,
  PublishPageInput,
  PublishPageResult,
  PublishingPageDeployment
} from '../shared/page-contracts'
import { GITHUB_API_VERSION } from './github-config'
import type { GitHubAuthService } from './github-auth-service'
import type { PageSpaceWorkspaceService, PublishingWorkspace } from './pagespace-workspace-service'
import {
  canAcceptRemoteHead,
  isManagedDocsPath,
  isPublishablePath,
  isSafePagesUrl,
  isSafeStagedChange,
  publicUrlFor,
  validateRepositoryName
} from './publication-policy'
import type { PublicationDiagnostics } from './publication-diagnostics'
import { normalizePublicationError, PublicationError, publicationError } from './publication-errors'

type GitHubRepository = {
  name: string
  htmlUrl: string
  owner: string
  isPrivate: boolean
  isArchived: boolean
  canPush: boolean
}

const GITHUB_REQUEST_TIMEOUT_MS = 20_000

export class GitHubPublishingService {
  private readonly activePublications = new Map<string, Promise<PublishPageResult>>()
  private readonly activeDeletions = new Set<string>()

  constructor(
    private readonly auth: GitHubAuthService,
    private readonly pages: PageSpaceWorkspaceService,
    private readonly diagnostics?: PublicationDiagnostics
  ) {}

  hasActivePublications(): boolean {
    return this.activePublications.size > 0 || this.activeDeletions.size > 0
  }

  async deletePublication(input: DeletePublicationInput): Promise<DeletePublicationResult> {
    if (!input || typeof input.pageId !== 'string' || !input.pageId) {
      throw new Error('A página selecionada é inválida. | PUB-DELETE-01')
    }
    if (this.activePublications.has(input.pageId) || this.activeDeletions.has(input.pageId)) {
      throw new Error('Esta publicação já possui uma operação em andamento. Aguarde a conclusão.')
    }

    this.activeDeletions.add(input.pageId)
    try {
      return await this.deletePublicationOnce(input)
    } finally {
      this.activeDeletions.delete(input.pageId)
    }
  }

  private async deletePublicationOnce(
    input: DeletePublicationInput
  ): Promise<DeletePublicationResult> {
    const session = await this.auth.getAuthenticatedSession('excluir')
    const editorData = await this.pages.getPage(input.pageId)
    const deployment = editorData.page.deployment
    if (deployment.kind !== 'published') {
      throw new Error('Esta página não possui uma publicação para excluir.')
    }
    this.assertDeploymentOwner(deployment, session.account.login)
    const response = await this.githubRequest(
      session.accessToken,
      `/repos/${encodeURIComponent(deployment.owner)}/${encodeURIComponent(deployment.repository)}`,
      { method: 'DELETE' }
    )
    if (response.status !== 204 && response.status !== 404) {
      if (response.status === 403) {
        throw new Error(
          'O GitHub não autorizou a exclusão. Desvincule a conta, vincule novamente e tente outra vez. | PUB-DELETE-02'
        )
      }
      throw new Error(
        'Não foi possível excluir o repositório no GitHub. Tente novamente. | PUB-DELETE-03'
      )
    }

    const folderPath = await this.pages.getPageFolderPath(input.pageId)
    if (
      (await git.listRemotes({ fs, dir: folderPath })).some(({ remote }) => remote === 'origin')
    ) {
      await git.deleteRemote({ fs, dir: folderPath, remote: 'origin' })
    }
    return {
      page: await this.pages.updatePageDeployment(input.pageId, { kind: 'local-only' })
    }
  }

  async publish(input: PublishPageInput): Promise<PublishPageResult> {
    if (!input || typeof input.pageId !== 'string' || !input.pageId) {
      throw new Error('Página inválida.')
    }

    if (this.activePublications.has(input.pageId) || this.activeDeletions.has(input.pageId)) {
      throw publicationError(
        'already_running',
        'Esta página já está sendo publicada. Aguarde a conclusão.'
      )
    }

    const startedAt = Date.now()
    await this.diagnostics?.record({
      event: 'started',
      at: new Date(startedAt).toISOString(),
      pageId: input.pageId
    })
    const publication = this.publishOnce(input)
    this.activePublications.set(input.pageId, publication)
    try {
      const result = await publication
      await this.diagnostics?.record({
        event: 'completed',
        at: new Date().toISOString(),
        pageId: input.pageId,
        durationMs: Date.now() - startedAt
      })
      return result
    } catch (error) {
      const failure = normalizePublicationError(error)
      await this.diagnostics?.record({
        event: 'failed',
        at: new Date().toISOString(),
        pageId: input.pageId,
        durationMs: Date.now() - startedAt,
        code: failure.code
      })
      throw failure
    } finally {
      if (this.activePublications.get(input.pageId) === publication) {
        this.activePublications.delete(input.pageId)
      }
    }
  }

  private async publishOnce(input: PublishPageInput): Promise<PublishPageResult> {
    const session = await this.auth.getAuthenticatedSession()
    const workspace = await this.pages.preparePageForPublishing(input.pageId)
    let deployment = workspace.deployment

    if (deployment.kind === 'local-only') {
      const repository = await this.createAvailableRepository(
        session.accessToken,
        workspace.name,
        workspace.description
      )
      if (repository.owner.toLowerCase() !== session.account.login.toLowerCase()) {
        throw new Error('O GitHub criou o repositório em uma conta diferente da conta vinculada.')
      }
      deployment = {
        kind: 'publishing',
        owner: repository.owner,
        repository: repository.name,
        repositoryUrl: repository.htmlUrl,
        publicUrl: publicUrlFor(repository.owner, repository.name),
        phase: 'repository-created'
      }
      await this.pages.updatePageDeployment(input.pageId, deployment)
    }

    this.assertDeploymentOwner(deployment, session.account.login)
    await this.verifyRepository(session.accessToken, deployment.owner, deployment.repository)
    await this.verifyPublishedBranch(session.accessToken, workspace.folderPath, deployment)
    const repositoryUrl = `https://github.com/${deployment.owner}/${deployment.repository}.git`
    await this.ensureOrigin(workspace.folderPath, repositoryUrl)
    const commit = await this.commitGeneratedWebsite(
      workspace,
      deployment,
      session.account.login,
      session.account.id
    )

    if (deployment.kind === 'published' && commit.oid !== deployment.lastCommitOid) {
      deployment = {
        ...deployment,
        pendingCommitOid: commit.oid
      }
      await this.pages.updatePageDeployment(input.pageId, deployment)
    }

    await this.push(workspace.folderPath, session.accessToken)
    if (deployment.kind === 'publishing') {
      const contentPushed: PublishingPageDeployment = {
        kind: 'publishing',
        owner: deployment.owner,
        repository: deployment.repository,
        repositoryUrl: deployment.repositoryUrl,
        publicUrl: deployment.publicUrl,
        phase: 'content-pushed'
      }
      await this.pages.updatePageDeployment(input.pageId, contentPushed)
    }

    const publicUrl = await this.enablePages(
      session.accessToken,
      deployment.owner,
      deployment.repository,
      deployment.publicUrl
    )
    const now = new Date().toISOString()
    const firstPublishedAt = deployment.kind === 'published' ? deployment.publishedAt : now
    const published: PageDeployment = {
      kind: 'published',
      owner: deployment.owner,
      repository: deployment.repository,
      repositoryUrl: deployment.repositoryUrl,
      publicUrl,
      publishedAt: firstPublishedAt,
      lastPublishedAt: now,
      lastCommitOid: commit.oid,
      hasUnpublishedChanges: false
    }

    return {
      page: await this.pages.updatePageDeployment(input.pageId, published),
      outcome: commit.changed ? 'published' : 'no-changes'
    }
  }

  private async createAvailableRepository(
    accessToken: string,
    pageName: string,
    description: string
  ): Promise<GitHubRepository> {
    const baseName = repositoryNameFromPageName(pageName)
    for (let attempt = 1; attempt <= 100; attempt += 1) {
      const suffix = attempt === 1 ? '' : `-${attempt}`
      const candidate = `${baseName.slice(0, 100 - suffix.length)}${suffix}`
      try {
        return await this.createRepository(accessToken, candidate, description)
      } catch (error) {
        if (!(error instanceof PublicationError) || error.code !== 'repository_conflict')
          throw error
      }
    }
    throw publicationError(
      'repository_conflict',
      'Não foi possível encontrar automaticamente um nome disponível para esta página.'
    )
  }

  private async createRepository(
    accessToken: string,
    name: string,
    description: string
  ): Promise<GitHubRepository> {
    const response = await this.githubRequest(accessToken, '/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description: description.slice(0, 350),
        private: false,
        auto_init: false,
        has_issues: false,
        has_projects: false,
        has_wiki: false
      })
    })
    if (response.status === 422) {
      throw publicationError(
        'repository_conflict',
        'Já existe um repositório com esse nome nessa conta. Escolha outro nome para publicar.'
      )
    }
    await this.assertGitHubResponse(response, 'Não foi possível criar o repositório público.')
    return parseRepository(
      await response.json(),
      'O GitHub retornou dados inválidos para o novo repositório.'
    )
  }

  private async verifyRepository(
    accessToken: string,
    owner: string,
    repository: string
  ): Promise<void> {
    const response = await this.githubRequest(
      accessToken,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`
    )
    if (response.status === 404) {
      throw publicationError(
        'repository_missing',
        'O repositório configurado não foi encontrado. Ele pode ter sido renomeado ou excluído no GitHub.'
      )
    }
    await this.assertGitHubResponse(
      response,
      'Não foi possível verificar o repositório configurado.'
    )
    const remote = parseRepository(
      await response.json(),
      'O GitHub retornou dados inválidos para o repositório configurado.'
    )
    if (
      remote.owner.toLowerCase() !== owner.toLowerCase() ||
      remote.name.toLowerCase() !== repository.toLowerCase()
    ) {
      throw new Error('O repositório encontrado não corresponde ao destino salvo nesta página.')
    }
    if (remote.isPrivate) {
      throw new Error('O repositório deixou de ser público. A publicação foi interrompida.')
    }
    if (remote.isArchived) {
      throw new Error('O repositório está arquivado e não pode receber atualizações.')
    }
    if (!remote.canPush) {
      throw new Error('A conta vinculada não possui permissão para atualizar este repositório.')
    }
  }

  private async verifyPublishedBranch(
    accessToken: string,
    folderPath: string,
    deployment: Exclude<PageDeployment, { kind: 'local-only' }>
  ): Promise<void> {
    if (deployment.kind !== 'published') return

    const response = await this.githubRequest(
      accessToken,
      `/repos/${encodeURIComponent(deployment.owner)}/${encodeURIComponent(
        deployment.repository
      )}/git/ref/heads/main`
    )
    if (response.status === 404) {
      throw new Error('A branch principal do site não foi encontrada no GitHub.')
    }
    await this.assertGitHubResponse(
      response,
      'Não foi possível verificar a versão publicada no GitHub.'
    )
    const value = (await response.json()) as Record<string, unknown>
    const object = value.object as Record<string, unknown> | undefined
    if (typeof object?.sha !== 'string') {
      throw new Error('O GitHub retornou uma versão inválida para o site publicado.')
    }

    let localHead: string | null = null
    try {
      localHead = await git.resolveRef({ fs, dir: folderPath, ref: 'HEAD' })
    } catch {
      // The comparison below safely rejects a published page without local history.
    }
    if (!canAcceptRemoteHead(object.sha, deployment.lastCommitOid, localHead)) {
      throw publicationError(
        'repository_changed',
        'O repositório foi alterado fora do PageSpace. A publicação foi interrompida para não sobrescrever essas mudanças.'
      )
    }
  }

  private async ensureOrigin(folderPath: string, expectedUrl: string): Promise<void> {
    const remotes = await git.listRemotes({ fs, dir: folderPath })
    const origin = remotes.find((remote) => remote.remote === 'origin')
    if (origin && origin.url !== expectedUrl) {
      throw new Error('A pasta local já possui um destino Git diferente do esperado.')
    }
    if (!origin) {
      await git.addRemote({ fs, dir: folderPath, remote: 'origin', url: expectedUrl })
    }
  }

  private async commitGeneratedWebsite(
    workspace: PublishingWorkspace,
    deployment: Exclude<PageDeployment, { kind: 'local-only' }>,
    login: string,
    accountId: number
  ): Promise<{ oid: string; changed: boolean }> {
    const matrix = await git.statusMatrix({ fs, dir: workspace.folderPath })
    for (const [filepath, head, workdir, stage] of matrix) {
      if (!isPublishablePath(filepath, workspace.publishablePaths) && head !== stage) {
        await git.resetIndex({ fs, dir: workspace.folderPath, filepath })
      }
      if (head !== 0 && workdir === 0 && isManagedDocsPath(filepath)) {
        await git.remove({ fs, dir: workspace.folderPath, filepath })
      }
    }
    for (const filepath of workspace.publishablePaths) {
      await git.add({ fs, dir: workspace.folderPath, filepath })
    }

    const staged = await git.statusMatrix({ fs, dir: workspace.folderPath })
    const unsafeStagedChange = staged.some(
      ([filepath, head, , stage]) =>
        !isSafeStagedChange(filepath, head, stage, workspace.publishablePaths)
    )
    if (unsafeStagedChange) {
      throw publicationError(
        'unsafe_output',
        'A publicação foi interrompida porque o histórico local contém arquivos fora da lista pública permitida.'
      )
    }
    const changed = staged.some(
      ([filepath, head, , stage]) =>
        head !== stage &&
        (isPublishablePath(filepath, workspace.publishablePaths) ||
          (isManagedDocsPath(filepath) && stage === 0))
    )
    if (!changed) {
      return {
        oid: await git.resolveRef({ fs, dir: workspace.folderPath, ref: 'HEAD' }),
        changed: false
      }
    }

    const oid = await git.commit({
      fs,
      dir: workspace.folderPath,
      message: deployment.kind === 'published' ? 'Atualizar página' : 'Publicar página',
      author: {
        name: login,
        email: `${accountId}+${login}@users.noreply.github.com`
      }
    })
    return { oid, changed: true }
  }

  private async push(folderPath: string, accessToken: string): Promise<void> {
    try {
      await git.push({
        fs,
        http,
        dir: folderPath,
        remote: 'origin',
        ref: 'main',
        onAuth: () => ({ username: 'x-access-token', password: accessToken })
      })
    } catch {
      throw publicationError(
        'push_failed',
        'O conteúdo foi salvo localmente, mas não foi possível enviá-lo ao GitHub. Tente publicar novamente.'
      )
    }
  }

  private async enablePages(
    accessToken: string,
    owner: string,
    repository: string,
    fallbackUrl: string
  ): Promise<string> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/pages`
    let response = await this.githubRequest(accessToken, path)
    if (response.status === 404) {
      response = await this.githubRequest(accessToken, path, {
        method: 'POST',
        body: JSON.stringify({ source: { branch: 'main', path: '/docs' } })
      })
    } else if (response.ok) {
      const current = (await response.clone().json()) as Record<string, unknown>
      const source = current.source as Record<string, unknown> | undefined
      if (source?.branch !== 'main' || source?.path !== '/docs') {
        response = await this.githubRequest(accessToken, path, {
          method: 'PUT',
          body: JSON.stringify({ source: { branch: 'main', path: '/docs' } })
        })
      }
    }
    await this.assertGitHubResponse(response, 'Não foi possível ativar o endereço público.')

    const status = await this.githubRequest(accessToken, path)
    if (!status.ok) return fallbackUrl
    const value = (await status.json()) as Record<string, unknown>
    return isSafePagesUrl(value.html_url) ? value.html_url : fallbackUrl
  }

  private async githubRequest(
    accessToken: string,
    path: string,
    init: RequestInit = {}
  ): Promise<Response> {
    try {
      return await fetch(`https://api.github.com${path}`, {
        ...init,
        signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
          'User-Agent': 'PageSpace',
          ...init.headers
        }
      })
    } catch {
      throw publicationError(
        'github_unavailable',
        'Não foi possível acessar o GitHub. Verifique sua conexão e tente novamente.'
      )
    }
  }

  private async assertGitHubResponse(response: Response, message: string): Promise<void> {
    if (response.ok) return
    if (response.status === 401) {
      throw new Error('A vinculação com o GitHub expirou. Vincule a conta novamente.')
    }
    if (response.status === 403) {
      throw new Error('O GitHub não autorizou esta publicação. Verifique a conta vinculada.')
    }
    throw new Error(message)
  }

  private assertDeploymentOwner(
    deployment: PageDeployment,
    connectedLogin: string
  ): asserts deployment is Exclude<PageDeployment, { kind: 'local-only' }> {
    if (deployment.kind === 'local-only') throw new Error('A publicação ainda não foi configurada.')
    if (deployment.owner.toLowerCase() !== connectedLogin.toLowerCase()) {
      throw new Error(
        `Esta página pertence à conta @${deployment.owner}. Vincule essa conta para publicar.`
      )
    }
  }
}

function repositoryNameFromPageName(pageName: string): string {
  const normalized = pageName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 100)
  return validateRepositoryName(normalized || 'minha-pagina')
}

function parseRepository(value: unknown, errorMessage: string): GitHubRepository {
  if (!value || typeof value !== 'object') throw new Error(errorMessage)
  const repository = value as Record<string, unknown>
  const owner = repository.owner as Record<string, unknown> | undefined
  const permissions = repository.permissions as Record<string, unknown> | undefined
  if (
    typeof repository.name !== 'string' ||
    typeof repository.html_url !== 'string' ||
    typeof repository.private !== 'boolean' ||
    typeof repository.archived !== 'boolean' ||
    typeof owner?.login !== 'string'
  ) {
    throw new Error(errorMessage)
  }
  let htmlUrl: URL
  try {
    htmlUrl = new URL(repository.html_url)
  } catch {
    throw new Error(errorMessage)
  }
  if (htmlUrl.protocol !== 'https:' || htmlUrl.hostname !== 'github.com') {
    throw new Error(errorMessage)
  }
  return {
    name: repository.name,
    htmlUrl: htmlUrl.toString(),
    owner: owner.login,
    isPrivate: repository.private,
    isArchived: repository.archived,
    canPush: permissions?.push !== false
  }
}
