import { LockIcon, SettingsIcon } from './icons'

export type DashboardPage = {
  id: string
  name: string
  description: string
  status: 'local' | 'published'
  preview: 'captured' | 'empty'
  previewDataUrl?: string
  isPlaceholder?: boolean
}

type SiteCardProps = {
  page: DashboardPage
  onOpen?: (pageId: string) => void
  onOpenSettings?: (pageId: string) => void
}

function PreviewCanvas({ page }: SiteCardProps): React.JSX.Element {
  if (page.preview === 'empty') {
    return <div className="site-preview site-preview--empty" aria-label="Prévia vazia da página" />
  }

  return (
    <div className="site-preview" aria-label={`Prévia da página ${page.name}`}>
      <img src={page.previewDataUrl} alt="" />
    </div>
  )
}

export function SiteCard({ page, onOpen, onOpenSettings }: SiteCardProps): React.JSX.Element {
  const className = page.isPlaceholder ? 'site-card site-card--placeholder' : 'site-card'

  return (
    <article
      className={className}
      tabIndex={0}
      role="button"
      aria-label={`Abrir edição de ${page.name}`}
      onClick={(event) => {
        if (!(event.target instanceof Element && event.target.closest('.card-action'))) {
          if (page.isPlaceholder) {
            event.currentTarget.focus()
          } else {
            onOpen?.(page.id)
          }
        }
      }}
      onKeyDown={(event) => {
        if (!page.isPlaceholder && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onOpen?.(page.id)
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
          <button
            className="card-action"
            type="button"
            aria-label="Configurar página"
            onClick={() => onOpenSettings?.(page.id)}
          >
            <SettingsIcon size={19} />
          </button>
        </footer>
      </div>
    </article>
  )
}
