import * as fs from 'node:fs'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import git from 'isomorphic-git'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PageDeployment, PageSummary } from '../shared/page-contracts'
import { GitHubPublishingService } from './github-publishing-service'
import { publicationError } from './publication-errors'

type ServiceInternals = {
  createRepository: (
    accessToken: string,
    name: string,
    description: string
  ) => Promise<{
    name: string
    htmlUrl: string
    owner: string
    isPrivate: boolean
    isArchived: boolean
    canPush: boolean
  }>
  verifyRepository: (accessToken: string, owner: string, repository: string) => Promise<void>
  verifyPublishedBranch: (
    accessToken: string,
    folderPath: string,
    deployment: Exclude<PageDeployment, { kind: 'local-only' }>
  ) => Promise<void>
  push: (folderPath: string, accessToken: string) => Promise<void>
  enablePages: (
    accessToken: string,
    owner: string,
    repository: string,
    fallbackUrl: string
  ) => Promise<string>
  githubRequest: (accessToken: string, path: string, init?: RequestInit) => Promise<Response>
}

const temporaryDirectories: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('complete publication workflow', () => {
  it('creates, commits, pushes and confirms a first publication', async () => {
    const harness = await createHarness()

    const result = await harness.service.publish({
      pageId: harness.pageId,
      repositoryName: 'minha-pagina'
    })

    expect(result.outcome).toBe('published')
    expect(result.page.deployment.kind).toBe('published')
    expect(result.page.deployment).toMatchObject({ hasUnpublishedChanges: false })
    expect(harness.createRepository).toHaveBeenCalledTimes(1)
    expect(harness.push).toHaveBeenCalledTimes(1)
    expect(harness.enablePages).toHaveBeenCalledTimes(1)
    expect(harness.transitions.map((deployment) => deployment.kind)).toEqual([
      'publishing',
      'publishing',
      'published'
    ])
    expect(await git.listFiles({ fs, dir: harness.folderPath, ref: 'HEAD' })).toEqual([
      '.gitignore',
      'docs/index.html',
      'docs/styles.css'
    ])
  })

  it('chooses an automatic numbered repository name when the page name is occupied', async () => {
    const harness = await createHarness()
    harness.createRepository
      .mockRejectedValueOnce(
        publicationError('repository_conflict', 'Já existe um repositório com esse nome.')
      )
      .mockResolvedValueOnce({
        name: 'minha-pagina-2',
        htmlUrl: 'https://github.com/conta/minha-pagina-2',
        owner: 'conta',
        isPrivate: false,
        isArchived: false,
        canPush: true
      })

    const result = await harness.service.publish({ pageId: harness.pageId })

    expect(harness.createRepository.mock.calls.map((call) => call[1])).toEqual([
      'minha-pagina',
      'minha-pagina-2'
    ])
    expect(result.page.deployment).toMatchObject({ repository: 'minha-pagina-2' })
  })

  it('retries a failed push without creating a duplicate repository', async () => {
    const harness = await createHarness()
    harness.push
      .mockRejectedValueOnce(publicationError('push_failed', 'Não foi possível enviar ao GitHub.'))
      .mockResolvedValueOnce(undefined)

    await expect(
      harness.service.publish({ pageId: harness.pageId, repositoryName: 'minha-pagina' })
    ).rejects.toMatchObject({ code: 'push_failed' })
    expect(harness.deployment()).toMatchObject({
      kind: 'publishing',
      phase: 'repository-created'
    })

    const retry = await harness.service.publish({ pageId: harness.pageId })
    expect(retry.page.deployment.kind).toBe('published')
    expect(harness.createRepository).toHaveBeenCalledTimes(1)
    expect(harness.push).toHaveBeenCalledTimes(2)
  })

  it('resumes after Pages activation fails without making an empty commit', async () => {
    const harness = await createHarness()
    harness.enablePages
      .mockRejectedValueOnce(new Error('GitHub Pages indisponível.'))
      .mockResolvedValueOnce('https://conta.github.io/minha-pagina/')

    await expect(
      harness.service.publish({ pageId: harness.pageId, repositoryName: 'minha-pagina' })
    ).rejects.toThrow('GitHub Pages indisponível.')
    expect(harness.deployment()).toMatchObject({
      kind: 'publishing',
      phase: 'content-pushed'
    })

    const retry = await harness.service.publish({ pageId: harness.pageId })
    expect(retry.outcome).toBe('no-changes')
    expect(retry.page.deployment.kind).toBe('published')
    expect(harness.createRepository).toHaveBeenCalledTimes(1)
  })

  it('rejects repeated clicks while one publication is active', async () => {
    const harness = await createHarness()
    let releasePush: (() => void) | undefined
    harness.push.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releasePush = resolve
        })
    )

    const firstPublication = harness.service.publish({
      pageId: harness.pageId,
      repositoryName: 'minha-pagina'
    })
    await vi.waitFor(() => expect(harness.push).toHaveBeenCalledTimes(1))

    await expect(harness.service.publish({ pageId: harness.pageId })).rejects.toMatchObject({
      code: 'already_running'
    })
    releasePush?.()
    await firstPublication
    expect(harness.createRepository).toHaveBeenCalledTimes(1)
  })

  it('stops before push when an external repository change is detected', async () => {
    const publishedDeployment: PageDeployment = {
      kind: 'published',
      owner: 'conta',
      repository: 'minha-pagina',
      repositoryUrl: 'https://github.com/conta/minha-pagina',
      publicUrl: 'https://conta.github.io/minha-pagina/',
      publishedAt: '2026-07-27T00:00:00.000Z',
      lastPublishedAt: '2026-07-27T00:00:00.000Z',
      lastCommitOid: 'confirmed'
    }
    const harness = await createHarness(publishedDeployment)
    harness.verifyPublishedBranch.mockRejectedValue(
      publicationError('repository_changed', 'O repositório foi alterado fora do PageSpace.')
    )

    await expect(harness.service.publish({ pageId: harness.pageId })).rejects.toMatchObject({
      code: 'repository_changed'
    })
    expect(harness.push).not.toHaveBeenCalled()
    expect(harness.deployment()).toBe(publishedDeployment)
  })

  it('deletes the remote publication and returns the page to local-only', async () => {
    const harness = await createHarness({
      kind: 'published',
      owner: 'conta',
      repository: 'minha-pagina',
      repositoryUrl: 'https://github.com/conta/minha-pagina',
      publicUrl: 'https://conta.github.io/minha-pagina/',
      publishedAt: '2026-07-27T00:00:00.000Z',
      lastPublishedAt: '2026-07-27T00:00:00.000Z',
      lastCommitOid: 'confirmed'
    })
    await git.addRemote({
      fs,
      dir: harness.folderPath,
      remote: 'origin',
      url: 'https://github.com/conta/minha-pagina.git'
    })

    const result = await harness.service.deletePublication({
      pageId: harness.pageId
    })

    expect(harness.githubRequest).toHaveBeenCalledWith(
      'protected-token',
      '/repos/conta/minha-pagina',
      { method: 'DELETE' }
    )
    expect(result.page.deployment).toEqual({ kind: 'local-only' })
    expect(await git.listRemotes({ fs, dir: harness.folderPath })).toEqual([])
  })

  it('preserves the published state when GitHub rejects deletion', async () => {
    const deployment = publishedDeployment()
    const harness = await createHarness(deployment)
    harness.githubRequest.mockResolvedValueOnce(new Response(null, { status: 403 }))

    await expect(
      harness.service.deletePublication({
        pageId: harness.pageId
      })
    ).rejects.toThrow('PUB-DELETE-02')

    expect(harness.deployment()).toBe(deployment)
  })
})

