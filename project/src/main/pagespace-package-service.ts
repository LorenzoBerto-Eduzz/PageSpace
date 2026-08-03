import { createHash, randomUUID } from 'node:crypto'
import { promises as fileSystem } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import type {
  CollectionItemField,
  JsonValue,
  PageSpaceEditableContent,
  PageSpaceEditableField,
  PageSpaceEditableSchema,
  PageSpacePackageManifest
} from '../shared/pagespace-package-contracts'
import {
  PAGESPACE_ALLOWED_SITE_EXTENSIONS,
  PAGESPACE_PACKAGE_LIMITS
} from '../shared/pagespace-package-limits'

const MANIFEST_FILE = 'pagespace.json'
const SITE_FOLDER = 'site'
const EDITABLES_FILE = 'editables.json'
const CONTENT_FILE = 'content.json'
const GENERATED_SITE_FOLDER = 'generated-site'
const GENERATED_SITE_MANIFEST = 'generated-site-manifest.json'
const RESERVED_CONTENT_SCRIPT = 'pagespace-content.js'
const USER_ASSETS_FOLDER = 'user-assets'
const COMMON_OUTPUT_FOLDERS = ['dist', 'build', 'public', 'docs'] as const
const MAX_FILES = PAGESPACE_PACKAGE_LIMITS.maxFiles
const MAX_FILE_BYTES = PAGESPACE_PACKAGE_LIMITS.maxFileBytes
const MAX_TOTAL_BYTES = PAGESPACE_PACKAGE_LIMITS.maxTotalBytes
const MAX_FIELDS = PAGESPACE_PACKAGE_LIMITS.maxTopLevelFields
const MAX_COLLECTION_FIELDS = PAGESPACE_PACKAGE_LIMITS.maxCollectionFields
const MAX_COLLECTION_ITEMS = PAGESPACE_PACKAGE_LIMITS.maxCollectionItems
const MAX_COLLECTION_DEPTH = PAGESPACE_PACKAGE_LIMITS.maxCollectionDepth

const ALLOWED_SITE_EXTENSIONS = new Set<string>(PAGESPACE_ALLOWED_SITE_EXTENSIONS)

export type ValidatedPageSpacePackage = {
  sourceDirectory: string
  manifest: PageSpacePackageManifest
  schema: PageSpaceEditableSchema | null
  content: PageSpaceEditableContent | null
  siteFiles: string[]
}

export type ValidatedStaticWebsite = {
  sourceDirectory: string
  siteDirectory: string
  entryFile: string
  name: string
  siteFiles: string[]
}

export type PackageGeneratedSite = {
  directoryPath: string
  indexPath: string
  manifest: {
    schemaVersion: 1
    generatedAt: string
    files: Array<{
      path: string
      sha256: string
      bytes: number
    }>
  }
}

export async function getStaticWebsiteSourceSignature(
  candidate: ValidatedStaticWebsite
): Promise<string> {
  return createSourceSignature(candidate.siteDirectory, candidate.siteFiles, candidate.entryFile)
}

export async function getPageSpacePackageSourceSignature(
  candidate: ValidatedPageSpacePackage
): Promise<string> {
  const files = [
    MANIFEST_FILE,
    ...candidate.siteFiles.map((filePath) => `${SITE_FOLDER}/${filePath}`),
    ...(candidate.manifest.mode === 'editable' ? [EDITABLES_FILE, CONTENT_FILE] : [])
  ].sort((first, second) => first.localeCompare(second))
  return createSourceSignature(candidate.sourceDirectory, files, candidate.manifest.entryPoint)
}

