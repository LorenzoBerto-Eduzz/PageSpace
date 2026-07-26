import { PlusIcon } from './icons'

type AddPageCardProps = {
  onClick: () => void
  disabled?: boolean
}

export function AddPageCard({ onClick, disabled = false }: AddPageCardProps): React.JSX.Element {
  return (
    <button
      className="add-page-card"
      type="button"
      aria-label="Criar página"
      onClick={onClick}
      disabled={disabled}
    >
      <PlusIcon size={28} />
      <span>Criar página</span>
    </button>
  )
}