function publishedDeployment(): PageDeployment {
  return {
    kind: 'published',
    owner: 'conta',
    repository: 'minha-pagina',
    repositoryUrl: 'https://github.com/conta/minha-pagina',
    publicUrl: 'https://conta.github.io/minha-pagina/',
    publishedAt: '2026-07-27T00:00:00.000Z',
    lastPublishedAt: '2026-07-27T00:00:00.000Z',
    lastCommitOid: 'confirmed'
  }
}

// The inferred return preserves the Vitest mock signatures used by each scenario.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function createHarness(initialDeployment: PageDeployment = { kind: 'local-only' }) {
  const folderPath = await mkdtemp(join(tmpdir(), 'pagespace-publish-'))
  temporaryDirectories.push(folderPath)
  await mkdir(join(folderPath, 'docs'))
  await writeFile(join(folderPath, '.gitignore'), '.pagespace/\ncontent.json\n', 'utf8')
  await writeFile(
    join(folderPath, 'docs', 'index.html'),
    '<!doctype html><title>Teste</title>',
    'utf8'
  )
  await writeFile(join(folderPath, 'docs', 'styles.css'), 'body { color: #333; }', 'utf8')
  await writeFile(join(folderPath, 'data.json'), '{"private":true}', 'utf8')
  await mkdir(join(folderPath, '.pagespace'))
  await writeFile(join(folderPath, '.pagespace', 'page.json'), '{"private":true}', 'utf8')
  await git.init({ fs, dir: folderPath, defaultBranch: 'main' })

  const pageId = 'page-id'
  let currentDeployment = initialDeployment
  const transitions: PageDeployment[] = []
  const summary = (): PageSummary => ({
    id: pageId,
    name: 'Minha página',
    description: 'Descrição',
    status: currentDeployment.kind === 'published' ? 'published' : 'local',
    createdAt: '2026-07-27T00:00:00.000Z',
    updatedAt: '2026-07-27T00:00:00.000Z',
    lastSavedAt: null,
    folderName: 'Minha página',
    health: 'healthy',
    canRecover: true,
    deployment: currentDeployment,
    source: { kind: 'simple' },
    sourceSync: { state: 'not-applicable' }
  })
  const auth = {
    getAuthenticatedSession: vi.fn().mockResolvedValue({
      account: {
        id: 123,
        login: 'conta',
        name: 'Conta',
        avatarUrl: 'https://avatars.githubusercontent.com/u/123',
        profileUrl: 'https://github.com/conta'
      },
      accessToken: 'protected-token'
    })
  }
  const pages = {
    getPage: vi.fn().mockImplementation(async () => ({ kind: 'simple', page: summary() })),
    getPageFolderPath: vi.fn().mockResolvedValue(folderPath),
    preparePageForPublishing: vi.fn().mockImplementation(async () => ({
      folderPath,
      name: 'Minha página',
      description: 'Descrição',
      deployment: currentDeployment,
      publishablePaths: ['.gitignore', 'docs/index.html', 'docs/styles.css']
    })),
    updatePageDeployment: vi.fn().mockImplementation(async (_pageId, deployment) => {
      currentDeployment = deployment
      transitions.push(deployment)
      return summary()
    })
  }
  const service = new GitHubPublishingService(auth as never, pages as never)
  const internals = service as unknown as ServiceInternals
  const githubRequest = vi
    .spyOn(internals, 'githubRequest')
    .mockResolvedValue(new Response(null, { status: 204 }))
  const createRepository = vi.spyOn(internals, 'createRepository').mockResolvedValue({
    name: 'minha-pagina',
    htmlUrl: 'https://github.com/conta/minha-pagina',
    owner: 'conta',
    isPrivate: false,
    isArchived: false,
    canPush: true
  })
  vi.spyOn(internals, 'verifyRepository').mockResolvedValue()
  const verifyPublishedBranch = vi.spyOn(internals, 'verifyPublishedBranch').mockResolvedValue()
  const push = vi.spyOn(internals, 'push').mockResolvedValue()
  const enablePages = vi
    .spyOn(internals, 'enablePages')
    .mockResolvedValue('https://conta.github.io/minha-pagina/')

  return {
    service,
    pageId,
    folderPath,
    transitions,
    deployment: () => currentDeployment,
    createRepository,
    githubRequest,
    verifyPublishedBranch,
    push,
    enablePages
  }
}
