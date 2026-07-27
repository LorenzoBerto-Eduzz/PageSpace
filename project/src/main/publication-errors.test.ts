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
    expect(normalized.message).toBe('Não foi possível concluir a publicação.')
    expect(normalized.message).not.toContain('secret')
  })
})
