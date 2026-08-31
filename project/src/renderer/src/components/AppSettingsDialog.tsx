import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AppSettingsSnapshot,
  AppUpdateStatus,
  GitHubConnectionStatus,
  GitHubDeviceAuthorization,
  PageSummary
} from '../../../shared/page-contracts'
import { CheckIcon, ImportIcon, WarningIcon } from './icons'
import { ModalCloseButton } from './ModalCloseButton'

type AppSettingsDialogProps = {
  initialPages: PageSummary[]
  initialGitHubStatus: GitHubConnectionStatus | null
  onClose: () => void
  onPagesRefreshed: (pages: PageSummary[]) => void
  onOpenProblem: (pageId: string) => void
}

export function AppSettingsDialog({
  initialPages,
  initialGitHubStatus,
  onClose,
  onPagesRefreshed,
  onOpenProblem
}: AppSettingsDialogProps): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<AppSettingsSnapshot>({
    version: '',
    github: initialGitHubStatus ?? { state: 'disconnected' },
    pages: initialPages
  })
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authorization, setAuthorization] = useState<GitHubDeviceAuthorization | null>(null)
  const [isLinkingGitHub, setIsLinkingGitHub] = useState(false)
  const [isDisconnectingGitHub, setIsDisconnectingGitHub] = useState(false)
  const [instructionMessage, setInstructionMessage] = useState<string | null>(null)
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [updateCheckFailed, setUpdateCheckFailed] = useState(false)
  const linkAttemptId = useRef(0)
  const damagedPages = useMemo(
    () => snapshot.pages.filter((page) => page.health === 'damaged'),
    [snapshot.pages]
  )
  const connectedAccount = snapshot.github.state === 'connected' ? snapshot.github.account : null
  const displayedCurrentVersion = updateStatus?.currentVersion ?? snapshot.version

  async function downloadAiInstructions(): Promise<void> {
    const saved = await window.pageSpace.downloadAiInstructions()
    if (saved) setInstructionMessage('Instruções desta versão baixadas em TXT.')
  }

  useEffect(() => {
    void refresh()
    void checkForUpdate(true)
    // The initial scan belongs to this modal opening only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkForUpdate(force = false): Promise<void> {
    if (isCheckingUpdate || isInstallingUpdate) return
    setIsCheckingUpdate(true)
    setUpdateError(null)
    setUpdateCheckFailed(false)
    try {
      setUpdateStatus(await window.pageSpace.checkForAppUpdate(force))
    } catch {
      setUpdateStatus(null)
      setUpdateCheckFailed(true)
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  async function installUpdate(): Promise<void> {
    if (isInstallingUpdate || updateStatus?.state !== 'available') return
    setIsInstallingUpdate(true)
    setUpdateError(null)
    try {
      await window.pageSpace.installAppUpdate()
    } catch (installError) {
      setUpdateError(
        installError instanceof Error
          ? installError.message
          : 'Não foi possível instalar a atualização.'
      )
      setIsInstallingUpdate(false)
    }
  }

  function latestReleaseVersion(): string {
    if (updateCheckFailed) return 'Não foi possível conectar'
    if (updateStatus?.state === 'available' || updateStatus?.state === 'up-to-date') {
      return updateStatus.latestVersion
    }
    return isCheckingUpdate ? 'Verificando…' : '—'
  }

  function updateButtonText(): string {
    if (isInstallingUpdate) return 'Atualizando…'
    if (isCheckingUpdate) return 'Verificando…'
    if (updateStatus?.state === 'available') return 'Atualizar App'
    if (updateStatus?.state === 'up-to-date') return 'Última versão'
    return 'Verificar versão'
  }

  async function refresh(): Promise<void> {
    if (isChecking) return
    setIsChecking(true)
    setError(null)
    try {
      const nextSnapshot = await window.pageSpace.getAppSettings()
      setSnapshot(nextSnapshot)
      onPagesRefreshed(nextSnapshot.pages)
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Não foi possível verificar as páginas.'
      )
    } finally {
      setIsChecking(false)
    }
  }

  async function beginGitHubLink(): Promise<void> {
    if (isLinkingGitHub) return
    setError(null)
    const attemptId = linkAttemptId.current + 1
    linkAttemptId.current = attemptId
    setAuthorization(null)
    setIsLinkingGitHub(true)
    try {
      const nextAuthorization = await window.pageSpace.beginGitHubLink()
      if (linkAttemptId.current !== attemptId) {
        await window.pageSpace.cancelGitHubLink(nextAuthorization.flowId)
        return
      }
      setAuthorization(nextAuthorization)
      const status = await window.pageSpace.completeGitHubLink(nextAuthorization.flowId)
      if (linkAttemptId.current !== attemptId) return
      setSnapshot((current) => ({ ...current, github: status }))
      setAuthorization(null)
    } catch (linkError) {
      if (linkAttemptId.current === attemptId) {
        setAuthorization(null)
        setError(
          linkError instanceof Error
            ? linkError.message
            : 'Não foi possível vincular a conta GitHub.'
        )
      }
    } finally {
      if (linkAttemptId.current === attemptId) setIsLinkingGitHub(false)
    }
  }

  async function cancelGitHubLink(): Promise<void> {
    const activeAuthorization = authorization
    if (!activeAuthorization) return
    linkAttemptId.current += 1
    setAuthorization(null)
    setError(null)
    setIsLinkingGitHub(false)
    try {
      await window.pageSpace.cancelGitHubLink(activeAuthorization.flowId)
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : 'Não foi possível cancelar a vinculação da conta GitHub.'
      )
    }
  }

  async function copyGitHubCode(): Promise<void> {
    if (!authorization) return
    await window.pageSpace.copyGitHubCode(authorization.userCode)
  }

  async function disconnectGitHub(): Promise<void> {
    if (isDisconnectingGitHub) return
    setError(null)
    setIsDisconnectingGitHub(true)
    try {
      await window.pageSpace.disconnectGitHub()
      setSnapshot((current) => ({ ...current, github: { state: 'disconnected' } }))
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : 'Não foi possível desvincular a conta GitHub.'
      )
    } finally {
      setIsDisconnectingGitHub(false)
    }
  }

  function closeDialog(): void {
    if (authorization) {
      linkAttemptId.current += 1
      void window.pageSpace.cancelGitHubLink(authorization.flowId)
    }
    onClose()
  }

  return (
    <div className="dialog-backdrop app-settings-backdrop" role="presentation">
      <section
        className="app-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-settings-title"
      >
        <header>
          <h2 id="app-settings-title">Configurações do PageSpace</h2>
          <ModalCloseButton
            onClick={closeDialog}
            disabled={isChecking || isDisconnectingGitHub || isInstallingUpdate}
          />
        </header>

        <div className="app-settings-divider" />

        <div className="app-settings-held-content" hidden aria-hidden="true">
          <div className="app-settings-section">
            <h3>Aplicativo local</h3>
            <div className="app-settings-update">
              <button
                type="button"
                disabled={
                  isCheckingUpdate || isInstallingUpdate || updateStatus?.state === 'up-to-date'
                }
                onClick={() =>
                  updateStatus?.state === 'available'
                    ? void installUpdate()
                    : void checkForUpdate(true)
                }
              >
                {updateStatus?.state === 'available' ? (
                  <ImportIcon size={18} />
                ) : (
                  <CheckIcon size={18} />
                )}
                {updateButtonText()}
              </button>
              <dl className="app-settings-update-versions">
                <div>
                  <dt>Última versão no GitHub</dt>
                  <dd>{latestReleaseVersion()}</dd>
                </div>
                <div>
                  <dt>Versão em uso</dt>
                  <dd>v{snapshot.version}</dd>
                </div>
              </dl>
            </div>
            {updateError ? (
              <p className="dialog-error app-settings-update-error">{updateError}</p>
            ) : null}
          </div>

          {damagedPages.length ? (
            <div className="app-settings-section app-settings-damaged-section">
              <h3>Páginas que precisam de atenção</h3>
              <div className="app-settings-damaged-list">
                {damagedPages.map((page) => (
                  <button
                    type="button"
                    key={page.id}
                    onClick={() => {
                      onClose()
                      onOpenProblem(page.id)
                    }}
                  >
                    <WarningIcon size={18} />
                    <span>
                      <strong>{page.name}</strong>
                      <small>{page.folderName}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="app-settings-section">
            <div className="app-settings-actions app-settings-actions--standalone">
              <button type="button" onClick={downloadAiInstructions}>
                Baixar instruções para IA (.txt)
              </button>
            </div>
            {instructionMessage ? (
              <p className="app-settings-inline-message">{instructionMessage}</p>
            ) : null}
          </div>
        </div>

        <section className="app-settings-section app-settings-github-section">
          <h3>Conta GitHub</h3>
          {connectedAccount ? (
            <div className="github-connected-row">
              <button
                className="github-account github-account--link"
                type="button"
                onClick={() => window.pageSpace.openPageLink(connectedAccount.profileUrl)}
              >
                <img src={connectedAccount.avatarUrl} alt="" />
                <span>
                  <strong>{connectedAccount.name ?? connectedAccount.login}</strong>
                  <small>@{connectedAccount.login}</small>
                </span>
              </button>
              <button
                className="github-account-action github-disconnect-action"
                type="button"
                disabled={isDisconnectingGitHub}
                onClick={disconnectGitHub}
              >
                {isDisconnectingGitHub ? 'Desvinculando…' : 'Desvincular conta'}
              </button>
            </div>
          ) : (
            <>
              <div className="github-disconnected-layout">
                <p className="github-section-description">
                  <span>Vincule sua conta GitHub para publicar suas páginas.</span>
                  <span>Será criado um repositório para cada uma postada.</span>
                </p>
                <button
                  className="github-account-action github-account-link"
                  type="button"
                  disabled={isLinkingGitHub}
                  onClick={beginGitHubLink}
                >
                  {authorization ? 'Aguardando autorização…' : 'Vincular conta'}
                </button>
              </div>
              {authorization ? (
                <div className="github-device-flow">
                  <div className="github-device-code-row">
                    <p>Copie o código e cole-o na página aberta do GitHub.</p>
                    <button
                      className="github-device-code"
                      type="button"
                      title="Copiar código"
                      onClick={copyGitHubCode}
                    >
                      {authorization.userCode}
                    </button>
                  </div>
                  <button className="github-cancel-link" type="button" onClick={cancelGitHubLink}>
                    Cancelar vinculação
                  </button>
                </div>
              ) : null}
            </>
          )}
          {error ? <p className="dialog-error">{error}</p> : null}
        </section>

        <section className="app-settings-section app-settings-pages-section">
          <h3>Páginas</h3>
        </section>

        <section className="app-settings-section app-settings-instructions-section">
          <h3>Instruções</h3>
          <div className="app-instructions-layout">
            <p>Use as instruções na criação de páginas para possibilitar o seu uso no PageSpace.</p>
            <button type="button" onClick={downloadAiInstructions}>
              Baixar .txt
            </button>
          </div>
          {instructionMessage ? (
            <p className="app-settings-inline-message">{instructionMessage}</p>
          ) : null}
        </section>

        <section className="app-settings-section app-settings-version-section">
          <h3>Versão</h3>
          <div className="app-version-layout">
            <dl className="app-version-details">
              <div>
                <dt>Versão instalada</dt>
                <dd>{displayedCurrentVersion || '—'}</dd>
              </div>
              <div>
                <dt>Versão mais recente</dt>
                <dd className={updateCheckFailed ? 'app-version-check-error' : undefined}>
                  {latestReleaseVersion()}
                </dd>
              </div>
            </dl>
            <button
              className="app-version-update-button"
              type="button"
              disabled={
                isCheckingUpdate || isInstallingUpdate || updateStatus?.state === 'up-to-date'
              }
              onClick={() =>
                updateStatus?.state === 'available'
                  ? void installUpdate()
                  : void checkForUpdate(true)
              }
            >
              {updateStatus?.state === 'available' ? <ImportIcon size={19} /> : null}
              {updateStatus?.state === 'up-to-date' ? (
                <CheckIcon size={18} strokeWidth={2.4} />
              ) : null}
              {updateButtonText()}
            </button>
          </div>
          {updateError ? (
            <p className="dialog-error app-settings-update-error">{updateError}</p>
          ) : null}
        </section>
      </section>
    </div>
  )
}
