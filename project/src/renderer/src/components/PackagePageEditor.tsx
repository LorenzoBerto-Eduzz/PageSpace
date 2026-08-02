import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PageEditorData } from '../../../shared/page-contracts'
import type { PageSpaceEditableContent } from '../../../shared/pagespace-package-contracts'
import {
  ArrowLeftIcon,
  EyeIcon,
  GlobeIcon,
  PencilIcon,
  RefreshIcon,
  SaveIcon,
  SettingsIcon
} from './icons'

type PackagePageEditorProps = {
  pageId: string
  initialPageName: string
  onBack: () => void
  onSaved: (data: PageEditorData) => void
  onOpenSettings: (pageId: string, hasUnsavedChanges: boolean) => void
}

function cloneContent(content: PageSpaceEditableContent): PageSpaceEditableContent {
  return JSON.parse(JSON.stringify(content)) as PageSpaceEditableContent
}

export function PackagePageEditor({
  pageId,
  initialPageName,
  onBack,
  onSaved,
  onOpenSettings
}: PackagePageEditorProps): React.JSX.Element {
  const [data, setData] = useState<PageEditorData | null>(null)
  const [content, setContent] = useState<PageSpaceEditableContent | null>(null)
  const [savedContent, setSavedContent] = useState<PageSpaceEditableContent | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishingUpdate, setIsPublishingUpdate] = useState(false)
  const [isRefreshingSource, setIsRefreshingSource] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(true)
  const previewFrame = useRef<HTMLIFrameElement | null>(null)

  const isDirty = useMemo(
    () => JSON.stringify(content) !== JSON.stringify(savedContent),
    [content, savedContent]
  )

  useEffect(() => {
    let current = true
    window.pageSpace
      .getPage(pageId)
      .then((loaded) => {
        if (!current) return
        setData(loaded)
        const loadedContent = loaded.kind === 'package' ? loaded.content : null
        setContent(loadedContent ? cloneContent(loadedContent) : null)
        setSavedContent(loadedContent ? cloneContent(loadedContent) : null)
        void window.pageSpace.getPagePreviewUrl(pageId).then((url) => {
          if (current) setPreviewUrl(url)
        })
      })
      .catch((loadError) => {
        if (current) {
          setError(
            loadError instanceof Error ? loadError.message : 'Não foi possível abrir a página.'
          )
        }
      })
    return () => {
      current = false
    }
  }, [pageId])

  useEffect(() => {
    async function handlePageEditorMessage(event: MessageEvent): Promise<void> {
      if (event.source !== previewFrame.current?.contentWindow) return
      const message = event.data as {
        type?: unknown
        content?: unknown
        requestId?: unknown
        source?: unknown
        url?: unknown
      } | null
      if (!message) return
      if (message.type === 'pagespace:open-link' && typeof message.url === 'string') {
        await window.pageSpace.openPageLink(message.url)
        return
      }
      if (message.type === 'pagespace:editor-content-change') {
        if (!message.content || typeof message.content !== 'object') return
        const candidate = message.content as Partial<PageSpaceEditableContent>
        if (
          candidate.schemaVersion !== 1 ||
          !candidate.values ||
          typeof candidate.values !== 'object'
        ) {
          return
        }
        setError(null)
        setContent(cloneContent(candidate as PageSpaceEditableContent))
        return
      }
      if (
        message.type !== 'pagespace:editor-image-request' ||
        typeof message.requestId !== 'string' ||
        (message.source !== 'clipboard' && message.source !== 'file')
      ) {
        return
      }
      try {
        const result =
          message.source === 'clipboard'
            ? await window.pageSpace.pastePageImage(pageId)
            : await window.pageSpace.choosePageImage(pageId)
        previewFrame.current?.contentWindow?.postMessage(
          { type: 'pagespace:editor-image-result', requestId: message.requestId, result },
          '*'
        )
      } catch (imageError) {
        previewFrame.current?.contentWindow?.postMessage(
          {
            type: 'pagespace:editor-image-result',
            requestId: message.requestId,
            error:
              imageError instanceof Error
                ? imageError.message
                : 'Não foi possível adicionar a imagem.'
          },
          '*'
        )
      }
    }
    function receivePageEditorMessage(event: MessageEvent): void {
      void handlePageEditorMessage(event)
    }
    window.addEventListener('message', receivePageEditorMessage)
    return () => window.removeEventListener('message', receivePageEditorMessage)
  }, [pageId])

  const sendPageEditorState = useCallback(
    (frame = previewFrame.current): void => {
      if (!frame?.contentWindow || !content) return
      frame.contentWindow.postMessage(
        {
          type: 'pagespace:editor-state',
          mode: isEditMode ? 'edit' : 'view',
          content: cloneContent(content)
        },
        '*'
      )
    },
    [content, isEditMode]
  )

  useEffect(() => {
    sendPageEditorState()
  }, [previewUrl, sendPageEditorState])

  async function save(): Promise<void> {
    if (!content || isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const saved = await window.pageSpace.savePackageContent({ pageId, content })
      if (!data || data.kind !== 'package' || saved.kind !== 'package' || !saved.content) {
        throw new Error('O PageSpace não retornou o conteúdo salvo.')
      }
      try {
        saved.page.previewDataUrl = await window.pageSpace.capturePagePreview(pageId)
      } catch {
        // Saving remains successful when only the replaceable dashboard image fails.
      }
      setData(saved)
      setContent(cloneContent(saved.content))
      setSavedContent(cloneContent(saved.content))
      setPreviewUrl(`${await window.pageSpace.getPagePreviewUrl(pageId)}?version=${Date.now()}`)
      onSaved(saved)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar.')
    } finally {
      setIsSaving(false)
    }
  }

  async function refreshSource(): Promise<void> {
    if (!data || isRefreshingSource) return
    if (isDirty && !window.confirm('Descartar as alterações locais e atualizar da origem?')) return
    setIsRefreshingSource(true)
    setError(null)
    try {
      await window.pageSpace.refreshPageFromSource(pageId)
      const refreshed = await window.pageSpace.getPage(pageId)
      setData(refreshed)
      const refreshedContent = refreshed.kind === 'package' ? refreshed.content : null
      setContent(refreshedContent ? cloneContent(refreshedContent) : null)
      setSavedContent(refreshedContent ? cloneContent(refreshedContent) : null)
      setPreviewUrl(`${await window.pageSpace.getPagePreviewUrl(pageId)}?version=${Date.now()}`)
      onSaved(refreshed)
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Não foi possível atualizar a página da origem.'
      )
    } finally {
      setIsRefreshingSource(false)
    }
  }

  async function publishUpdate(): Promise<void> {
    if (!data || isDirty || isPublishingUpdate) return
    setIsPublishingUpdate(true)
    setError(null)
    try {
      const published = await window.pageSpace.publishPage({ pageId })
      const updated = { ...data, page: published.page } as PageEditorData
      setData(updated)
      onSaved(updated)
    } catch (publishError) {
      try {
        const current = await window.pageSpace.getPage(pageId)
        setData(current)
        onSaved(current)
      } catch {
        // Preserve the publication error while retaining the last known editor state.
      }
      setError(
        publishError instanceof Error
          ? publishError.message
          : 'Não foi possível publicar esta atualização.'
      )
    } finally {
      setIsPublishingUpdate(false)
    }
  }

  function leave(): void {
    if (isDirty && !window.confirm('Descartar as alterações que ainda não foram salvas?')) return
    onBack()
  }

  if (!data) {
    return (
      <main className="package-editor package-editor--loading">
        <header className="package-editor-header">
          <button type="button" className="package-editor-back" onClick={onBack}>
            <ArrowLeftIcon size={20} />
            Voltar
          </button>
          <div>{initialPageName ? <h1>{initialPageName}</h1> : null}</div>
          <div />
        </header>
        <div className="package-editor-loading-surface">
          {error ? <p className="package-editor-error">{error}</p> : null}
        </div>
      </main>
    )
  }

  const isEditablePackage = data.kind === 'package' && Boolean(data.schema && content)
  const hasUnpublishedChanges =
    data.page.deployment.kind === 'published' &&
    (data.page.deployment.hasUnpublishedChanges === true ||
      Boolean(data.page.deployment.pendingCommitOid))

  return (
    <main className="package-editor">
      <header className="package-editor-header">
        <button type="button" className="package-editor-back" onClick={leave}>
          <ArrowLeftIcon size={20} />
          Voltar
        </button>
        <div>
          <h1>{data.page.name}</h1>
        </div>
        <div className="package-editor-header-actions">
          {data.page.sourceSync.state === 'update-available' ? (
            <button type="button" onClick={refreshSource} disabled={isRefreshingSource || isSaving}>
              <RefreshIcon size={18} />
              {isRefreshingSource ? 'Atualizando…' : 'Atualizar da origem'}
            </button>
          ) : null}
          {data.page.sourceSync.state === 'unavailable' ? (
            <span className="package-source-unavailable">Origem indisponível</span>
          ) : null}
          {isEditablePackage ? (
            <button
              type="button"
              className={
                isEditMode
                  ? 'package-mode-toggle package-mode-toggle--active'
                  : 'package-mode-toggle'
              }
              onClick={() => setIsEditMode((current) => !current)}
              disabled={isSaving}
            >
              {isEditMode ? <EyeIcon size={18} /> : <PencilIcon size={18} />}
              {isEditMode ? 'Visualizar' : 'Editar'}
            </button>
          ) : null}
          {hasUnpublishedChanges ? (
            <button
              type="button"
              className="package-publish-update"
              onClick={publishUpdate}
              disabled={isDirty || isSaving || isPublishingUpdate}
            >
              <GlobeIcon size={18} />
              {isPublishingUpdate ? 'Publicando…' : 'Publicar atualização'}
            </button>
          ) : data.page.deployment.kind === 'published' ? (
            <button type="button" className="package-publication-current" disabled>
              <GlobeIcon size={18} />
              Publicação atualizada
            </button>
          ) : null}
          <button type="button" onClick={() => window.pageSpace.openLocalPage(pageId)}>
            <EyeIcon size={18} />
            Ver localmente
          </button>
          <button type="button" onClick={() => onOpenSettings(pageId, isDirty)} disabled={isSaving}>
            <SettingsIcon size={18} />
            Publicação
          </button>
          {isEditablePackage && content ? (
            <button
              type="button"
              className="package-save"
              onClick={save}
              disabled={!isDirty || isSaving}
            >
              <SaveIcon size={18} />
              {isSaving ? 'Salvando…' : 'Salvar'}
            </button>
          ) : null}
        </div>
      </header>

      <div className="package-editor-layout">
        <section className="package-preview-panel" aria-label="Prévia da página">
          {previewUrl ? (
            <iframe
              ref={previewFrame}
              className="package-live-preview"
              src={previewUrl}
              title={`Visualização de ${data.page.name}`}
              sandbox="allow-scripts"
              onLoad={(event) => sendPageEditorState(event.currentTarget)}
            />
          ) : (
            <div className="package-preview-empty" aria-hidden="true" />
          )}
        </section>
      </div>
      {error ? <p className="package-editor-error package-editor-error--overlay">{error}</p> : null}
    </main>
  )
}
