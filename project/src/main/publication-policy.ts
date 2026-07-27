export const PUBLISHABLE_PATHS = ['.gitignore', 'docs/index.html', 'docs/styles.css'] as const

export function validateRepositoryName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Informe o nome do repositório.')
  const name = value.trim()
  if (
    name.length === 0 ||
    name.length > 100 ||
    name === '.' ||
    name === '..' ||
    !/^[A-Za-z0-9._-]+$/.test(name)
  ) {
    throw new Error('Use até 100 letras, números, pontos, hífens ou sublinhados.')
  }
  return name
}

export function isPublishablePath(filepath: string): boolean {
  return PUBLISHABLE_PATHS.some((allowedPath) => filepath === allowedPath)
}

export function isManagedDocsPath(filepath: string): boolean {
  return filepath.startsWith('docs/')
}

export function isSafeStagedChange(
  filepath: string,
  headStatus: number,
  stageStatus: number
): boolean {
  if (headStatus === stageStatus) return true
  return (
    isPublishablePath(filepath) ||
    (isManagedDocsPath(filepath) && headStatus !== 0 && stageStatus === 0)
  )
}

export function canAcceptRemoteHead(
  remoteOid: string,
  lastPublishedOid: string,
  localOid: string | null
): boolean {
  return remoteOid === lastPublishedOid || remoteOid === localOid
}

export function publicUrlFor(owner: string, repository: string): string {
  return repository.toLowerCase() === `${owner.toLowerCase()}.github.io`
    ? `https://${owner.toLowerCase()}.github.io/`
    : `https://${owner.toLowerCase()}.github.io/${repository}/`
}

export function isSafePagesUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.toLowerCase().endsWith('.github.io')
  } catch {
    return false
  }
}
