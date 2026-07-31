import { randomUUID } from 'node:crypto'
import { promises as fileSystem } from 'node:fs'
import { join } from 'node:path'
import { safeStorage } from 'electron'
import {
  GITHUB_API_VERSION,
  GITHUB_OAUTH_CLIENT_ID,
  GITHUB_OAUTH_SCOPE,
  GITHUB_OAUTH_SCOPES
} from './github-config'
import type {
  GitHubAccount,
  GitHubConnectionStatus,
  GitHubDeviceAuthorization
} from '../shared/page-contracts'

type StoredGitHubAuthorization = {
  schemaVersion: 2
  encryptedToken: string
  account: GitHubAccount
  scopes: string[]
}

type ActiveDeviceFlow = {
  id: string
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresAt: number
  intervalSeconds: number
  cancelled: boolean
}

const AUTH_FILE = 'github-authorization.json'
const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_URL = 'https://api.github.com/user'
const GITHUB_REQUEST_TIMEOUT_MS = 20_000

export class GitHubAuthService {
  private activeFlow: ActiveDeviceFlow | null = null

  constructor(private readonly storageDirectory: string) {}

  async getStatus(): Promise<GitHubConnectionStatus> {
    const storedSession = await this.readStoredAuthorization()
    return storedSession
      ? { state: 'connected', account: storedSession.authorization.account }
      : { state: 'disconnected' }
  }

  async getAuthenticatedSession(action: 'publicar' | 'excluir' = 'publicar'): Promise<{
    account: GitHubAccount
    accessToken: string
  }> {
    const storedSession = await this.readStoredAuthorization()
    if (!storedSession) {
      throw new Error(
        action === 'excluir'
          ? 'Vincule a conta GitHub proprietária antes de excluir esta publicação.'
          : 'Vincule uma conta GitHub antes de publicar.'
      )
    }
    const account = await this.fetchAccount(storedSession.accessToken)
    if (JSON.stringify(account) !== JSON.stringify(storedSession.authorization.account)) {
      await this.storeAuthorization(storedSession.accessToken, account)
    }
    return { account, accessToken: storedSession.accessToken }
  }