export async function validatePageSpacePackage(
  sourceDirectory: string
): Promise<ValidatedPageSpacePackage> {
  const sourceRoot = resolve(sourceDirectory)
  const sourceStats = await fileSystem.stat(sourceRoot)
  if (!sourceStats.isDirectory()) throw new Error('Selecione uma pasta de pacote PageSpace.')

  const manifest = parseManifest(
    JSON.parse(await fileSystem.readFile(join(sourceRoot, MANIFEST_FILE), 'utf8')) as unknown
  )
  const siteDirectory = join(sourceRoot, SITE_FOLDER)
  const siteFiles = await collectSafeSiteFiles(siteDirectory)
  if (!siteFiles.includes(manifest.entryPoint)) {
    throw new Error('O pacote não contém o arquivo inicial site/index.html.')
  }

  if (manifest.mode === 'static') {
    return {
      sourceDirectory: sourceRoot,
      manifest,
      schema: null,
      content: null,
      siteFiles
    }
  }

  if (siteFiles.includes(RESERVED_CONTENT_SCRIPT)) {
    throw new Error(`O arquivo ${RESERVED_CONTENT_SCRIPT} é reservado ao PageSpace.`)
  }

  const indexHtml = await fileSystem.readFile(join(siteDirectory, manifest.entryPoint), 'utf8')
  if (!indexHtml.includes(RESERVED_CONTENT_SCRIPT)) {
    throw new Error(
      `A página editável precisa carregar ${RESERVED_CONTENT_SCRIPT} antes de seu código visual.`
    )
  }

  const schema = parseEditableSchema(
    JSON.parse(await fileSystem.readFile(join(sourceRoot, EDITABLES_FILE), 'utf8')) as unknown
  )
  const content = validateEditableContent(
    JSON.parse(await fileSystem.readFile(join(sourceRoot, CONTENT_FILE), 'utf8')) as unknown,
    schema
  )

  return {
    sourceDirectory: sourceRoot,
    manifest,
    schema,
    content,
    siteFiles
  }
}

export async function validateStaticWebsite(
  sourceDirectory: string
): Promise<ValidatedStaticWebsite> {
  const sourceRoot = resolve(sourceDirectory)
  const sourceStats = await fileSystem.stat(sourceRoot)
  if (!sourceStats.isDirectory()) throw new Error('Selecione uma pasta de site.')

  const directEntry = join(sourceRoot, 'index.html')
  const candidates: string[] = []
  for (const folder of COMMON_OUTPUT_FOLDERS) {
    const candidate = join(sourceRoot, folder)
    if (await pathExists(join(candidate, 'index.html'))) candidates.push(candidate)
  }
  const looksLikeSourceProject = await pathExists(join(sourceRoot, 'package.json'))
  let siteDirectory = sourceRoot
  let entryFile = 'index.html'
  if (!(await pathExists(directEntry)) || (looksLikeSourceProject && candidates.length > 0)) {
    if (candidates.length === 0) {
      const discoveredEntries = await findBrowserEntryFiles(sourceRoot)
      const nestedIndexes = discoveredEntries.filter(
        (filePath) => basename(filePath).toLowerCase() === 'index.html'
      )
      const usableEntries = nestedIndexes.length > 0 ? nestedIndexes : discoveredEntries
      if (usableEntries.length === 0) {
        throw new Error(
          'Nenhuma página HTML pronta foi encontrada. Se este projeto ainda precisa de build, gere a saída estática e selecione a pasta resultante.'
        )
      }
      if (usableEntries.length > 1) {
        throw new Error(
          'Mais de uma página inicial possível foi encontrada. Selecione diretamente a pasta que contém a página desejada.'
        )
      }
      const discoveredEntry = usableEntries[0]
      siteDirectory = dirname(join(sourceRoot, ...discoveredEntry.split('/')))
      entryFile = basename(discoveredEntry)
    } else {
      if (candidates.length > 1) {
        throw new Error(
          'Mais de uma saída pronta foi encontrada. Selecione diretamente a pasta dist, build, public ou docs desejada.'
        )
      }
      siteDirectory = candidates[0]
    }
  }

  const siteFiles = await collectSafeSiteFiles(siteDirectory, {
    allowReservedContentScript: true,
    allowUserAssetsFolder: true,
    ignoreHiddenEntries: true,
    ignoreUnsupportedFiles: true,
    ignoredDirectoryNames: new Set(['node_modules']),
    ignoredFileNames: new Set(['package.json', 'package-lock.json'])
  })
  if (!siteFiles.includes(entryFile)) {
    throw new Error('A página HTML inicial não pôde ser validada.')
  }
  return {
    sourceDirectory: sourceRoot,
    siteDirectory,
    entryFile,
    name: basename(sourceRoot),
    siteFiles
  }
}

export async function installValidatedStaticWebsite(
  candidate: ValidatedStaticWebsite,
  destination: string
): Promise<void> {
  const staging = `${destination}.${randomUUID()}.tmp`
  await fileSystem.mkdir(staging, { recursive: true })
  try {
    await copyRelativeFiles(candidate.siteDirectory, staging, candidate.siteFiles)
    await ensureStaticWebsiteIndex(candidate, staging)
    await fileSystem.rename(staging, destination)
  } catch (error) {
    await fileSystem.rm(staging, { recursive: true, force: true })
    throw error
  }
}

