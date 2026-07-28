import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  generatePackageSite,
  installValidatedPackage,
  reconcileEditableContent,
  validateEditableContent,
  validatePageSpacePackage
} from './pagespace-package-service'
import type {
  PageSpaceEditableContent,
  PageSpaceEditableSchema
} from '../shared/pagespace-package-contracts'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'pagespace-package-'))
  temporaryDirectories.push(directory)
  return directory
}

async function createEditablePackage(root: string, version = '1.0.0'): Promise<void> {
  await mkdir(join(root, 'site', 'assets'), { recursive: true })
  await writeFile(
    join(root, 'pagespace.json'),
    JSON.stringify({
      schemaVersion: 1,
      packageId: 'com.example.dashboard',
      packageVersion: version,
      name: 'Example Dashboard',
      description: 'A test package',
      mode: 'editable',
      entryPoint: 'index.html'
    }),
    'utf8'
  )
  await writeFile(
    join(root, 'site', 'index.html'),
    '<!doctype html><script src="./pagespace-content.js"></script><script src="./page.js"></script>',
    'utf8'
  )
  await writeFile(
    join(root, 'site', 'page.js'),
    'document.body.textContent = window.PAGESPACE_CONTENT.title',
    'utf8'
  )
  await writeFile(join(root, 'site', 'assets', 'theme.css'), 'body { color: #123456; }', 'utf8')
  await writeFile(
    join(root, 'editables.json'),
    JSON.stringify({
      schemaVersion: 1,
      fields: [
        {
          key: 'title',
          type: 'text',
          label: 'Title',
          required: true,
          maxLength: 100
        },
        {
          key: 'links',
          type: 'collection',
          label: 'Links',
          itemLabel: 'Link',
          fields: [
            {
              key: 'url',
              type: 'url',
              label: 'Address',
              required: true
            }
          ]
        }
      ]
    }),
    'utf8'
  )
  await writeFile(
    join(root, 'content.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        title: 'Dashboard',
        links: [{ _id: 'first', url: 'https://example.com/' }]
      }
    }),
    'utf8'
  )
}

describe('PageSpace package validation and baking', () => {
  it('validates and bakes an editable package with generated content', async () => {
    const source = await temporaryDirectory()
    const workspace = await temporaryDirectory()
    await createEditablePackage(source)

    const candidate = await validatePageSpacePackage(source)
    const installed = join(workspace, 'package')
    const metadata = join(workspace, '.pagespace')
    await mkdir(metadata)
    await installValidatedPackage(candidate, installed)

    const generated = await generatePackageSite(
      metadata,
      installed,
      candidate.content,
      join(metadata, 'user-assets')
    )

    expect(candidate.manifest.mode).toBe('editable')
    expect(generated.manifest.files.map((file) => file.path)).toEqual([
      'assets/theme.css',
      'index.html',
      'page.js',
      'pagespace-content.js'
    ])
    expect(await readFile(generated.indexPath, 'utf8')).toContain('pagespace-content.js')
    expect(await readFile(join(generated.directoryPath, 'pagespace-content.js'), 'utf8')).toContain(
      '"title":"Dashboard"'
    )
  })

  it('bakes private user assets into the public output without exposing package metadata', async () => {
    const source = await temporaryDirectory()
    const workspace = await temporaryDirectory()
    await createEditablePackage(source)

    const candidate = await validatePageSpacePackage(source)
    const installed = join(workspace, 'package')
    const metadata = join(workspace, '.pagespace')
    const userAssets = join(metadata, 'user-assets')
    await mkdir(userAssets, { recursive: true })
    await writeFile(join(userAssets, 'hero.png'), 'safe-image')
    await installValidatedPackage(candidate, installed)

    const generated = await generatePackageSite(metadata, installed, candidate.content, userAssets)

    expect(await readFile(join(generated.directoryPath, 'user-assets', 'hero.png'), 'utf8')).toBe(
      'safe-image'
    )
    expect(generated.manifest.files.map((file) => file.path)).toContain('user-assets/hero.png')
    expect(generated.manifest.files.map((file) => file.path)).not.toContain('pagespace.json')
  })

  it('rejects editable packages that do not load the PageSpace content contract', async () => {
    const source = await temporaryDirectory()
    await createEditablePackage(source)
    await writeFile(join(source, 'site', 'index.html'), '<!doctype html><title>Missing</title>')

    await expect(validatePageSpacePackage(source)).rejects.toThrow('pagespace-content.js')
  })

  it('rejects unsupported executable files', async () => {
    const source = await temporaryDirectory()
    await createEditablePackage(source)
    await writeFile(join(source, 'site', 'unsafe.exe'), 'not an executable')

    await expect(validatePageSpacePackage(source)).rejects.toThrow('não é permitido')
  })

  it('validates URL fields and preserves compatible values during package updates', () => {
    const schema: PageSpaceEditableSchema = {
      schemaVersion: 1,
      fields: [
        { key: 'title', type: 'text', label: 'Title', required: true },
        { key: 'address', type: 'url', label: 'Address', required: true }
      ]
    }
    const current: PageSpaceEditableContent = validateEditableContent(
      {
        schemaVersion: 1,
        values: { title: 'Saved title', address: 'https://example.com/current' }
      },
      schema
    )
    const defaults: PageSpaceEditableContent = validateEditableContent(
      {
        schemaVersion: 1,
        values: { title: 'New default', address: 'https://example.com/default' }
      },
      schema
    )

    expect(reconcileEditableContent(current, schema, defaults, schema).values).toEqual(
      current.values
    )
    expect(() =>
      validateEditableContent(
        {
          schemaVersion: 1,
          values: { title: 'Title', address: 'javascript:alert(1)' }
        },
        schema
      )
    ).toThrow('inválido')
  })
})
