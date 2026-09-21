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
  const [isPublicationConfirmationOpen, setIsPublicationConfirmationOpen] = useState(false)
  const [isDeletingPublication, setIsDeletingPublication] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [github, setGitHub] = useState<GitHubConnectionStatus | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const hasChanges = name.trim() !== page.name || description.trim() !== page.description
  const hasPendingPublication =
    page.deployment.kind === 'published' &&
    (page.deployment.hasUnpublishedChanges === true || Boolean(page.deployment.pendingCommitOid))

  useEffect(() => {
    window.pageSpace
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
      onUpdated(await window.pageSpace.updatePageDetails(input))
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
      await window.pageSpace.openPageFolder(page.id)
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Não foi possível abrir a pasta.')
    }
  }

  async function openSourceFolder(): Promise<void> {
    setError(null)
    try {
      await window.pageSpace.openPageSourceFolder(page.id)
    } catch (openError) {
      setError(
        openError instanceof Error ? openError.message : 'Não foi possível abrir a pasta de origem.'
      )
    }
  }

  async function restoreSourceFolder(): Promise<void> {
    if (isBusy || page.sourceSync.state !== 'unavailable') return
    if (
      !window.confirm(
        'A pasta de origem não foi encontrada. Recriar uma cópia limpa no mesmo caminho? As edições personalizadas não serão copiadas.'
      )
    ) {
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      await window.pageSpace.restorePageSourceFolder(page.id)
      onUpdated((await window.pageSpace.getPage(page.id)).page)
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : 'Não foi possível recriar a pasta de origem.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function deletePage(): Promise<void> {
    if (isDeleting) return
    setIsDeleting(true)
    setError(null)
    try {
      await window.pageSpace.deleteLocalPage(page.id)
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
      const result = await window.pageSpace.publishPage({
        pageId: page.id
      })
      onUpdated(result.page)
    } catch (publishError) {
      try {
        onUpdated((await window.pageSpace.getPage(page.id)).page)
      } catch {
        // Preserve the original publishing error below.
      }
      setError(
        publishError instanceof Error ? publishError.message : 'Não foi possível publicar a página.'
      )
    } finally {
      setIsPublishing(false)
    }
  }

  async function deletePublication(): Promise<void> {
    if (isDeletingPublication || page.deployment.kind !== 'published') return
    setIsDeletingPublication(true)
    setError(null)
    try {
      const result = await window.pageSpace.deletePublication({
        pageId: page.id
      })
      onUpdated(result.page)
      setIsPublicationConfirmationOpen(false)
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Não foi possível excluir a publicação.'
      )
    } finally {
      setIsDeletingPublication(false)
    }
  }

  const isBusy = isSaving || isDeleting || isPublishing || isDeletingPublication
  const isGitHubStatusLoading = github === null
  const connected = github?.state === 'connected'
  const hasPublishingAccount =
    connected &&
    (page.deployment.kind !== 'published' ||
      github.account.login.toLowerCase() === page.deployment.owner.toLowerCase())

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

        <div className="page-settings-divider" />

        <form className="page-settings-details-form" onSubmit={save}>
          <label>
            Título
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

          {error ? <p className="dialog-error">{error}</p> : null}

          <footer>
            <button
              className="dialog-button dialog-button--primary"
              type="submit"
              disabled={!hasChanges || isBusy || !name.trim()}
            >
              {isSaving ? 'Salvando…' : 'Salvar'}
            </button>
          </footer>
        </form>

        {page.source.kind !== 'simple' ? (
          <div className="page-settings-origin-actions">
            <button
              className="page-settings-folder-button"
              type="button"
              disabled={isBusy}
              onClick={() =>
                page.sourceSync.state === 'unavailable'
                  ? void restoreSourceFolder()
                  : void openSourceFolder()
              }
            >
              {page.sourceSync.state === 'unavailable'
                ? 'Recriar pasta origem'
                : 'Abrir pasta origem'}
            </button>
            {page.sourceSync.state === 'unavailable' ? (
              <small>
                A pasta de origem não foi encontrada. A atualização automática está pausada.
              </small>
            ) : null}
          </div>
        ) : null}

        <div className="page-settings-destructive-actions">
          {page.deployment.kind === 'published' ? (
            <button
              className="page-settings-danger-action"
              type="button"
              disabled={!hasPublishingAccount || isBusy}
              onClick={() => setIsPublicationConfirmationOpen(true)}
            >
              {isDeletingPublication
                ? 'Deletando publicação…'
                : 'Excluir publicação (Deletar repositório)'}
            </button>
          ) : null}
          <button
            className="page-settings-danger-action"
            type="button"
            disabled={isBusy}
            onClick={() => setIsDeleteConfirmationOpen(true)}
          >
            Excluir página (Deletar cópia salva)
          </button>
        </div>

        <div className="page-settings-held-content" hidden aria-hidden="true">
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
                  {hasPendingPublication ? 'Alterações não publicadas em ' : 'Publicada em '}
                  <strong>
                    @{page.deployment.owner}/{page.deployment.repository}
                  </strong>
                </p>
                <small>
                  {hasPendingPublication
                    ? 'As alterações estão salvas localmente e ainda precisam ser enviadas.'
                    : `Última publicação: ${formatPublicationDate(
                        page.deployment.lastPublishedAt
                      )}`}
                </small>
                <div className="page-publishing-actions">
                  <button
                    className="page-settings-folder-button"
                    type="button"
                    disabled={isBusy}
                    onClick={() => window.pageSpace.openPublishedRepository(page.id)}
                  >
                    Ver repositório no GitHub
                  </button>
                  <button
                    className="page-settings-folder-button page-publication-delete-button"
                    type="button"
                    disabled={!hasPublishingAccount || isBusy}
                    onClick={deletePublication}
                  >
                    {isDeletingPublication ? 'Excluindo…' : 'Excluir publicação'}
                  </button>
                </div>
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
            {isGitHubStatusLoading ? <small>Verificando a conta GitHub…</small> : null}
            {!isGitHubStatusLoading && !connected ? (
              <small>
                {page.deployment.kind === 'published'
                  ? `Esta página continua online. Vincule a conta @${page.deployment.owner} para atualizar ou excluir a publicação.`
                  : 'Abra as configurações gerais e vincule uma conta GitHub para publicar.'}
              </small>
            ) : null}
            {connected && !hasPublishingAccount && page.deployment.kind === 'published' ? (
              <small>
                Esta página continua online e pertence a @{page.deployment.owner}. Vincule essa
                conta para atualizar ou excluir a publicação.
              </small>
            ) : null}
            {page.deployment.kind !== 'published' || hasPendingPublication ? (
              <button
                className="page-settings-folder-button"
                type="button"
                disabled={!hasPublishingAccount || isBusy || hasUnsavedChanges}
                onClick={publish}
              >
                {isPublishing
                  ? 'Publicando…'
                  : page.deployment.kind === 'published'
                    ? page.deployment.pendingCommitOid
                      ? 'Tentar publicar novamente'
                      : 'Publicar atualização'
                    : page.deployment.kind === 'publishing'
                      ? 'Continuar publicação'
                      : isGitHubStatusLoading
                        ? 'Verificando conta GitHub…'
                        : connected
                          ? 'Publicar online'
                          : 'Vincule o GitHub para publicar'}
              </button>
            ) : null}
          </section>

          <footer>
            <button
              className="dialog-button page-settings-delete-button"
              type="button"
              disabled={isBusy}
              onClick={() => setIsDeleteConfirmationOpen(true)}
            >
              Excluir página
            </button>
          </footer>
        </div>
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
      {isPublicationConfirmationOpen ? (
        <div className="delete-confirmation-backdrop" role="presentation">
          <section
            className="delete-confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-publication-title"
          >
            <header>
              <h2 id="delete-publication-title">Deletar publicação?</h2>
              <ModalCloseButton
                onClick={() => setIsPublicationConfirmationOpen(false)}
                disabled={isDeletingPublication}
              />
            </header>
            <p>
              O repositório{' '}
              <strong>
                @{page.deployment.kind === 'published' ? page.deployment.owner : ''}/
                {page.deployment.kind === 'published' ? page.deployment.repository : ''}
              </strong>{' '}
              será excluído do GitHub.
            </p>
            <p>A cópia local da página não será afetada.</p>
            <footer>
              <button
                className="dialog-button delete-confirmation-button"
                type="button"
                disabled={isDeletingPublication}
                onClick={() => void deletePublication()}
              >
                {isDeletingPublication ? 'Deletando…' : 'Excluir repositório'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  )
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
