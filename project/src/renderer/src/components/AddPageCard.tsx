import { PlusIcon } from './icons'

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
      aria-label={isImporting ? 'Trazendo página' : 'Trazer página'}
      aria-busy={isImporting}
      onClick={onClick}
      disabled={disabled}
    >
      {isImporting ? (
        <span className="add-page-spinner" aria-hidden="true" />
      ) : (
        <PlusIcon size={28} />
      )}
      <span>{isImporting ? 'Trazendo página…' : 'Trazer página'}</span>
    </button>
  )
}
