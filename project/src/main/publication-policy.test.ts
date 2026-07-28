import { describe, expect, it } from 'vitest'
import {
  canAcceptRemoteHead,
  isPublishablePath,
  isSafePagesUrl,
  isSafeStagedChange,
  publicUrlFor,
  validateRepositoryName
} from './publication-policy'

describe('publication file boundary', () => {
  it.each(['.gitignore', 'docs/index.html', 'docs/styles.css'])(
    'allows the generated file %s',
    (filepath) => expect(isPublishablePath(filepath)).toBe(true)
  )

  it.each([
    '.pagespace/page.json',
    '.pagespace/preview.png',
    'data.json',
    'assets/private.png',
    'docs/extra.json',
    'github-authorization.json'
  ])('rejects private or unexpected file %s', (filepath) =>
    expect(isPublishablePath(filepath)).toBe(false)
  )

  it('allows removing obsolete generated docs without allowing new arbitrary docs', () => {
    expect(isSafeStagedChange('docs/old.css', 1, 0)).toBe(true)
    expect(isSafeStagedChange('docs/private.json', 0, 2)).toBe(false)
  })
})

describe('repository policy', () => {
  it.each(['minha-pagina', 'Pagina_2', 'site.github.io'])('accepts %s', (name) =>
    expect(validateRepositoryName(name)).toBe(name)
  )

  it.each(['', '.', '..', 'nome com espaço', 'página', 'repo/child'])('rejects %s', (name) =>
    expect(() => validateRepositoryName(name)).toThrow()
  )
})

describe('remote update protection', () => {
  it('accepts the last confirmed remote commit', () => {
    expect(canAcceptRemoteHead('confirmed', 'confirmed', 'local')).toBe(true)
  })

  it('accepts a local pending commit that already reached GitHub', () => {
    expect(canAcceptRemoteHead('pending', 'confirmed', 'pending')).toBe(true)
  })

  it('rejects an external commit', () => {
    expect(canAcceptRemoteHead('external', 'confirmed', 'local')).toBe(false)
  })
})

describe('GitHub Pages addresses', () => {
  it('builds project and account site addresses', () => {
    expect(publicUrlFor('Pessoa', 'Meu-Site')).toBe('https://pessoa.github.io/Meu-Site/')
    expect(publicUrlFor('Pessoa', 'pessoa.github.io')).toBe('https://pessoa.github.io/')
  })

  it.each(['https://pessoa.github.io/site/', 'https://empresa.github.io/'])('accepts %s', (url) =>
    expect(isSafePagesUrl(url)).toBe(true)
  )

  it.each([
    'http://pessoa.github.io/site/',
    'https://github.io.example.com/site/',
    'https://github.com/site/',
    'not-a-url'
  ])('rejects %s', (url) => expect(isSafePagesUrl(url)).toBe(false))
})
