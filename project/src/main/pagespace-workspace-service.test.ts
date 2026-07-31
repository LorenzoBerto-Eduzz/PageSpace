import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PageSpaceWorkspaceService } from './pagespace-workspace-service'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

async function createPackage(
  root: string,
  version: string,
  defaultTitle: string,
  extraField = false
): Promise<void> {
  await mkdir(join(root, 'site'), { recursive: true })
  await writeFile(
    join(root, 'pagespace.json'),
    JSON.stringify({
      schemaVersion: 1,
      packageId: 'com.example.workspace-test',
      packageVersion: version,
      name: 'Workspace Test',
      description: 'Imported package',
      mode: 'editable',
      entryPoint: 'index.html'
    })
  )
  await writeFile(
    join(root, 'site', 'index.html'),
    '<!doctype html><script src="./pagespace-content.js"></script><script src="./page.js"></script>'
  )
  await writeFile(
    join(root, 'site', 'page.js'),
    'document.body.textContent = window.PAGESPACE_CONTENT.title'
  )
  const fields: Array<Record<string, unknown>> = [
    { key: 'title', type: 'text', label: 'Title', required: true }
  ]
  if (extraField) fields.push({ key: 'accent', type: 'color', label: 'Accent' })
  await writeFile(join(root, 'editables.json'), JSON.stringify({ schemaVersion: 1, fields }))
  await writeFile(
    join(root, 'content.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        title: defaultTitle,
        ...(extraField ? { accent: '#d4a63f' } : {})
      }
    })
  )
}

describe('PageSpace workspace package lifecycle', () => {
  it('imports, edits, updates, previews, and prepares an editable package for publication', async () => {
    const pagesRoot = await temporaryDirectory('pagespace-pages-')
    const packageV1 = await temporaryDirectory('pagespace-source-v1-')
    const packageV2 = await temporaryDirectory('pagespace-source-v2-')
    await createPackage(packageV1, '1.0.0', 'Default title')
    await createPackage(packageV2, '2.0.0', 'New default', true)
    const workspace = new PageSpaceWorkspaceService(pagesRoot)

    const imported = await workspace.importPage(packageV1)
    expect(imported.outcome).toBe('imported')
    expect(imported.page.source).toEqual({
      kind: 'package',
      packageId: 'com.example.workspace-test',
      packageVersion: '1.0.0',
      mode: 'editable'
    })

    const opened = await workspace.getPage(imported.page.id)
    expect(opened.kind).toBe('package')
    if (opened.kind !== 'package' || !opened.content) throw new Error('Expected editable package')
    opened.content.values.title = 'Owner title'
    const saved = await workspace.savePackageContent({
      pageId: imported.page.id,
      content: opened.content
    })
    expect(saved.page.lastSavedAt).not.toBeNull()

    const updated = await workspace.importPage(packageV2)
    expect(updated.outcome).toBe('updated')
    expect(updated.page.id).toBe(imported.page.id)
    expect(updated.page.source.kind === 'package' && updated.page.source.packageVersion).toBe(
      '2.0.0'
    )
    const reopened = await workspace.getPage(imported.page.id)
    if (reopened.kind !== 'package' || !reopened.content) throw new Error('Expected package')
    expect(reopened.content.values).toEqual({
      title: 'Owner title',
      accent: '#d4a63f'
    })

    const generated = await workspace.generatePageSite(imported.page.id)
    expect(await readFile(join(generated.directoryPath, 'pagespace-content.js'), 'utf8')).toContain(
      '"title":"Owner title"'
    )

    const publication = await workspace.preparePageForPublishing(imported.page.id)
    expect(publication.publishablePaths).toEqual([
      '.gitignore',
      'docs/index.html',
      'docs/page.js',
      'docs/pagespace-content.js'
    ])
  })

  it('keeps basic page creation available', async () => {
    const pagesRoot = await temporaryDirectory('pagespace-simple-')
    const workspace = new PageSpaceWorkspaceService(pagesRoot)
    const page = await workspace.createPage({ name: 'Simple Page', description: '' })

    expect(page.source).toEqual({ kind: 'simple' })
    const opened = await workspace.getPage(page.id)
    expect(opened.kind).toBe('simple')
    expect((await workspace.generatePageSite(page.id)).indexPath).toContain('index.html')
  })

  it('imports an ordinary browser-ready website from a conventional output folder', async () => {
    const pagesRoot = await temporaryDirectory('pagespace-pages-')
    const websiteRoot = await temporaryDirectory('ordinary-dashboard-')
    await mkdir(join(websiteRoot, 'dist', 'assets'), { recursive: true })
    await writeFile(
      join(websiteRoot, 'dist', 'index.html'),
      '<!doctype html><link rel="stylesheet" href="./assets/site.css"><h1>Ordinary page</h1>'
    )
    await writeFile(join(websiteRoot, 'dist', 'assets', 'site.css'), 'h1 { color: navy; }')
    const workspace = new PageSpaceWorkspaceService(pagesRoot)

    const imported = await workspace.importPage(websiteRoot)
    expect(imported.outcome).toBe('imported')
    expect(imported.page.source.kind).toBe('website')
    expect(imported.page.sourceSync.state).toBe('synced')

    const opened = await workspace.getPage(imported.page.id)
    expect(opened.kind).toBe('website')
    const generated = await workspace.generatePageSite(imported.page.id)
    expect(await readFile(generated.indexPath, 'utf8')).toContain('Ordinary page')

    const publication = await workspace.preparePageForPublishing(imported.page.id)
    expect(publication.publishablePaths).toEqual([
      '.gitignore',
      'docs/assets/site.css',
      'docs/index.html'
    ])

    await workspace.updatePageDeployment(imported.page.id, {
      kind: 'published',
      owner: 'conta',
      repository: 'ordinary-dashboard',
      repositoryUrl: 'https://github.com/conta/ordinary-dashboard',
      publicUrl: 'https://conta.github.io/ordinary-dashboard/',
      publishedAt: '2026-07-31T00:00:00.000Z',
      lastPublishedAt: '2026-07-31T00:00:00.000Z',
      lastCommitOid: 'published-commit',
      hasUnpublishedChanges: false
    })

    await writeFile(
      join(websiteRoot, 'dist', 'index.html'),
      '<!doctype html><h1>Updated ordinary page</h1>'
    )
    const changedPage = (await workspace.listPages()).find((page) => page.id === imported.page.id)
    expect(changedPage?.sourceSync.state).toBe('update-available')

    const updated = await workspace.refreshPageFromSource(imported.page.id)
    expect(updated.id).toBe(imported.page.id)
    expect(updated.sourceSync.state).toBe('synced')
    expect(updated.deployment).toMatchObject({
      kind: 'published',
      hasUnpublishedChanges: true
    })
    expect(
      await readFile((await workspace.generatePageSite(imported.page.id)).indexPath, 'utf8')
    ).toContain('Updated ordinary page')
  })
})
