import { useEffect, useMemo, useState } from 'react'
import type { AppSettingsSnapshot, PageSummary } from '../../../shared/page-contracts'
import { FolderIcon, WarningIcon } from './icons'
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
    githubLinked: false,
    pages: initialPages
  })
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const damagedPages = useMemo(
    () => snapshot.pages.filter((page) => page.health === 'damaged'),
    [snapshot.pages]
  )

  useEffect(() => {
    void refresh()
    // The initial scan belongs to this modal opening only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function refresh(): Promise<void> {
    if (isChecking) return
    setIsChecking(true)
    setError(null)
    try {
      const nextSnapshot = await window.pageMaker.getAppSettings()
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

  async function openPagesFolder(): Promise<void> {
    setError(null)
    try {
      await window.pageMaker.openPagesFolder()
    } catch (openError) {
      setError(
        openError instanceof Error ? openError.message : 'Não foi possível abrir a pasta Pages.'
      )
    }
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
          <h2 id="app-settings-title">Configurações do PageMaker</h2>
          <ModalCloseButton onClick={onClose} disabled={isChecking} />
        </header>

        <div className="app-settings-section">
          <h3>Aplicativo local</h3>
          <dl className="app-settings-facts">
            <div>
              <dt>Versão do aplicativo</dt>
              <dd>v{snapshot.version}</dd>
            </div>
            <div>
              <dt>Páginas locais</dt>
              <dd>{snapshot.pages.length}</dd>
            </div>
            <div>
              <dt>Páginas com problema</dt>
              <dd className={damagedPages.length ? 'app-settings-problem-count' : ''}>
                {damagedPages.length}
              </dd>
            </div>
          </dl>

          <div className="app-settings-actions">
            <button type="button" onClick={openPagesFolder} disabled={isChecking}>
              <FolderIcon size={18} />
              Abrir pasta Pages
            </button>
            <button type="button" onClick={refresh} disabled={isChecking}>
              {isChecking ? 'Verificando…' : 'Verificar páginas novamente'}
            </button>
          </div>
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

        <div className="app-settings-section app-settings-github-section">
          <div>
            <h3>Conta GitHub</h3>
            <p>A conexão será configurada em uma próxima etapa.</p>
          </div>
          <span>Não vinculada</span>
        </div>

        {error ? <p className="dialog-error">{error}</p> : null}
      </section>
    </div>
  )
}
