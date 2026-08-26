import { describe, expect, it } from 'vitest'
import { PublicationError, normalizePublicationError, publicationError } from './publication-errors'

describe('publication errors', () => {
  it('preserves stable error codes and friendly messages', () => {
    const error = publicationError('repository_changed', 'Alterações externas detectadas.')
    expect(error).toBeInstanceOf(PublicationError)
    expect(normalizePublicationError(error)).toBe(error)
    expect(error.code).toBe('repository_changed')
  })

  it('normalizes unexpected failures without exposing objects', () => {
    const normalized = normalizePublicationError({ token: 'secret' })
    expect(normalized.code).toBe('unexpected')
    expect(normalized.message).toBe(
      'Não foi possível concluir a publicação. Tente novamente. Se o problema continuar, verifique o status do GitHub. | PUB-UNEXPECTED-01'
    )
    expect(normalized.message).not.toContain('secret')
  })

  it('does not expose technical messages from unexpected errors', () => {
    const normalized = normalizePublicationError(
      new Error('Failed to create deployment with internal request details')
    )

    expect(normalized.code).toBe('unexpected')
    expect(normalized.message).not.toContain('Failed to create deployment')
    expect(normalized.message).toContain('Tente novamente')
  })
})
