import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AppSettingsSnapshot,
  AppUpdateStatus,
  GitHubDeviceAuthorization,
  PageSummary
} from '../../../shared/page-contracts'
import { CheckIcon, ImportIcon, WarningIcon } from './icons'
import { ModalCloseButton } from './ModalCloseButton'

type AppSettingsDialogProps = {
  initialPages: PageSummary[]
  onClose: () => void
  onPagesRefreshed: (pages: PageSummary[]) => void
  onOpenProblem: (pageId: string) => void
}

export function AppSettingsDialog({
  initialPages,
  onClose,
  onPagesRefreshed,
  onOpenProblem
}: AppSettingsDialogProps): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<AppSettingsSnapshot>({
    version: '0.0.0',
    github: { state: 'disconnected' },
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
  const linkAttemptId = useRef(0)
  const [codeWasCopied, setCodeWasCopied] = useState(false)
  const damagedPages = useMemo(
    () => snapshot.pages.filter((page) => page.health === 'damaged'),
    [snapshot.pages]
  )

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
    try {
      setUpdateStatus(await window.pageSpace.checkForAppUpdate(force))
    } catch (checkError) {
      setUpdateError(
        checkError instanceof Error
          ? checkError.message
          : 'Não foi possível verificar as atualizações.'
      )
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
    if (updateStatus?.state === 'available' || updateStatus?.state === 'up-to-date') {
      return `v${updateStatus.latestVersion}`
    }
    return isCheckingUpdate ? 'Verificando…' : '—'
  }

  function updateButtonText(): string {
    if (isInstallingUpdate) return 'Baixando e preparando…'
    if (isCheckingUpdate) return 'Verificando…'
    if (updateStatus?.state === 'available') return 'Baixar e atualizar'
    if (updateStatus?.state === 'up-to-date') return 'Usando última versão'
    return 'Verificar atualizações'
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
    setCodeWasCopied(false)
    setIsLinkingGitHub(true)
    try {
      const nextAuthorization = await window.pageSpace.beginGitHubLink()
      if (linkAttemptId.current !== attemptId) {
        await window.pageSpace.cancelGitHubLink(nextAuthorization.flowId)
        return
      }
      setAuthorization(nextAuthorization)
      setCodeWasCopied(true)
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
    setCodeWasCopied(false)
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
    setCodeWasCopied(true)
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

        <div className="app-settings-section app-settings-github-section">
          <div className="app-settings-github-heading">
            <h3>Conta GitHub</h3>
            {snapshot.github.state === 'connected' ? (
              <div className="github-account">
                <img src={snapshot.github.account.avatarUrl} alt="" />
                <span>
                  <strong>{snapshot.github.account.name ?? snapshot.github.account.login}</strong>
                  <small>@{snapshot.github.account.login}</small>
                </span>
              </div>
            ) : authorization ? (
              <div className="github-device-flow">
                <p>O GitHub foi aberto no navegador. Use o código copiado:</p>
                <button
                  className="github-device-code"
                  type="button"
                  title="Copiar código"
                  onClick={copyGitHubCode}
                >
                  {authorization.userCode}
                </button>
                <small>
                  {codeWasCopied ? 'Código copiado. ' : ''}
                  Aguardando autorização…
                </small>
                <div className="github-device-actions">
                  <button type="button" onClick={() => window.pageSpace.openGitHubDevicePage()}>
                    Abrir GitHub novamente
                  </button>
                  <button type="button" onClick={cancelGitHubLink}>
                    Cancelar vinculação
                  </button>
                </div>
              </div>
            ) : (
              <p>Vincule sua conta para publicar páginas em seus repositórios.</p>
            )}
          </div>
          {snapshot.github.state === 'connected' ? (
            <button
              className="github-account-action"
              type="button"
              disabled={isDisconnectingGitHub}
              onClick={disconnectGitHub}
            >
              {isDisconnectingGitHub ? 'Desvinculando…' : 'Desvincular'}
            </button>
          ) : (
            <button
              className="github-account-action github-account-link"
              type="button"
              disabled={isLinkingGitHub}
              onClick={beginGitHubLink}
            >
              {authorization ? 'Aguardando…' : 'Vincular conta GitHub'}
            </button>
          )}
        </div>

        {error ? <p className="dialog-error">{error}</p> : null}
      </section>
    </div>
  )
}
