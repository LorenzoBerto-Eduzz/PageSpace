import { PlusIcon } from './icons'

export function AddPageCard(): React.JSX.Element {
  return (
    <button className="add-page-card" type="button" aria-label="Criar página">
      <PlusIcon size={28} />
      <span>Criar página</span>
    </button>
  )
}
