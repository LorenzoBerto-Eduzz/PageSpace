import type { PageSummary } from '../../../shared/page-contracts'
import { ModalCloseButton } from './ModalCloseButton'

type PageRecoveryDialogProps = {
  page: PageSummary
  isRecovering: boolean
  error: string | null
  onClose: () => void
  onRecover: () => void
}

export function PageRecoveryDialog({
  page,
  isRecovering,
  error,
  onClose,
  onRecover
}: PageRecoveryDialogProps): React.JSX.Element {
  return (
    <div className="dialog-backdrop page-recovery-backdrop" role="presentation">
      <section
        className="page-recovery-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="page-recovery-title"
      >
        <header>
          <div className="page-recovery-heading">
            <div className="page-recovery-symbol" aria-hidden="true">
              !
            </div>
            <h2 id="page-recovery-title">Esta página precisa de atenção</h2>
          </div>
          <ModalCloseButton onClick={onClose} disabled={isRecovering} />
        </header>
        <p>{page.healthMessage ?? 'Os arquivos essenciais desta página estão danificados.'}</p>
        <p>
          {page.canRecover
            ? 'O PageSpace encontrou o último backup válido e pode restaurá-lo.'
            : 'Nenhum backup válido foi encontrado. Seus arquivos não serão alterados automaticamente.'}
        </p>
        {error ? <p className="dialog-error">{error}</p> : null}
        <footer>
          <button
            className="dialog-button page-recovery-button"
            type="button"
            disabled={!page.canRecover || isRecovering}
            onClick={onRecover}
          >
            {isRecovering ? 'Recuperando…' : 'Recuperar último backup'}
          </button>
        </footer>
      </section>
    </div>
  )
}
