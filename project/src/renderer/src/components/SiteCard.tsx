import { LockIcon, SettingsIcon } from './icons'

export type DashboardPage = {
  id: string
  name: string
  description: string
  status: 'local' | 'published'
  preview: 'links-hub' | 'empty'
  isPlaceholder?: boolean
}

type SiteCardProps = {
  page: DashboardPage
}

function PreviewCanvas({ page }: SiteCardProps): React.JSX.Element {
  if (page.preview === 'empty') {
    return <div className="site-preview site-preview--empty" aria-label="Prévia vazia da página" />
  }

  return <div className="site-preview" aria-label={`Prévia da página ${page.name}`} />
}

export function SiteCard({ page }: SiteCardProps): React.JSX.Element {
  const className = page.isPlaceholder ? 'site-card site-card--placeholder' : 'site-card'

  return (
    <article
      className={className}
      tabIndex={0}
      role="button"
      aria-label={`Abrir edição de ${page.name}`}
      onClick={(event) => {
        if (!(event.target instanceof Element && event.target.closest('.card-action'))) {
          event.currentTarget.focus()
        }
      }}
    >
      <PreviewCanvas page={page} />

      <div className="site-card-content">
        <h2>{page.name}</h2>
        <p className="site-description">{page.description}</p>

        <footer className="site-card-actions">
          <button className="card-action" type="button" aria-label="Página somente local">
            <LockIcon size={18} />
          </button>
          <button className="card-action" type="button" aria-label="Configurar página">
            <SettingsIcon size={19} />
          </button>
        </footer>
      </div>
    </article>
  )
}
