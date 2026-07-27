import { useState } from 'react'
import type { PageSummary, UpdatePageDetailsInput } from '../../../shared/page-contracts'
import { ModalCloseButton } from './ModalCloseButton'

type PageSettingsDialogProps = {
  page: PageSummary
  onClose: () => void
  onUpdated: (page: PageSummary) => void
  onDeleted: (pageId: string) => void
}

export function PageSettingsDialog({
  page,
  onClose,
  onUpdated,
  onDeleted
}: PageSettingsDialogProps): React.JSX.Element {
  const [name, setName] = useState(page.name)
  const [description, setDescription] = useState(page.description)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasChanges = name.trim() !== page.name || description.trim() !== page.description

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
          <ModalCloseButton onClick={onClose} disabled={isSaving || isDeleting} />
        </header>

        <form onSubmit={save}>
          <label>
            Nome da página
            <input
              autoFocus
              value={name}
              maxLength={80}
              disabled={isSaving || isDeleting}
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
              disabled={isSaving || isDeleting}
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
            disabled={isSaving || isDeleting}
            onClick={openFolder}
          >
            Abrir pasta da página
          </button>

          {error ? <p className="dialog-error">{error}</p> : null}

          <footer>
            <button
              className="dialog-button page-settings-delete-button"
              type="button"
              disabled={isSaving || isDeleting}
              onClick={() => setIsDeleteConfirmationOpen(true)}
            >
              Excluir página
            </button>
            <span className="page-settings-footer-spacer" />
            <button
              className="dialog-button dialog-button--primary"
              type="submit"
              disabled={!hasChanges || isSaving || isDeleting || !name.trim()}
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
    </div>
  )
}