export async function replaceInstalledStaticWebsite(
  candidate: ValidatedStaticWebsite,
  destination: string
): Promise<void> {
  const staging = `${destination}.${randomUUID()}.tmp`
  const backup = `${destination}.${randomUUID()}.backup`
  await fileSystem.mkdir(staging, { recursive: true })
  try {
    await copyRelativeFiles(candidate.siteDirectory, staging, candidate.siteFiles)
    await ensureStaticWebsiteIndex(candidate, staging)
    const hadDestination = await pathExists(destination)
    if (hadDestination) await fileSystem.rename(destination, backup)
    try {
      await fileSystem.rename(staging, destination)
      if (hadDestination) await fileSystem.rm(backup, { recursive: true, force: true })
    } catch (error) {
      if (hadDestination && !(await pathExists(destination))) {
        await fileSystem.rename(backup, destination)
      }
      throw error
    }
  } catch (error) {
    await fileSystem.rm(staging, { recursive: true, force: true })
    await fileSystem.rm(backup, { recursive: true, force: true })
    throw error
  }
}

export async function installValidatedPackage(
  candidate: ValidatedPageSpacePackage,
  destination: string
): Promise<void> {
  const staging = `${destination}.${randomUUID()}.tmp`
  await fileSystem.mkdir(join(staging, SITE_FOLDER), { recursive: true })
  try {
    await copyPackageFiles(candidate, staging)
    await fileSystem.rename(staging, destination)
  } catch (error) {
    await fileSystem.rm(staging, { recursive: true, force: true })
    throw error
  }
}

export async function replaceInstalledPackage(
  candidate: ValidatedPageSpacePackage,
  destination: string
): Promise<void> {
  const staging = `${destination}.${randomUUID()}.tmp`
  const backup = `${destination}.${randomUUID()}.backup`
  await fileSystem.mkdir(join(staging, SITE_FOLDER), { recursive: true })
  try {
    await copyPackageFiles(candidate, staging)
    const hadDestination = await pathExists(destination)
    if (hadDestination) await fileSystem.rename(destination, backup)
    try {
      await fileSystem.rename(staging, destination)
      if (hadDestination) await fileSystem.rm(backup, { recursive: true, force: true })
    } catch (error) {
      if (hadDestination && !(await pathExists(destination))) {
        await fileSystem.rename(backup, destination)
      }
      throw error
    }
  } catch (error) {
    await fileSystem.rm(staging, { recursive: true, force: true })
    await fileSystem.rm(backup, { recursive: true, force: true })
    throw error
  }
}

export async function readInstalledPackage(packageDirectory: string): Promise<{
  manifest: PageSpacePackageManifest
  schema: PageSpaceEditableSchema | null
}> {
  const manifest = parseManifest(
    JSON.parse(await fileSystem.readFile(join(packageDirectory, MANIFEST_FILE), 'utf8')) as unknown
  )
  const schema =
    manifest.mode === 'editable'
      ? parseEditableSchema(
          JSON.parse(
            await fileSystem.readFile(join(packageDirectory, EDITABLES_FILE), 'utf8')
          ) as unknown
        )
      : null
  return { manifest, schema }
}

export function validateEditableContent(
  value: unknown,
  schema: PageSpaceEditableSchema
): PageSpaceEditableContent {
  if (!value || typeof value !== 'object') throw new Error('Conteúdo editável inválido.')
  const candidate = value as Partial<PageSpaceEditableContent>
  if (
    candidate.schemaVersion !== 1 ||
    !candidate.values ||
    typeof candidate.values !== 'object' ||
    Array.isArray(candidate.values)
  ) {
    throw new Error('Conteúdo editável inválido.')
  }

  const values: Record<string, JsonValue> = {}
  for (const field of schema.fields) {
    values[field.key] = validateFieldValue(field, candidate.values[field.key], field.key)
  }
  return { schemaVersion: 1, values }
}

export function reconcileEditableContent(
  current: PageSpaceEditableContent,
  previousSchema: PageSpaceEditableSchema,
  nextDefaults: PageSpaceEditableContent,
  nextSchema: PageSpaceEditableSchema
): PageSpaceEditableContent {
  const previousTypes = new Map(previousSchema.fields.map((field) => [field.key, field.type]))
  const candidateValues: Record<string, JsonValue> = { ...nextDefaults.values }
  for (const field of nextSchema.fields) {
    if (previousTypes.get(field.key) === field.type && field.key in current.values) {
      candidateValues[field.key] = current.values[field.key]
    }
  }
  return validateEditableContent({ schemaVersion: 1, values: candidateValues }, nextSchema)
}

