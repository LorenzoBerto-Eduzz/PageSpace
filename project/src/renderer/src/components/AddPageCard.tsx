import { ImportIcon } from './icons'

type AddPageCardProps = {
  onClick: () => void
  disabled?: boolean
  isImporting?: boolean
}

export function AddPageCard({
  onClick,
  disabled = false,
  isImporting = false
}: AddPageCardProps): React.JSX.Element {
  return (
    <button
      className="add-page-card"
      type="button"
      aria-label="Trazer página"
      onClick={onClick}
      disabled={disabled}
    >
      <ImportIcon size={28} />
      <span>{isImporting ? 'Trazendo página…' : 'Trazer página'}</span>
    </button>
  )
}
