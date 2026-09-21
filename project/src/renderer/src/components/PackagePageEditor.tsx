import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  GitHubDeviceAuthorization,
  PageEditorData,
  PageSummary
} from '../../../shared/page-contracts'
import type { PageSpaceEditableContent } from '../../../shared/pagespace-package-contracts'
import {
  ArrowLeftIcon,
  CheckIcon,
  CloudCheckIcon,
  CloudUploadIcon,
  ExternalLinkIcon,
  EyeIcon,
  PencilIcon,
  RefreshIcon,
  SaveIcon,
  SettingsIcon
} from './icons'
import { ModalCloseButton } from './ModalCloseButton'

type PackagePageEditorProps = {
  pageId: string
  page: PageSummary
  onBack: () => void
  onSaved: (data: PageEditorData) => void
  onOpenSettings: (pageId: string, hasUnsavedChanges: boolean) => void
}

function cloneContent(content: PageSpaceEditableContent): PageSpaceEditableContent {
  return JSON.parse(JSON.stringify(content)) as PageSpaceEditableContent
}

export function PackagePageEditor({
  pageId,
  page,
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
  const [isExtensionInfoOpen, setIsExtensionInfoOpen] = useState(false)
  const [isPublishGitHubOpen, setIsPublishGitHubOpen] = useState(false)
  const [githubAuthorization, setGitHubAuthorization] = useState<GitHubDeviceAuthorization | null>(
    null
  )
  const [isLinkingGitHub, setIsLinkingGitHub] = useState(false)
  const [githubLinkError, setGitHubLinkError] = useState<string | null>(null)
  const linkAttemptId = useRef(0)
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

  async function openPublishFlow(): Promise<void> {
    if (isPublishingUpdate) return
    try {
      const status = await window.pageSpace.getGitHubStatus()
      if (status.state === 'connected') {
        await publishUpdate()
        return
      }
    } catch {
      // The publish action will surface the normal publish error if status lookup fails.
    }
    setGitHubLinkError(null)
    setGitHubAuthorization(null)
    setIsPublishGitHubOpen(true)
  }

  async function beginPublishGitHubLink(): Promise<void> {
    if (isLinkingGitHub) return
    const attemptId = linkAttemptId.current + 1
    linkAttemptId.current = attemptId
    setGitHubLinkError(null)
    setGitHubAuthorization(null)
    setIsLinkingGitHub(true)
    try {
      const authorization = await window.pageSpace.beginGitHubLink()
      if (linkAttemptId.current !== attemptId) {
        await window.pageSpace.cancelGitHubLink(authorization.flowId)
        return
      }
      setGitHubAuthorization(authorization)
      await window.pageSpace.completeGitHubLink(authorization.flowId)
      if (linkAttemptId.current !== attemptId) return
      setGitHubAuthorization(null)
      setIsPublishGitHubOpen(false)
      await publishUpdate()
    } catch (linkError) {
      if (linkAttemptId.current === attemptId) {
        setGitHubAuthorization(null)
        setGitHubLinkError(
          linkError instanceof Error
            ? linkError.message
            : 'Não foi possível vincular a conta GitHub.'
        )
      }
    } finally {
      if (linkAttemptId.current === attemptId) setIsLinkingGitHub(false)
    }
  }

  async function cancelPublishGitHubLink(): Promise<void> {
    linkAttemptId.current += 1
    const activeAuthorization = githubAuthorization
    setGitHubAuthorization(null)
    setIsLinkingGitHub(false)
    if (activeAuthorization) await window.pageSpace.cancelGitHubLink(activeAuthorization.flowId)
  }

  function leave(): void {
    if (isDirty && !window.confirm('Descartar as alterações que ainda não foram salvas?')) return
    onBack()
  }

  if (!data) {
    return (
      <main className="package-editor package-editor--loading">
        <header className="package-editor-header">
          <button
            type="button"
            className="package-editor-back"
            aria-label="Voltar"
            title="Voltar"
            onClick={onBack}
          >
            <ArrowLeftIcon size={24} />
          </button>
          <div>{page.name ? <h1>{page.name}</h1> : null}</div>
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
    page.deployment.kind === 'published' &&
    (page.deployment.hasUnpublishedChanges === true || Boolean(page.deployment.pendingCommitOid))
  const publishedUrl = page.deployment.kind === 'published' ? page.deployment.publicUrl : null

  return (
    <main className="package-editor">
      <header className="package-editor-header">
        <button
          type="button"
          className="package-editor-back"
          aria-label="Voltar"
          title="Voltar"
          onClick={leave}
        >
          <ArrowLeftIcon size={24} />
        </button>
        <div>
          <h1>{page.name}</h1>
        </div>
        <div className="package-editor-header-actions">
          {page.sourceSync.state === 'update-available' ? (
            <button
              className="package-source-refresh-action"
              type="button"
              onClick={refreshSource}
              disabled={isRefreshingSource || isSaving}
            >
              <RefreshIcon size={18} />
              {isRefreshingSource ? 'Atualizando…' : 'Atualizar da origem'}
            </button>
          ) : null}
          {page.sourceSync.state === 'unavailable' ? (
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
              {isEditMode ? <EyeIcon size={22} /> : <PencilIcon size={22} />}
              {isEditMode ? 'Visualizar página' : 'Editar página'}
            </button>
          ) : (
            <button
              type="button"
              className="package-extension-info-button"
              onClick={() => setIsExtensionInfoOpen(true)}
            >
              Página sem edição
            </button>
          )}
          {hasUnpublishedChanges ? (
            <button
              type="button"
              className="package-publish-update"
              onClick={openPublishFlow}
              disabled={isDirty || isSaving || isPublishingUpdate}
            >
              <CloudUploadIcon size={24} />
              {isPublishingUpdate ? 'Publicando…' : 'Atualizar página'}
            </button>
          ) : page.deployment.kind === 'published' ? (
            <button type="button" className="package-publication-current" disabled>
              <CloudCheckIcon size={24} />
              Página atualizada
            </button>
          ) : (
            <button
              type="button"
              className="package-publish-update"
              onClick={openPublishFlow}
              disabled={isDirty || isSaving || isPublishingUpdate}
            >
              <CloudUploadIcon size={24} />
              {isPublishingUpdate ? 'Publicando…' : 'Publicar página'}
            </button>
          )}
          <button
            className="package-local-open-action"
            type="button"
            onClick={() => window.pageSpace.openLocalPage(pageId)}
          >
            <EyeIcon size={18} />
            Ver localmente
          </button>
          {publishedUrl ? (
            <button
              className="package-public-link-button"
              type="button"
              aria-label="Abrir página publicada"
              title="Abrir página publicada"
              onClick={() => void window.pageSpace.openPageLink(publishedUrl)}
            >
              <ExternalLinkIcon size={24} />
            </button>
          ) : null}
          <button
            className="package-page-settings-button"
            type="button"
            aria-label="Configurações da página"
            title="Configurações da página"
            onClick={() => onOpenSettings(pageId, isDirty)}
            disabled={isSaving}
          >
            <SettingsIcon size={24} />
          </button>
          {isEditablePackage && content ? (
            <button
              type="button"
              className="package-save"
              onClick={save}
              disabled={!isDirty || isSaving}
            >
              {isDirty || isSaving ? (
                <SaveIcon size={22} />
              ) : (
                <CheckIcon size={22} strokeWidth={2.2} />
              )}
              {isSaving ? 'Salvando…' : isDirty ? 'Salvar edições' : 'Edições salvas'}
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
              title={`Visualização de ${page.name}`}
              sandbox="allow-scripts"
              onLoad={(event) => sendPageEditorState(event.currentTarget)}
            />
          ) : (
            <div className="package-preview-empty" aria-hidden="true" />
          )}
        </section>
      </div>
      {error ? <p className="package-editor-error package-editor-error--overlay">{error}</p> : null}
      {isExtensionInfoOpen ? (
        <div className="package-extension-info-backdrop" role="presentation">
          <section
            className="package-extension-info-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="package-extension-info-title"
          >
            <header>
              <h2 id="package-extension-info-title">Página sem edição</h2>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setIsExtensionInfoOpen(false)}
              >
                ×
              </button>
            </header>
            <p>
              Esta página não possui o módulo necessário para edição no PageSpace. Siga as
              instruções para habilitar esse recurso.
            </p>
            <button
              type="button"
              onClick={() => {
                void window.pageSpace.downloadAiInstructions()
              }}
            >
              Baixar .txt
            </button>
          </section>
        </div>
      ) : null}
      {isPublishGitHubOpen ? (
        <div
          className="dialog-backdrop app-settings-backdrop package-extension-info-backdrop"
          role="presentation"
        >
          <section
            className="app-settings-dialog package-publish-github-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="package-publish-github-title"
          >
            <header>
              <h2 id="package-publish-github-title">Publicar página</h2>
              <ModalCloseButton
                onClick={() => {
                  void cancelPublishGitHubLink()
                  setIsPublishGitHubOpen(false)
                }}
              />
            </header>
            <div className="github-disconnected-layout">
              <p className="github-section-description">
                <span>Vincule sua conta GitHub para publicar suas páginas.</span>
                <span>Será criado um repositório para cada uma postada.</span>
              </p>
              <button
                className="github-account-action github-account-link"
                type="button"
                disabled={isLinkingGitHub}
                onClick={() => void beginPublishGitHubLink()}
              >
                {githubAuthorization ? 'Aguardando autorização…' : 'Vincular conta'}
              </button>
            </div>
            {githubAuthorization ? (
              <div className="github-device-flow">
                <div className="github-device-code-row">
                  <p>Copie o código e cole-o na página aberta do GitHub.</p>
                  <button
                    className="github-device-code"
                    type="button"
                    title="Copiar código"
                    onClick={() =>
                      void window.pageSpace.copyGitHubCode(githubAuthorization.userCode)
                    }
                  >
                    {githubAuthorization.userCode}
                  </button>
                </div>
                <button
                  className="github-cancel-link"
                  type="button"
                  onClick={() => void cancelPublishGitHubLink()}
                >
                  Cancelar vinculação
                </button>
              </div>
            ) : null}
            {githubLinkError ? <p className="dialog-error">{githubLinkError}</p> : null}
          </section>
        </div>
      ) : null}
    </main>
  )
}