export async function generatePackageSite(
  metadataDirectory: string,
  packageDirectory: string,
  content: PageSpaceEditableContent | null,
  userAssetsDirectory: string
): Promise<PackageGeneratedSite> {
  const installed = await readInstalledPackage(packageDirectory)
  if (installed.manifest.mode === 'editable') {
    if (!installed.schema || !content)
      throw new Error('O conteúdo editável da página está ausente.')
    content = validateEditableContent(content, installed.schema)
  } else if (content) {
    throw new Error('Uma página estática não pode receber conteúdo editável.')
  }

  const sourceSiteDirectory = join(packageDirectory, SITE_FOLDER)
  const siteFiles = await collectSafeSiteFiles(sourceSiteDirectory)
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
    await copyRelativeFiles(sourceSiteDirectory, temporaryDirectory, siteFiles)
    if (content) {
      const serialized = JSON.stringify(content.values).replaceAll('<', '\\u003c')
      await fileSystem.writeFile(
        join(temporaryDirectory, RESERVED_CONTENT_SCRIPT),
        `window.PAGESPACE_CONTENT = Object.freeze(${serialized});\n`,
        'utf8'
      )
      if (await pathExists(userAssetsDirectory)) {
        const userAssetFiles = await collectSafeSiteFiles(userAssetsDirectory)
        await copyRelativeFiles(
          userAssetsDirectory,
          join(temporaryDirectory, USER_ASSETS_FOLDER),
          userAssetFiles
        )
      }
    }

    const outputFiles = await collectSafeSiteFiles(temporaryDirectory, {
      allowReservedContentScript: true,
      allowUserAssetsFolder: true
    })
    const manifest = {
      schemaVersion: 1 as const,
      generatedAt: new Date().toISOString(),
      files: await Promise.all(
        outputFiles.map(async (filePath) => {
          const file = await fileSystem.readFile(join(temporaryDirectory, filePath))
          return {
            path: filePath,
            sha256: createHash('sha256').update(file).digest('hex'),
            bytes: file.byteLength
          }
        })
      )
    }
    await verifyGeneratedFiles(temporaryDirectory, manifest.files)

    const hadExistingOutput = await pathExists(outputDirectory)
    if (hadExistingOutput) await renameWithWindowsRetry(outputDirectory, backupDirectory)
    try {
      await renameWithWindowsRetry(temporaryDirectory, outputDirectory)
      await writeJsonAtomically(join(metadataDirectory, GENERATED_SITE_MANIFEST), manifest)
      if (hadExistingOutput) {
        await removeWithWindowsRetry(backupDirectory)
      }
    } catch (error) {
      if (hadExistingOutput && !(await pathExists(outputDirectory))) {
        await renameWithWindowsRetry(backupDirectory, outputDirectory)
      }
      throw error
    }

    return {
      directoryPath: outputDirectory,
      indexPath: join(outputDirectory, installed.manifest.entryPoint),
      manifest
    }
  } catch (error) {
    await fileSystem.rm(temporaryDirectory, { recursive: true, force: true })
    await fileSystem.rm(backupDirectory, { recursive: true, force: true })
    throw error
  }
}

