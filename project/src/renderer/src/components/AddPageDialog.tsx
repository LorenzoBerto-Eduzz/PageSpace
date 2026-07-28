import { ModalCloseButton } from './ModalCloseButton'
import { ImportIcon, PlusTabIcon } from './icons'

type AddPageDialogProps = {
  isImporting: boolean
  error: string | null
  onClose: () => void
  onCreateSimple: () => void
  onImport: () => Promise<void>
}

export function AddPageDialog({
  isImporting,
  error,
  onClose,
  onCreateSimple,
  onImport
}: AddPageDialogProps): React.JSX.Element {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="create-page-dialog add-page-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-page-title"
      >
        <header>
          <h2 id="add-page-title">Adicionar página</h2>
          <ModalCloseButton onClick={onClose} disabled={isImporting} />
        </header>

        <div className="add-page-options">
          <button
            type="button"
            onClick={() => {
              void onImport()
            }}
            disabled={isImporting}
          >
            <ImportIcon size={42} />
            <span>{isImporting ? 'Trazendo página…' : 'Trazer página'}</span>
          </button>
          <button type="button" onClick={onCreateSimple} disabled={isImporting}>
            <PlusTabIcon size={42} />
            <span>Criar página</span>
          </button>
        </div>

        {error ? <p className="dialog-error">{error}</p> : null}
      </section>
    </div>
  )
}
