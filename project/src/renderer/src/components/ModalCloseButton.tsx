import { CloseIcon } from './icons'

type ModalCloseButtonProps = {
  onClick: () => void
  disabled?: boolean
}

export function ModalCloseButton({
  onClick,
  disabled = false
}: ModalCloseButtonProps): React.JSX.Element {
  return (
    <button
      className="modal-close-button"
      type="button"
      aria-label="Fechar"
      disabled={disabled}
      onClick={onClick}
    >
      <CloseIcon size={21} />
    </button>
  )
}