export async function generateImportedWebsiteSite(
  metadataDirectory: string,
  websiteDirectory: string
): Promise<PackageGeneratedSite> {
  const siteFiles = await collectSafeSiteFiles(websiteDirectory, {
    allowReservedContentScript: true,
    allowUserAssetsFolder: true
  })
  if (!siteFiles.includes('index.html')) {
    throw new Error('O site importado não contém index.html.')
  }

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
    await copyRelativeFiles(websiteDirectory, temporaryDirectory, siteFiles)
    const outputFiles = await collectSafeSiteFiles(temporaryDirectory, {
      allowReservedContentScript: true,
      allowUserAssetsFolder: true
    })
    const manifest = {
      schemaVersion: 1 as const,
      generatedAt: new Date().toISOString(),
      files: await Promise.all(
        outputFiles.map(async (filePath) => {
          const file = await fileSystem.readFile(join(temporaryDirectory, filePath))
          return {
            path: filePath,
            sha256: createHash('sha256').update(file).digest('hex'),
            bytes: file.byteLength
          }
        })
      )
    }
    await verifyGeneratedFiles(temporaryDirectory, manifest.files)

    const hadExistingOutput = await pathExists(outputDirectory)
    if (hadExistingOutput) await renameWithWindowsRetry(outputDirectory, backupDirectory)
    try {
      await renameWithWindowsRetry(temporaryDirectory, outputDirectory)
      await writeJsonAtomically(join(metadataDirectory, GENERATED_SITE_MANIFEST), manifest)
      if (hadExistingOutput) {
        await removeWithWindowsRetry(backupDirectory)
      }
    } catch (error) {
      if (hadExistingOutput && !(await pathExists(outputDirectory))) {
        await renameWithWindowsRetry(backupDirectory, outputDirectory)
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

export function parseEditableSchema(value: unknown): PageSpaceEditableSchema {
  if (!value || typeof value !== 'object') throw new Error('Definição de edição inválida.')
  const candidate = value as Partial<PageSpaceEditableSchema>
  if (
    candidate.schemaVersion !== 1 ||
    !Array.isArray(candidate.fields) ||
    candidate.fields.length > MAX_FIELDS
  ) {
    throw new Error('Definição de edição inválida.')
  }

  const keys = new Set<string>()
  const fields = candidate.fields.map((field) => parseField(field, keys, 0))
  return { schemaVersion: 1, fields }
}

function parseManifest(value: unknown): PageSpacePackageManifest {
  if (!value || typeof value !== 'object') throw new Error('Manifesto PageSpace inválido.')
  const candidate = value as Partial<PageSpacePackageManifest>
  if (
    candidate.schemaVersion !== 1 ||
    typeof candidate.packageId !== 'string' ||
    !/^[a-z0-9](?:[a-z0-9.-]{0,126}[a-z0-9])?$/.test(candidate.packageId) ||
    typeof candidate.packageVersion !== 'string' ||
    !/^[0-9]+(?:\.[0-9]+){2}(?:-[A-Za-z0-9.-]+)?$/.test(candidate.packageVersion) ||
    typeof candidate.name !== 'string' ||
    candidate.name.trim().length === 0 ||
    candidate.name.length > 80 ||
    typeof candidate.description !== 'string' ||
    candidate.description.length > 180 ||
    (candidate.mode !== 'static' && candidate.mode !== 'editable') ||
    candidate.entryPoint !== 'index.html'
  ) {
    throw new Error('Manifesto PageSpace inválido.')
  }
  return {
    schemaVersion: 1,
    packageId: candidate.packageId,
    packageVersion: candidate.packageVersion,
    name: normalizeSingleLine(candidate.name),
    description: normalizeSingleLine(candidate.description),
    mode: candidate.mode,
    entryPoint: 'index.html'
  }
}

function parseField(
  value: unknown,
  siblingKeys: Set<string>,
  collectionDepth: number
): PageSpaceEditableField | CollectionItemField {
  if (!value || typeof value !== 'object') throw new Error('Campo editável inválido.')
  const candidate = value as Partial<PageSpaceEditableField>
  if (
    typeof candidate.key !== 'string' ||
    !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(candidate.key) ||
    siblingKeys.has(candidate.key) ||
    typeof candidate.label !== 'string' ||
    candidate.label.trim().length === 0 ||
    candidate.label.length > 80 ||
    (candidate.helpText !== undefined &&
      (typeof candidate.helpText !== 'string' || candidate.helpText.length > 240)) ||
    (candidate.required !== undefined && typeof candidate.required !== 'boolean')
  ) {
    throw new Error('Campo editável inválido.')
  }
  siblingKeys.add(candidate.key)

  const base = {
    key: candidate.key,
    label: normalizeSingleLine(candidate.label),
    ...(candidate.helpText ? { helpText: candidate.helpText.normalize('NFC').trim() } : {}),
    ...(candidate.required ? { required: true } : {})
  }

  switch (candidate.type) {
    case 'text':
    case 'textarea': {
      const field = candidate as Extract<PageSpaceEditableField, { type: 'text' | 'textarea' }>
      if (
        field.maxLength !== undefined &&
        (!Number.isInteger(field.maxLength) || field.maxLength < 1 || field.maxLength > 20_000)
      ) {
        throw new Error('Limite de texto inválido.')
      }
      return {
        ...base,
        type: candidate.type,
        ...(field.maxLength ? { maxLength: field.maxLength } : {}),
        ...(field.placeholder ? { placeholder: normalizeSingleLine(field.placeholder) } : {})
      }
    }
    case 'url':
      return {
        ...base,
        type: 'url',
        ...((candidate as { placeholder?: string }).placeholder
          ? {
              placeholder: normalizeSingleLine((candidate as { placeholder: string }).placeholder)
            }
          : {})
      }
    case 'color':
      return { ...base, type: 'color' }
    case 'image':
      return {
        ...base,
        type: 'image',
        ...((candidate as { altLabel?: string }).altLabel
          ? { altLabel: normalizeSingleLine((candidate as { altLabel: string }).altLabel) }
          : {})
      }
    case 'boolean':
      return { ...base, type: 'boolean' }
    case 'select': {
      const options = (candidate as { options?: unknown }).options
      if (!Array.isArray(options) || options.length === 0 || options.length > 100) {
        throw new Error('Opções de seleção inválidas.')
      }
      const values = new Set<string>()
      return {
        ...base,
        type: 'select',
        options: options.map((option) => {
          if (
            !option ||
            typeof option !== 'object' ||
            typeof (option as { value?: unknown }).value !== 'string' ||
            typeof (option as { label?: unknown }).label !== 'string'
          ) {
            throw new Error('Opção de seleção inválida.')
          }
          const normalizedValue = (option as { value: string }).value
          const normalizedLabel = normalizeSingleLine((option as { label: string }).label)
          if (
            normalizedValue.length === 0 ||
            normalizedValue.length > 100 ||
            normalizedLabel.length === 0 ||
            normalizedLabel.length > 100 ||
            values.has(normalizedValue)
          ) {
            throw new Error('Opção de seleção inválida.')
          }
          values.add(normalizedValue)
          return { value: normalizedValue, label: normalizedLabel }
        })
      }
    }
    case 'collection': {
      if (collectionDepth >= MAX_COLLECTION_DEPTH) {
        throw new Error('A estrutura de coleções excede o limite permitido.')
      }
      const field = candidate as Extract<PageSpaceEditableField, { type: 'collection' }>
      if (
        !Array.isArray(field.fields) ||
        field.fields.length === 0 ||
        field.fields.length > MAX_COLLECTION_FIELDS ||
        (field.maxItems !== undefined &&
          (!Number.isInteger(field.maxItems) ||
            field.maxItems < 1 ||
            field.maxItems > MAX_COLLECTION_ITEMS))
      ) {
        throw new Error('Coleção editável inválida.')
      }
      const itemKeys = new Set<string>()
      return {
        ...base,
        type: 'collection',
        ...(field.itemLabel ? { itemLabel: normalizeSingleLine(field.itemLabel) } : {}),
        ...(field.maxItems ? { maxItems: field.maxItems } : {}),
        fields: field.fields.map((itemField) =>
          parseField(itemField, itemKeys, collectionDepth + 1)
        ) as CollectionItemField[]
      }
    }
    default:
      throw new Error('Tipo de campo editável não suportado.')
  }
}

function validateFieldValue(
  field: PageSpaceEditableField | CollectionItemField,
  value: JsonValue | undefined,
  path: string
): JsonValue {
  if (field.type === 'collection') {
    if (!Array.isArray(value)) throw new Error(`A coleção ${field.label} é inválida.`)
    const maxItems = field.maxItems ?? 200
    if (value.length > maxItems) throw new Error(`A coleção ${field.label} excede o limite.`)
    return value.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`O item ${index + 1} de ${field.label} é inválido.`)
      }
      const candidate = item as Record<string, JsonValue>
      const result: Record<string, JsonValue> = {}
      const itemId =
        typeof candidate._id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(candidate._id)
          ? candidate._id
          : randomUUID()
      result._id = itemId
      for (const itemField of field.fields) {
        result[itemField.key] = validateFieldValue(
          itemField,
          candidate[itemField.key],
          `${path}.${index}.${itemField.key}`
        )
      }
      return result
    })
  }

  if (field.type === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(`O campo ${field.label} é inválido.`)
    return value
  }

  if (typeof value !== 'string') throw new Error(`O campo ${field.label} é inválido.`)
  const normalized = value.normalize('NFC')
  if (field.required && normalized.trim().length === 0) {
    throw new Error(`Preencha o campo ${field.label}.`)
  }

  switch (field.type) {
    case 'text':
    case 'textarea': {
      const maximum = field.maxLength ?? (field.type === 'text' ? 240 : 20_000)
      if (normalized.length > maximum) throw new Error(`O campo ${field.label} é muito longo.`)
      return field.type === 'text' ? normalized.replace(/[\r\n]+/g, ' ') : normalized
    }
    case 'url':
      if (!normalized && !field.required) return ''
      try {
        const url = new URL(normalized)
        if ((url.protocol !== 'https:' && url.protocol !== 'http:') || normalized.length > 2_048) {
          throw new Error()
        }
        return url.toString()
      } catch {
        throw new Error(`O endereço em ${field.label} é inválido.`)
      }
    case 'color':
      if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
        throw new Error(`A cor em ${field.label} é inválida.`)
      }
      return normalized.toLowerCase()
    case 'image':
      if (!normalized && !field.required) return ''
      if (!isSafePublicRelativePath(normalized)) {
        throw new Error(`A imagem em ${field.label} é inválida.`)
      }
      return normalized.replaceAll('\\', '/')
    case 'select':
      if (!field.options.some((option) => option.value === normalized)) {
        throw new Error(`A opção em ${field.label} é inválida.`)
      }
      return normalized
  }
}

