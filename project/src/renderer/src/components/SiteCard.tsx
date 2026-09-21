import {
  CloudCheckIcon,
  CloudUploadIcon,
  ExternalLinkIcon,
  FolderCheckIcon,
  FolderWarningIcon,
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
  publicUrl?: string
}

type SiteCardProps = {
  page: DashboardPage
  onOpen?: (pageId: string) => void
  onOpenSettings?: (pageId: string) => void
  onOpenLocal?: (pageId: string) => void
  onProblem?: (pageId: string) => void
  onRefreshSource?: (pageId: string) => void
  onPublish?: (pageId: string) => void
  isRefreshingSource?: boolean
  isSynchronizingSource?: boolean
  isPublishing?: boolean
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
  onPublish,
  isRefreshingSource,
  isSynchronizingSource,
  isPublishing
}: SiteCardProps): React.JSX.Element {
  const className = ['site-card', page.health === 'damaged' ? 'site-card--damaged' : '']
    .filter(Boolean)
    .join(' ')

  function activate(): void {
    if (isSynchronizingSource) return
    if (page.health === 'damaged') onProblem?.(page.id)
    else onOpen?.(page.id)
  }

  return (
    <article
      className={`${className}${isSynchronizingSource ? ' site-card--synchronizing' : ''}`}
      tabIndex={isSynchronizingSource ? -1 : 0}
      role="button"
      aria-disabled={isSynchronizingSource}
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
            {page.health !== 'damaged' ? (
              page.status === 'published' && !page.hasUnpublishedChanges && page.publicUrl ? (
                <button
                  className="card-action card-publication-current card-publication-current-link"
                  type="button"
                  aria-label="Abrir página publicada"
                  title="Abrir página publicada"
                  disabled={isSynchronizingSource || isPublishing}
                  onClick={() => void window.pageSpace.openPageLink(page.publicUrl as string)}
                >
                  <span className="card-publication-icon card-publication-icon--current">
                    <CloudCheckIcon size={30} />
                  </span>
                  <span className="card-publication-icon card-publication-icon--hover">
                    <ExternalLinkIcon size={25} />
                  </span>
                </button>
              ) : (
                <button
                  className="card-action card-publication-pending"
                  type="button"
                  aria-label={page.status === 'published' ? 'Atualizar página' : 'Publicar página'}
                  title={page.status === 'published' ? 'Atualizar página' : 'Publicar página'}
                  disabled={isSynchronizingSource || isPublishing}
                  onClick={() => onPublish?.(page.id)}
                >
                  <CloudUploadIcon size={30} />
                </button>
              )
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
          {page.health !== 'damaged' ? (
            page.status === 'published' && !page.hasUnpublishedChanges && page.publicUrl ? (
              <button
                className="card-action card-publication-current card-publication-current-link"
                type="button"
                aria-label="Abrir página publicada"
                title="Abrir página publicada"
                disabled={isSynchronizingSource || isPublishing}
                onClick={() => void window.pageSpace.openPageLink(page.publicUrl as string)}
              >
                <span className="card-publication-icon card-publication-icon--current">
                  <CloudCheckIcon size={21} />
                </span>
                <span className="card-publication-icon card-publication-icon--hover">
                  <ExternalLinkIcon size={21} />
                </span>
              </button>
            ) : (
              <button
                className="card-action card-publication-pending"
                type="button"
                aria-label={page.status === 'published' ? 'Atualizar página' : 'Publicar página'}
                title={page.status === 'published' ? 'Atualizar página' : 'Publicar página'}
                disabled={isSynchronizingSource || isPublishing}
                onClick={() => onPublish?.(page.id)}
              >
                <CloudUploadIcon size={21} />
              </button>
            )
          ) : null}
          {isSynchronizingSource ? (
            <span
              className="card-action card-action--synchronizing"
              role="status"
              aria-label="Verificando a origem da página"
              title="Verificando origem"
            >
              <span aria-hidden="true" />
            </span>
          ) : page.source.kind === 'simple' ||
            page.sourceSync.state === 'unavailable' ||
            page.sourceSync.state === 'unlinked' ? (
            <button
              className="card-action card-origin-status card-origin-status--warning"
              type="button"
              aria-label="Origem da página indisponível"
              title="Origem indisponível"
              onClick={() => onOpenSettings?.(page.id)}
            >
              <FolderWarningIcon size={20} />
            </button>
          ) : (
            <button
              className="card-action card-origin-status"
              type="button"
              aria-label="Atualizado com Origem"
              title="Atualizado com Origem"
              onClick={() => void window.pageSpace.openPageSourceFolder(page.id)}
            >
              <FolderCheckIcon size={20} />
            </button>
          )}
          <button
            className="card-action card-settings-action"
            type="button"
            aria-label="Configurar página"
            disabled={isSynchronizingSource}
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
