export type PublicationErrorCode =
  | 'already_running'
  | 'github_unavailable'
  | 'repository_conflict'
  | 'repository_missing'
  | 'repository_changed'
  | 'push_failed'
  | 'unsafe_output'
  | 'unexpected'

export class PublicationError extends Error {
  constructor(
    readonly code: PublicationErrorCode,
    message: string
  ) {
    const reference = PUBLIC_ERROR_REFERENCES[code]
    super(reference && !message.endsWith(`| ${reference}`) ? `${message} | ${reference}` : message)
    this.name = 'PublicationError'
  }
}

const PUBLIC_ERROR_REFERENCES: Partial<Record<PublicationErrorCode, string>> = {
  github_unavailable: 'PUB-NET-01',
  push_failed: 'PUB-PUSH-01',
  unsafe_output: 'PUB-SAFE-01',
  unexpected: 'PUB-UNEXPECTED-01'
}

export function publicationError(code: PublicationErrorCode, message: string): PublicationError {
  return new PublicationError(code, message)
}

export function normalizePublicationError(error: unknown): PublicationError {
  return error instanceof PublicationError
    ? error
    : publicationError(
        'unexpected',
        'Não foi possível concluir a publicação. Tente novamente. Se o problema continuar, verifique o status do GitHub.'
      )
}