async function copyPackageFiles(
  candidate: ValidatedPageSpacePackage,
  destination: string
): Promise<void> {
  await fileSystem.copyFile(
    join(candidate.sourceDirectory, MANIFEST_FILE),
    join(destination, MANIFEST_FILE)
  )
  await copyRelativeFiles(
    join(candidate.sourceDirectory, SITE_FOLDER),
    join(destination, SITE_FOLDER),
    candidate.siteFiles
  )
  if (candidate.manifest.mode === 'editable') {
    await fileSystem.copyFile(
      join(candidate.sourceDirectory, EDITABLES_FILE),
      join(destination, EDITABLES_FILE)
    )
    await fileSystem.copyFile(
      join(candidate.sourceDirectory, CONTENT_FILE),
      join(destination, CONTENT_FILE)
    )
  }
}

async function copyRelativeFiles(
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

async function createSourceSignature(
  sourceRoot: string,
  files: string[],
  entryFile: string
): Promise<string> {
  const signature = createHash('sha256')
  signature.update(`entry:${entryFile}\n`, 'utf8')
  for (const filePath of files) {
    const stats = await fileSystem.stat(join(sourceRoot, ...filePath.split('/')))
    signature.update(`${filePath}\0${stats.size}\0${stats.mtimeMs}\n`, 'utf8')
  }
  return signature.digest('hex')
}

async function ensureStaticWebsiteIndex(
  candidate: ValidatedStaticWebsite,
  destinationRoot: string
): Promise<void> {
  if (candidate.entryFile.toLowerCase() === 'index.html') return
  await fileSystem.copyFile(
    join(destinationRoot, candidate.entryFile),
    join(destinationRoot, 'index.html')
  )
}

async function findBrowserEntryFiles(sourceRoot: string): Promise<string[]> {
  const entries: string[] = []
  let visitedDirectories = 0

  async function visit(directory: string): Promise<void> {
    visitedDirectories += 1
    if (visitedDirectories > MAX_FILES) {
      throw new Error('A pasta selecionada é grande demais para localizar uma página inicial.')
    }
    for (const entry of await fileSystem.readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const absolutePath = join(directory, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        await visit(absolutePath)
        continue
      }
      if (!entry.isFile()) continue
      const extension = extname(entry.name).toLowerCase()
      if (extension !== '.html' && extension !== '.htm') continue
      entries.push(relative(sourceRoot, absolutePath).split(sep).join('/'))
      if (entries.length > MAX_FILES) {
        throw new Error('A pasta selecionada contém páginas HTML demais.')
      }
    }
  }

  await visit(sourceRoot)
  return entries.sort((first, second) => first.localeCompare(second))
}

async function collectSafeSiteFiles(
  root: string,
  options: {
    allowReservedContentScript?: boolean
    allowUserAssetsFolder?: boolean
    ignoreHiddenEntries?: boolean
    ignoreUnsupportedFiles?: boolean
    ignoredDirectoryNames?: ReadonlySet<string>
    ignoredFileNames?: ReadonlySet<string>
  } = {}
): Promise<string[]> {
  const resolvedRoot = resolve(root)
  const rootStats = await fileSystem.stat(resolvedRoot)
  if (!rootStats.isDirectory()) throw new Error('A pasta pública do pacote está ausente.')

  const files: string[] = []
  let totalBytes = 0
  async function visit(directory: string): Promise<void> {
    const entries = await fileSystem.readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (options.ignoredFileNames?.has(entry.name)) continue
      if (entry.name.startsWith('.') && options.ignoreHiddenEntries) continue
      if (entry.name.startsWith('.'))
        throw new Error('O pacote contém arquivo oculto não permitido.')
      const absolutePath = join(directory, entry.name)
      if (!isPathInside(resolvedRoot, absolutePath)) throw new Error('Caminho de pacote inválido.')
      if (entry.isSymbolicLink()) throw new Error('Links simbólicos não são permitidos no pacote.')
      if (entry.isDirectory()) {
        if (options.ignoredDirectoryNames?.has(entry.name)) continue
        if (
          entry.name === USER_ASSETS_FOLDER &&
          directory === resolvedRoot &&
          !options.allowUserAssetsFolder
        ) {
          throw new Error(`A pasta ${USER_ASSETS_FOLDER} é reservada ao PageSpace.`)
        }
        await visit(absolutePath)
        continue
      }
      if (!entry.isFile()) throw new Error('O pacote contém uma entrada não suportada.')

      const extension = extname(entry.name).toLowerCase()
      if (!ALLOWED_SITE_EXTENSIONS.has(extension) && options.ignoreUnsupportedFiles) continue
      if (!ALLOWED_SITE_EXTENSIONS.has(extension)) {
        throw new Error(`O tipo de arquivo ${extension || '(sem extensão)'} não é permitido.`)
      }
      const filePath = relative(resolvedRoot, absolutePath).split(sep).join('/')
      if (filePath === RESERVED_CONTENT_SCRIPT && !options.allowReservedContentScript) {
        throw new Error(`O arquivo ${RESERVED_CONTENT_SCRIPT} é reservado ao PageSpace.`)
      }
      const stats = await fileSystem.stat(absolutePath)
      if (stats.size > MAX_FILE_BYTES) throw new Error(`O arquivo ${filePath} excede o limite.`)
      totalBytes += stats.size
      files.push(filePath)
      if (files.length > MAX_FILES || totalBytes > MAX_TOTAL_BYTES) {
        throw new Error('O pacote excede o limite seguro de arquivos ou tamanho.')
      }
    }
  }
  await visit(resolvedRoot)
  return files.sort((first, second) => first.localeCompare(second))
}