  async beginDeviceFlow(): Promise<GitHubDeviceAuthorization> {
    this.cancelDeviceFlow()
    const response = await fetchWithTimeout(
      GITHUB_DEVICE_CODE_URL,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'PageSpace'
        },
        body: new URLSearchParams({
          client_id: GITHUB_OAUTH_CLIENT_ID,
          scope: GITHUB_OAUTH_SCOPE
        })
      },
      'Não foi possível acessar o GitHub para iniciar a vinculação.'
    )

    if (!response.ok) throw new Error('O GitHub não iniciou a vinculação da conta.')
    const candidate = (await response.json()) as Record<string, unknown>
    if (
      typeof candidate.device_code !== 'string' ||
      typeof candidate.user_code !== 'string' ||
      candidate.verification_uri !== 'https://github.com/login/device' ||
      typeof candidate.expires_in !== 'number' ||
      typeof candidate.interval !== 'number'
    ) {
      throw new Error('O GitHub retornou uma autorização inválida.')
    }

    const flow: ActiveDeviceFlow = {
      id: randomUUID(),
      deviceCode: candidate.device_code,
      userCode: candidate.user_code,
      verificationUri: candidate.verification_uri,
      expiresAt: Date.now() + candidate.expires_in * 1000,
      intervalSeconds: Math.max(5, candidate.interval),
      cancelled: false
    }
    this.activeFlow = flow

    return {
      flowId: flow.id,
      userCode: flow.userCode,
      verificationUri: flow.verificationUri,
      expiresAt: new Date(flow.expiresAt).toISOString()
    }
  }

  async completeDeviceFlow(flowId: string): Promise<GitHubConnectionStatus> {
    const flow = this.activeFlow
    if (!flow || flow.id !== flowId || flow.cancelled) {
      throw new Error('A vinculação da conta foi cancelada.')
    }

    let intervalSeconds = flow.intervalSeconds
    while (Date.now() < flow.expiresAt) {
      await wait(intervalSeconds * 1000)
      if (flow.cancelled || this.activeFlow?.id !== flow.id) {
        throw new Error('A vinculação da conta foi cancelada.')
      }

      const result = await this.requestAccessToken(flow.deviceCode)
      if (result.kind === 'pending') continue
      if (result.kind === 'slow-down') {
        intervalSeconds += 5
        continue
      }
      if (result.kind === 'denied') {
        this.activeFlow = null
        throw new Error('A autorização foi recusada no GitHub.')
      }
      if (result.kind === 'expired') break
      if (!('accessToken' in result)) {
        throw new Error('O GitHub não concluiu a vinculação da conta.')
      }

      const account = await this.fetchAccount(result.accessToken)
      await this.storeAuthorization(result.accessToken, account, result.scopes)
      this.activeFlow = null
      return { state: 'connected', account }
    }

    this.activeFlow = null
    throw new Error('O código expirou. Inicie a vinculação novamente.')
  }

  cancelDeviceFlow(flowId?: string): void {
    if (this.activeFlow && (!flowId || this.activeFlow.id === flowId)) {
      this.activeFlow.cancelled = true
      this.activeFlow = null
    }
  }

  async disconnect(): Promise<void> {
    this.cancelDeviceFlow()
    await fileSystem.rm(join(this.storageDirectory, AUTH_FILE), { force: true })
  }

  private async requestAccessToken(
    deviceCode: string
  ): Promise<
    | { kind: 'pending' | 'slow-down' | 'denied' | 'expired' }
    | { kind: 'authorized'; accessToken: string; scopes: string[] }
  > {
    const response = await fetchWithTimeout(
      GITHUB_TOKEN_URL,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'PageSpace'
        },
        body: new URLSearchParams({
          client_id: GITHUB_OAUTH_CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      },
      'Não foi possível acessar o GitHub para concluir a vinculação.'
    )
    if (!response.ok) throw new Error('Não foi possível concluir a vinculação com o GitHub.')

    const candidate = (await response.json()) as Record<string, unknown>
    if (typeof candidate.access_token === 'string') {
      const scopes =
        typeof candidate.scope === 'string'
          ? candidate.scope.split(',').map((scope) => scope.trim())
          : []
      if (!GITHUB_OAUTH_SCOPES.every((scope) => scopes.includes(scope))) {
        throw new Error('A permissão para publicar repositórios públicos não foi concedida.')
      }
      return { kind: 'authorized', accessToken: candidate.access_token, scopes }
    }

    switch (candidate.error) {
      case 'authorization_pending':
        return { kind: 'pending' }
      case 'slow_down':
        return { kind: 'slow-down' }
      case 'access_denied':
        return { kind: 'denied' }
      case 'expired_token':
        return { kind: 'expired' }
      case 'device_flow_disabled':
        throw new Error('O Device Flow não está habilitado para o PageSpace no GitHub.')
      default:
        throw new Error('O GitHub não concluiu a vinculação da conta.')
    }
  }

  private async fetchAccount(accessToken: string): Promise<GitHubAccount> {
    const response = await fetchWithTimeout(
      GITHUB_USER_URL,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
          'User-Agent': 'PageSpace'
        }
      },
      'Não foi possível acessar o GitHub para validar a conta.'
    )
    if (!response.ok) throw new Error('Não foi possível validar a conta vinculada.')

    const candidate = (await response.json()) as Record<string, unknown>
    if (
      typeof candidate.id !== 'number' ||
      typeof candidate.login !== 'string' ||
      typeof candidate.html_url !== 'string' ||
      typeof candidate.avatar_url !== 'string'
    ) {
      throw new Error('O GitHub retornou um perfil inválido.')
    }

    const profileUrl = new URL(candidate.html_url)
    const avatarUrl = new URL(candidate.avatar_url)
    if (
      profileUrl.protocol !== 'https:' ||
      profileUrl.hostname !== 'github.com' ||
      avatarUrl.protocol !== 'https:' ||
      avatarUrl.hostname !== 'avatars.githubusercontent.com'
    ) {
      throw new Error('O GitHub retornou endereços de perfil inválidos.')
    }

    return {
      id: candidate.id,
      login: candidate.login,
      name: typeof candidate.name === 'string' ? candidate.name : null,
      avatarUrl: avatarUrl.toString(),
      profileUrl: profileUrl.toString()
    }
  }

  private async storeAuthorization(
    accessToken: string,
    account: GitHubAccount,
    scopes: readonly string[] = GITHUB_OAUTH_SCOPES
  ): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('A proteção de credenciais do Windows não está disponível.')
    }

    const encryptedToken = safeStorage.encryptString(accessToken)
    const storedAuthorization: StoredGitHubAuthorization = {
      schemaVersion: 2,
      encryptedToken: encryptedToken.toString('base64'),
      account,
      scopes: [...scopes]
    }
    await fileSystem.mkdir(this.storageDirectory, { recursive: true })
    await this.writeJsonAtomically(join(this.storageDirectory, AUTH_FILE), storedAuthorization)
  }

  private async readStoredAuthorization(): Promise<{
    authorization: StoredGitHubAuthorization
    accessToken: string
  } | null> {
    try {
      const candidate = JSON.parse(
        await fileSystem.readFile(join(this.storageDirectory, AUTH_FILE), 'utf8')
      ) as Partial<StoredGitHubAuthorization>
      if (
        candidate.schemaVersion !== 2 ||
        typeof candidate.encryptedToken !== 'string' ||
        !isGitHubAccount(candidate.account) ||
        !Array.isArray(candidate.scopes) ||
        !GITHUB_OAUTH_SCOPES.every((scope) => candidate.scopes?.includes(scope))
      ) {
        return null
      }

      if (!safeStorage.isEncryptionAvailable()) return null
      const decrypted = safeStorage.decryptString(Buffer.from(candidate.encryptedToken, 'base64'))
      if (!decrypted) return null
      return {
        authorization: candidate as StoredGitHubAuthorization,
        accessToken: decrypted
      }
    } catch {
      return null
    }
  }

  private async writeJsonAtomically(path: string, value: unknown): Promise<void> {
    const temporaryPath = `${path}.${randomUUID()}.tmp`
    await fileSystem.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await fileSystem.rename(temporaryPath, path)
  }
}

function isGitHubAccount(value: unknown): value is GitHubAccount {
  if (!value || typeof value !== 'object') return false
  const account = value as Partial<GitHubAccount>
  return (
    typeof account.id === 'number' &&
    typeof account.login === 'string' &&
    (typeof account.name === 'string' || account.name === null) &&
    typeof account.avatarUrl === 'string' &&
    typeof account.profileUrl === 'string'
  )
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  failureMessage: string
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS)
    })
  } catch {
    throw new Error(failureMessage)
  }
}
