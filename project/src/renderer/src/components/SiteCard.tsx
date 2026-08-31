import {
  ArrowUpIcon,
  CloudIcon,
  EyeIcon,
  LockIcon,
  RefreshIcon,
  SettingsIcon,
  WarningIcon
} from './icons'
import type { PageSource } from '../../../shared/pagespace-package-contracts'
import type { PageSourceSync } from '../../../shared/page-contracts'

export type DashboardPage = {
  id: string
  name: string
  description: string
  status: 'local' | 'published'
  preview: 'captured' | 'empty'
  previewDataUrl?: string
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
  isSynchronizingSource?: boolean
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
  isRefreshingSource,
  isSynchronizingSource
}: SiteCardProps): React.JSX.Element {
  const className = ['site-card', page.health === 'damaged' ? 'site-card--damaged' : '']
    .filter(Boolean)
    .join(' ')

  function activate(): void {
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
          activate()
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
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
          <div className="site-card-held-actions" hidden aria-hidden="true">
            {isSynchronizingSource ? (
              <span
                className="card-action card-action--synchronizing"
                role="status"
                aria-label="Atualizando página da origem"
                title="Atualizando página"
              >
                <span aria-hidden="true" />
              </span>
            ) : page.sourceSync.state === 'update-available' ? (
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
            {page.health !== 'damaged' ? (
              <button
                className="card-action"
                type="button"
                aria-label="Ver página localmente"
                onClick={() => onOpenLocal?.(page.id)}
              >
                <EyeIcon size={18} />
              </button>
            ) : null}
            {page.hasUnpublishedChanges && page.health !== 'damaged' ? (
              <span
                className="card-action card-publication-pending"
                role="status"
                aria-label="Alterações ainda não publicadas"
                title="Alterações ainda não publicadas"
              >
                <ArrowUpIcon size={19} />
              </span>
            ) : page.status === 'published' ? (
              <span
                className="card-action card-publication-current"
                aria-label="Publicação atualizada"
                title="Publicação atualizada"
                role="status"
              >
                <CloudIcon size={19} />
              </span>
            ) : (
              <button
                className="card-action"
                type="button"
                aria-label="Página somente local"
                onClick={() => {
                  if (page.health === 'damaged') onProblem?.(page.id)
                }}
              >
                <LockIcon size={18} />
              </button>
            )}
          </div>
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