async function verifyGeneratedFiles(
  directoryPath: string,
  expectedFiles: Array<{ path: string; sha256: string; bytes: number }>
): Promise<void> {
  const actualFiles = await collectSafeSiteFiles(directoryPath, {
    allowReservedContentScript: true,
    allowUserAssetsFolder: true
  })
  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((path, index) => path !== expectedFiles[index]?.path)
  ) {
    throw new Error('A saída pública contém arquivos inesperados.')
  }
  for (const expected of expectedFiles) {
    const file = await fileSystem.readFile(join(directoryPath, ...expected.path.split('/')))
    if (
      file.byteLength !== expected.bytes ||
      createHash('sha256').update(file).digest('hex') !== expected.sha256
    ) {
      throw new Error('A verificação da saída pública falhou.')
    }
  }
}

function normalizeSingleLine(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ')
}

function isSafePublicRelativePath(value: string): boolean {
  if (!value || value.includes('\0') || value.includes('\\')) return false
  if (value.startsWith('/') || value.includes('://')) return false
  const normalized = value.split('/')
  return normalized.every((segment) => segment && segment !== '.' && segment !== '..')
}

function isPathInside(root: string, candidate: string): boolean {
  const relativePath = relative(root, resolve(candidate))
  return relativePath === '' || (!relativePath.startsWith(`..${sep}`) && relativePath !== '..')
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fileSystem.access(path)
    return true
  } catch {
    return false
  }
}

