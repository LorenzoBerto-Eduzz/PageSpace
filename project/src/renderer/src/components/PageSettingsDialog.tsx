import { useEffect, useState } from 'react'
import type {
  GitHubConnectionStatus,
  PageSummary,
  UpdatePageDetailsInput
} from '../../../shared/page-contracts'
import { ModalCloseButton } from './ModalCloseButton'

type PageSettingsDialogProps = {
  page: PageSummary
  onClose: () => void
  onUpdated: (page: PageSummary) => void
  onDeleted: (pageId: string) => void
  hasUnsavedChanges?: boolean
}

export function PageSettingsDialog({
  page,
  onClose,
  onUpdated,
  onDeleted,
  hasUnsavedChanges = false
}: PageSettingsDialogProps): React.JSX.Element {
  const [name, setName] = useState(page.name)
  const [description, setDescription] = useState(page.description)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [github, setGitHub] = useState<GitHubConnectionStatus | null>(null)
  const [isPublishConfirmationOpen, setIsPublishConfirmationOpen] = useState(false)
  const [repositoryName, setRepositoryName] = useState(() =>
    suggestedRepositoryName(page.folderName)
  )
  const [isPublishing, setIsPublishing] = useState(false)
  const hasChanges = name.trim() !== page.name || description.trim() !== page.description

  useEffect(() => {
    window.pageMaker
      .getGitHubStatus()
      .then(setGitHub)
      .catch(() => setGitHub({ state: 'disconnected' }))
  }, [])

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (isSaving || isDeleting || !hasChanges) return
    setIsSaving(true)
    setError(null)
    const input: UpdatePageDetailsInput = { pageId: page.id, name, description }
    try {
      onUpdated(await window.pageMaker.updatePageDetails(input))
      onClose()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Não foi possível atualizar a página.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function openFolder(): Promise<void> {
    setError(null)
    try {
      await window.pageMaker.openPageFolder(page.id)
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Não foi possível abrir a pasta.')
    }
  }

  async function deletePage(): Promise<void> {
    if (isDeleting) return
    setIsDeleting(true)
    setError(null)
    try {
      await window.pageMaker.deleteLocalPage(page.id)
      onDeleted(page.id)
      onClose()
    } catch (deleteError) {
      setIsDeleteConfirmationOpen(false)
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Não foi possível mover a página para a Lixeira.'
      )
    } finally {
      setIsDeleting(false)
    }
  }

  async function publish(): Promise<void> {
    if (isPublishing || hasUnsavedChanges) return
    setIsPublishing(true)
    setError(null)
    try {
      const result = await window.pageMaker.publishPage({
        pageId: page.id,
        ...(page.deployment.kind === 'local-only' ? { repositoryName } : {})
      })
      onUpdated(result.page)
      setIsPublishConfirmationOpen(false)
    } catch (publishError) {
      try {
        onUpdated((await window.pageMaker.getPage(page.id)).page)
      } catch {
        // Preserve the original publishing error below.
      }
      setError(
        publishError instanceof Error ? publishError.message : 'Não foi possível publicar a página.'
      )
      setIsPublishConfirmationOpen(false)
    } finally {
      setIsPublishing(false)
    }
  }

  const isBusy = isSaving || isDeleting || isPublishing
  const connected = github?.state === 'connected'

  return (
    <div className="dialog-backdrop page-settings-backdrop" role="presentation">
      <section
        className="page-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-settings-title"
      >
        <header>
          <h2 id="page-settings-title">Configurações da página</h2>
          <ModalCloseButton onClick={onClose} disabled={isBusy} />
        </header>

        <form onSubmit={save}>
          <label>
            Nome da página
            <input
              autoFocus
              value={name}
              maxLength={80}
              disabled={isBusy}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label>
            <span className="dialog-label-title">
              Descrição <span>(opcional)</span>
            </span>
            <textarea
              value={description}
              maxLength={180}
              rows={2}
              disabled={isBusy}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <label className="folder-name-field">
            Nome da pasta original
            <input value={page.folderName} readOnly tabIndex={-1} />
            <small>
              Este nome permanece fixo para proteger a pasta e o histórico Git da página.
            </small>
          </label>

          <button
            className="page-settings-folder-button"
            type="button"
            disabled={isBusy}
            onClick={openFolder}
          >
            Abrir pasta da página
          </button>

          <section className="page-publishing-section">
            <h3>Publicação online</h3>
            {page.deployment.kind === 'published' ? (
              <>
                <p>
                  {page.deployment.pendingCommitOid ? 'Atualização pendente em ' : 'Publicada em '}
                  <strong>
                    @{page.deployment.owner}/{page.deployment.repository}
                  </strong>
                </p>
                <small>
                  {page.deployment.pendingCommitOid
                    ? 'As alterações estão salvas localmente e ainda precisam ser enviadas.'
                    : `Última publicação: ${formatPublicationDate(
                        page.deployment.lastPublishedAt
                      )}`}
                </small>
                <button
                  className="page-public-link"
                  type="button"
                  onClick={() => window.pageMaker.openPublishedPage(page.id)}
                >
                  {page.deployment.publicUrl}
                </button>
              </>
            ) : (
              <p>
                {connected
                  ? `Conta vinculada: @${github.account.login}`
                  : 'Vincule uma conta GitHub nas configurações gerais para publicar.'}
              </p>
            )}
            {hasUnsavedChanges ? (
              <small>Salve as alterações abertas no editor antes de publicar.</small>
            ) : null}
            <button
              className="page-settings-folder-button"
              type="button"
              disabled={!connected || isBusy || hasUnsavedChanges}
              onClick={() => setIsPublishConfirmationOpen(true)}
            >
              {page.deployment.kind === 'published'
                ? page.deployment.pendingCommitOid
                  ? 'Tentar publicar novamente'
                  : 'Publicar atualização'
                : page.deployment.kind === 'publishing'
                  ? 'Continuar publicação'
                  : 'Publicar online'}
            </button>
          </section>

          {error ? <p className="dialog-error">{error}</p> : null}

          <footer>
            <button
              className="dialog-button page-settings-delete-button"
              type="button"
              disabled={isBusy}
              onClick={() => setIsDeleteConfirmationOpen(true)}
            >
              Excluir página
            </button>
            <span className="page-settings-footer-spacer" />
            <button
              className="dialog-button dialog-button--primary"
              type="submit"
              disabled={!hasChanges || isBusy || !name.trim()}
            >
              {isSaving ? 'Salvando…' : 'Salvar'}
            </button>
          </footer>
        </form>
      </section>

      {isDeleteConfirmationOpen ? (
        <div className="delete-confirmation-backdrop" role="presentation">
          <section
            className="delete-confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-page-title"
          >
            <header>
              <h2 id="delete-page-title">Excluir esta página?</h2>
              <ModalCloseButton
                onClick={() => setIsDeleteConfirmationOpen(false)}
                disabled={isDeleting}
              />
            </header>
            <p>
              A página <strong>{page.name}</strong> e sua pasta local serão movidas para a Lixeira
              do Windows.
            </p>
            <p>Nenhum repositório online será afetado.</p>
            <footer>
              <button
                className="dialog-button delete-confirmation-button"
                type="button"
                disabled={isDeleting}
                onClick={deletePage}
              >
                {isDeleting ? 'Excluindo…' : 'Mover para a Lixeira'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {isPublishConfirmationOpen ? (
        <div className="delete-confirmation-backdrop" role="presentation">
          <section
            className="delete-confirmation-dialog publish-confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-page-title"
          >
            <header>
              <h2 id="publish-page-title">
                {page.deployment.kind === 'published'
                  ? 'Publicar atualização?'
                  : 'Publicar online?'}
              </h2>
              <ModalCloseButton
                onClick={() => setIsPublishConfirmationOpen(false)}
                disabled={isPublishing}
              />
            </header>
            {page.deployment.kind === 'local-only' ? (
              <label>
                Nome do repositório público
                <input
                  autoFocus
                  value={repositoryName}
                  maxLength={100}
                  disabled={isPublishing}
                  onChange={(event) => setRepositoryName(event.target.value)}
                />
              </label>
            ) : null}
            <p>
              O repositório será público. Somente os arquivos gerados do site serão enviados; dados
              internos do PageMaker, backups e credenciais permanecerão locais.
            </p>
            <footer>
              <button
                className="dialog-button dialog-button--primary"
                type="button"
                disabled={
                  isPublishing || (page.deployment.kind === 'local-only' && !repositoryName.trim())
                }
                onClick={publish}
              >
                {isPublishing ? 'Publicando…' : 'Confirmar publicação'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function suggestedRepositoryName(value: string): string {
  const suggested = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80)
  return suggested || 'minha-pagina'
}

function formatPublicationDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'data indisponível'
    : new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(date)
}
