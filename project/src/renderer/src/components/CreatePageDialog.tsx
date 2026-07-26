import { useRef, useState } from 'react'
import type { CreatePageInput } from '../../../shared/page-contracts'

type CreatePageDialogProps = {
  isSaving: boolean
  error: string | null
  onClose: () => void
  onCreate: (input: CreatePageInput) => Promise<void>
}

export function CreatePageDialog({
  isSaving,
  error,
  onClose,
  onCreate
}: CreatePageDialogProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const isSubmitting = useRef(false)

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (isSubmitting.current || isSaving) return

    isSubmitting.current = true
    try {
      await onCreate({ name, description })
    } finally {
      isSubmitting.current = false
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="create-page-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-page-title"
      >
        <header>
          <h2 id="create-page-title">Criar Página</h2>
        </header>

        <form onSubmit={submit}>
          <label>
            Nome da página
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder="Nome da página"
              disabled={isSaving}
            />
          </label>
          <label>
            <span className="dialog-label-title">
              Descrição <span>(opcional)</span>
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={180}
              placeholder="Frase para descrever e identificar a página"
              rows={2}
              disabled={isSaving}
            />
          </label>

          {error ? <p className="dialog-error">{error}</p> : null}

          <footer>
            <button
              className="dialog-button dialog-button--secondary"
              type="button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              className="dialog-button dialog-button--primary"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? 'Criando…' : 'Criar página'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