function isTransientWindowsFileError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  return ['EPERM', 'EBUSY', 'EACCES', 'ENOTEMPTY'].includes(String(error.code))
}

async function withWindowsFileRetry(operation: () => Promise<void>): Promise<void> {
  const delays = [40, 80, 160, 320, 500]
  for (let attempt = 0; ; attempt += 1) {
    try {
      await operation()
      return
    } catch (error) {
      if (!isTransientWindowsFileError(error) || attempt >= delays.length) {
        if (isTransientWindowsFileError(error)) {
          throw new Error(
            'A página ainda está sendo usada pelo visualizador. Aguarde um instante e tente atualizar novamente.'
          )
        }
        throw error
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delays[attempt]))
    }
  }
}

async function renameWithWindowsRetry(source: string, destination: string): Promise<void> {
  await withWindowsFileRetry(() => fileSystem.rename(source, destination))
}

async function removeWithWindowsRetry(path: string): Promise<void> {
  await withWindowsFileRetry(() => fileSystem.rm(path, { recursive: true, force: true }))
}

async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.${randomUUID()}.tmp`
  await fileSystem.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await fileSystem.rename(temporaryPath, path)
}

export function isPackageGeneratedSitePath(
  metadataDirectory: string,
  candidatePath: string
): boolean {
  return (
    dirname(candidatePath) === join(metadataDirectory, GENERATED_SITE_FOLDER) &&
    basename(candidatePath) === 'index.html'
  )
}
