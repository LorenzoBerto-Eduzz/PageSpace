import { createHash, randomUUID } from 'node:crypto'
import { promises as fileSystem } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { PageContent } from '../shared/page-contracts'

const GENERATED_SITE_FOLDER = 'generated-site'
const GENERATED_SITE_MANIFEST = 'generated-site-manifest.json'
const GENERATED_FILES = ['index.html', 'styles.css'] as const

type GeneratedSiteManifest = {
  schemaVersion: 1
  generatedAt: string
  files: Array<{
    path: (typeof GENERATED_FILES)[number]
    sha256: string
    bytes: number
  }>
}

export type GeneratedSite = {
  directoryPath: string
  indexPath: string
  manifest: GeneratedSiteManifest
}

export async function generatePublicSite(
  metadataDirectory: string,
  content: PageContent
): Promise<GeneratedSite> {
  const outputDirectory = join(metadataDirectory, GENERATED_SITE_FOLDER)
  const temporaryDirectory = join(
    metadataDirectory,
    `.${GENERATED_SITE_FOLDER}-${randomUUID()}.tmp`
  )
  const backupDirectory = join(
    metadataDirectory,
    `.${GENERATED_SITE_FOLDER}-${randomUUID()}.backup`
  )

  await fileSystem.mkdir(temporaryDirectory, { recursive: false })

  try {
    const generatedFiles = {
      'index.html': renderPublicHtml(content),
      'styles.css': renderPublicStyles(content)
    } satisfies Record<(typeof GENERATED_FILES)[number], string>

    await Promise.all(
      GENERATED_FILES.map((fileName) =>
        fileSystem.writeFile(join(temporaryDirectory, fileName), generatedFiles[fileName], 'utf8')
      )
    )

    const manifest: GeneratedSiteManifest = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      files: GENERATED_FILES.map((fileName) => {
        const file = Buffer.from(generatedFiles[fileName], 'utf8')
        return {
          path: fileName,
          sha256: createHash('sha256').update(file).digest('hex'),
          bytes: file.byteLength
        }
      })
    }

    await verifyGeneratedSite(temporaryDirectory, manifest)

    const hadExistingOutput = await pathExists(outputDirectory)
    if (hadExistingOutput) await fileSystem.rename(outputDirectory, backupDirectory)

    try {
      await fileSystem.rename(temporaryDirectory, outputDirectory)
      await writeManifestAtomically(metadataDirectory, manifest)
      if (hadExistingOutput) {
        await fileSystem.rm(backupDirectory, { recursive: true, force: true })
      }
    } catch (error) {
      if (hadExistingOutput && !(await pathExists(outputDirectory))) {
        await fileSystem.rename(backupDirectory, outputDirectory)
      }
      throw error
    }

    return {
      directoryPath: outputDirectory,
      indexPath: join(outputDirectory, 'index.html'),
      manifest
    }
  } catch (error) {
    await fileSystem.rm(temporaryDirectory, { recursive: true, force: true })
    await fileSystem.rm(backupDirectory, { recursive: true, force: true })
    throw error
  }
}

async function verifyGeneratedSite(
  directoryPath: string,
  manifest: GeneratedSiteManifest
): Promise<void> {
  const entries = await fileSystem.readdir(directoryPath, { withFileTypes: true })
  const allowedFiles = new Set<string>(GENERATED_FILES)

  if (
    entries.length !== allowedFiles.size ||
    entries.some((entry) => !entry.isFile() || !allowedFiles.has(entry.name))
  ) {
    throw new Error('A saída pública contém arquivos inesperados.')
  }

  for (const expectedFile of manifest.files) {
    const file = await fileSystem.readFile(join(directoryPath, expectedFile.path))
    const sha256 = createHash('sha256').update(file).digest('hex')
    if (sha256 !== expectedFile.sha256 || file.byteLength !== expectedFile.bytes) {
      throw new Error('A verificação da saída pública falhou.')
    }
  }
}

async function writeManifestAtomically(
  metadataDirectory: string,
  manifest: GeneratedSiteManifest
): Promise<void> {
  const manifestPath = join(metadataDirectory, GENERATED_SITE_MANIFEST)
  const temporaryManifestPath = `${manifestPath}.${randomUUID()}.tmp`
  await fileSystem.writeFile(
    temporaryManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  )
  await fileSystem.rename(temporaryManifestPath, manifestPath)
}

function renderPublicHtml(content: PageContent): string {
  const elements = content.elements
    .map(
      (element, index) =>
        `      <div class="page-gap" style="height:${content.layout.gaps[index]}px"></div>\n` +
        `      <h1>${escapeHtml(element.text)}</h1>`
    )
    .join('\n')

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(firstPageTitle(content))}</title>
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <main class="page-content">
${elements}
      <div class="page-gap" style="height:${content.layout.gaps[content.elements.length]}px"></div>
    </main>
  </body>
</html>
`
}

function renderPublicStyles(content: PageContent): string {
  return `:root {
  color-scheme: light;
  font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
  background: #ffffff;
  color: #3b3d42;
}

* {
  box-sizing: border-box;
}

html,
body {
  min-width: 100%;
  min-height: 100%;
  margin: 0;
  background: #ffffff;
}

.page-content {
  width: 100%;
  min-height: 100vh;
  padding-right: ${content.layout.marginRight}px;
  padding-left: ${content.layout.marginLeft}px;
}

.page-gap {
  min-height: 0;
}

h1 {
  width: fit-content;
  max-width: 100%;
  min-height: 1.1em;
  margin: 0;
  padding: 7px 8px;
  overflow: hidden;
  color: #3b3d42;
  font-size: clamp(40px, 3.6vw, 50px);
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: -0.055em;
  overflow-wrap: anywhere;
}
`
}

function firstPageTitle(content: PageContent): string {
  const title = content.elements.find((element) => element.type === 'title')?.text.trim()
  return title || 'Página'
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fileSystem.access(path)
    return true
  } catch {
    return false
  }
}

export function isGeneratedSitePath(metadataDirectory: string, candidatePath: string): boolean {
  return (
    dirname(candidatePath) === join(metadataDirectory, GENERATED_SITE_FOLDER) &&
    basename(candidatePath) === 'index.html'
  )
}
