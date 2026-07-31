import { EyeIcon, GlobeIcon, LockIcon, RefreshIcon, SettingsIcon, WarningIcon } from './icons'
import type { PageSource } from '../../../shared/pagespace-package-contracts'
import type { PageSourceSync } from '../../../shared/page-contracts'

export type DashboardPage = {
  id: string
  name: string
  description: string
  status: 'local' | 'published'
  preview: 'captured' | 'empty'
  previewDataUrl?: string
  isPlaceholder?: boolean
  health?: 'healthy' | 'damaged'
  source: PageSource
  sourceSync: PageSourceSync
  hasUnpublishedChanges?: boolean
}

type SiteCardProps = {
  page: DashboardPage
  onOpen?: (pageId: string) => void
  onOpenSettings?: (pageId: string) => void
  onOpenLocal?: (pageId: string) => void
  onProblem?: (pageId: string) => void
  onRefreshSource?: (pageId: string) => void
  isRefreshingSource?: boolean
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

export function SiteCard({
  page,
  onOpen,
  onOpenSettings,
  onOpenLocal,
  onProblem,
  onRefreshSource,
  isRefreshingSource
}: SiteCardProps): React.JSX.Element {
  const className = [
    'site-card',
    page.isPlaceholder ? 'site-card--placeholder' : '',
    page.health === 'damaged' ? 'site-card--damaged' : ''
  ]
    .filter(Boolean)
    .join(' ')

  function activate(): void {
    if (page.isPlaceholder) return
    if (page.health === 'damaged') onProblem?.(page.id)
    else onOpen?.(page.id)
  }

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
            activate()
          }
        }
      }}
      onKeyDown={(event) => {
        if (!page.isPlaceholder && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          activate()
        }
      }}
    >
      <PreviewCanvas page={page} />

      <div className="site-card-content">
        <h2>{page.name}</h2>
        <p className="site-description">{page.description}</p>

        <footer className="site-card-actions">
          {page.sourceSync.state === 'update-available' ? (
            <button
              className="card-action card-action--refresh"
              type="button"
              aria-label={
                page.status === 'published'
                  ? 'Atualizar página da origem e publicar'
                  : 'Atualizar página da origem'
              }
              title={
                page.status === 'published' ? 'Atualizar e publicar' : 'Atualização disponível'
              }
              disabled={isRefreshingSource}
              onClick={() => onRefreshSource?.(page.id)}
            >
              <RefreshIcon size={19} />
            </button>
          ) : null}
          {page.sourceSync.state === 'unavailable' ? (
            <span
              className="card-action card-action--source-warning"
              title="Pasta de origem indisponível"
            >
              <WarningIcon size={18} />
            </span>
          ) : null}
          {page.health === 'damaged' ? (
            <button
              className="card-action card-action--warning"
              type="button"
              aria-label="Página com problema"
              onClick={() => onProblem?.(page.id)}
            >
              <WarningIcon size={19} />
            </button>
          ) : null}
          {!page.isPlaceholder && page.health !== 'damaged' ? (
            <button
              className="card-action"
              type="button"
              aria-label="Ver página localmente"
              onClick={() => onOpenLocal?.(page.id)}
            >
              <EyeIcon size={18} />
            </button>
          ) : null}
          <button
            className={`card-action${page.hasUnpublishedChanges ? ' card-action--unpublished' : ''}`}
            type="button"
            aria-label={
              page.hasUnpublishedChanges
                ? 'Alterações ainda não publicadas'
                : page.status === 'published'
                  ? 'Página publicada e atualizada'
                  : 'Página somente local'
            }
            onClick={() => {
              if (page.health === 'damaged') onProblem?.(page.id)
              else if (page.hasUnpublishedChanges) onOpenSettings?.(page.id)
            }}
          >
            {page.status === 'published' ? <GlobeIcon size={18} /> : <LockIcon size={18} />}
          </button>
          <button
            className="card-action"
            type="button"
            aria-label="Configurar página"
            onClick={() =>
              page.health === 'damaged' ? onProblem?.(page.id) : onOpenSettings?.(page.id)
            }
          >
            <SettingsIcon size={19} />
          </button>
        </footer>
      </div>
    </article>
  )
}
