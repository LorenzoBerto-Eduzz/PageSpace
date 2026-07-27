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
    super(message)
    this.name = 'PublicationError'
  }
}

export function publicationError(code: PublicationErrorCode, message: string): PublicationError {
  return new PublicationError(code, message)
}

export function normalizePublicationError(error: unknown): PublicationError {
  return error instanceof PublicationError
    ? error
    : publicationError(
        'unexpected',
        error instanceof Error ? error.message : 'Não foi possível concluir a publicação.'
      )
}
