import { randomUUID } from 'node:crypto'
import { promises as fileSystem } from 'node:fs'
import { join } from 'node:path'
import { safeStorage } from 'electron'
import { GITHUB_API_VERSION, GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_SCOPE } from './github-config'
import type {
  GitHubAccount,
  GitHubConnectionStatus,
  GitHubDeviceAuthorization
} from '../shared/page-contracts'

type StoredGitHubAuthorization = {
  schemaVersion: 1
  encryptedToken: string
  account: GitHubAccount
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

export class GitHubAuthService {
  private activeFlow: ActiveDeviceFlow | null = null

  constructor(private readonly storageDirectory: string) {}

  async getStatus(): Promise<GitHubConnectionStatus> {
    const storedAuthorization = await this.readStoredAuthorization()
    return storedAuthorization
      ? { state: 'connected', account: storedAuthorization.account }
      : { state: 'disconnected' }
  }

  async beginDeviceFlow(): Promise<GitHubDeviceAuthorization> {
    this.cancelDeviceFlow()
    const response = await fetch(GITHUB_DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'PageMaker'
      },
      body: new URLSearchParams({
        client_id: GITHUB_OAUTH_CLIENT_ID,
        scope: GITHUB_OAUTH_SCOPE
      })
    })

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
      await this.storeAuthorization(result.accessToken, account)
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
    | { kind: 'authorized'; accessToken: string }
  > {
    const response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'PageMaker'
      },
      body: new URLSearchParams({
        client_id: GITHUB_OAUTH_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    })
    if (!response.ok) throw new Error('Não foi possível concluir a vinculação com o GitHub.')

    const candidate = (await response.json()) as Record<string, unknown>
    if (typeof candidate.access_token === 'string') {
      const scopes = typeof candidate.scope === 'string' ? candidate.scope.split(',') : []
      if (!scopes.includes(GITHUB_OAUTH_SCOPE)) {
        throw new Error('A permissão para publicar repositórios públicos não foi concedida.')
      }
      return { kind: 'authorized', accessToken: candidate.access_token }
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
        throw new Error('O Device Flow não está habilitado para o PageMaker no GitHub.')
      default:
        throw new Error('O GitHub não concluiu a vinculação da conta.')
    }
  }

  private async fetchAccount(accessToken: string): Promise<GitHubAccount> {
    const response = await fetch(GITHUB_USER_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        'User-Agent': 'PageMaker'
      }
    })
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

  private async storeAuthorization(accessToken: string, account: GitHubAccount): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('A proteção de credenciais do Windows não está disponível.')
    }

    const encryptedToken = safeStorage.encryptString(accessToken)
    const storedAuthorization: StoredGitHubAuthorization = {
      schemaVersion: 1,
      encryptedToken: encryptedToken.toString('base64'),
      account
    }
    await fileSystem.mkdir(this.storageDirectory, { recursive: true })
    await this.writeJsonAtomically(join(this.storageDirectory, AUTH_FILE), storedAuthorization)
  }

  private async readStoredAuthorization(): Promise<StoredGitHubAuthorization | null> {
    try {
      const candidate = JSON.parse(
        await fileSystem.readFile(join(this.storageDirectory, AUTH_FILE), 'utf8')
      ) as Partial<StoredGitHubAuthorization>
      if (
        candidate.schemaVersion !== 1 ||
        typeof candidate.encryptedToken !== 'string' ||
        !isGitHubAccount(candidate.account)
      ) {
        return null
      }

      if (!safeStorage.isEncryptionAvailable()) return null
      const decrypted = safeStorage.decryptString(Buffer.from(candidate.encryptedToken, 'base64'))
      if (!decrypted) return null
      return candidate as StoredGitHubAuthorization
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
