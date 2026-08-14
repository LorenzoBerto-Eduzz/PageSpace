import { useCallback, useEffect, useRef, useState } from 'react'
import { AddPageCard } from './components/AddPageCard'
import { AppSettingsDialog } from './components/AppSettingsDialog'
import { PackagePageEditor } from './components/PackagePageEditor'
import { PageRecoveryDialog } from './components/PageRecoveryDialog'
import { PageSettingsDialog } from './components/PageSettingsDialog'
import { SettingsIcon } from './components/icons'
import { SiteCard } from './components/SiteCard'
import type { DashboardPage } from './components/SiteCard'
import type { PageSummary } from '../../shared/page-contracts'

function toDashboardPage(page: PageSummary): DashboardPage {
  return {
    id: page.id,
    name: page.name,
    description: page.description || 'Adicionar descrição',
    status: page.status,
    preview: page.previewDataUrl ? 'captured' : 'empty',
    previewDataUrl: page.previewDataUrl,
    health: page.health,
    source: page.source,
    sourceSync: page.sourceSync,
    hasUnpublishedChanges:
      page.deployment.kind === 'published' &&
      (page.deployment.hasUnpublishedChanges === true || Boolean(page.deployment.pendingCommitOid))
  }
}

function App(): React.JSX.Element {
  const [pages, setPages] = useState<PageSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [openPageId, setOpenPageId] = useState<string | null>(null)
  const [settingsPageId, setSettingsPageId] = useState<string | null>(null)
  const [settingsHasUnsavedChanges, setSettingsHasUnsavedChanges] = useState(false)
  const [problemPageId, setProblemPageId] = useState<string | null>(null)
  const [isRecovering, setIsRecovering] = useState(false)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false)
  const [refreshingSourceId, setRefreshingSourceId] = useState<string | null>(null)
  const [synchronizingSourceIds, setSynchronizingSourceIds] = useState<Set<string>>(new Set())
  const synchronizationInProgress = useRef<Promise<PageSummary[]> | null>(null)

  const synchronizePageSources = useCallback((): Promise<PageSummary[]> => {
    if (!synchronizationInProgress.current) {
      synchronizationInProgress.current = window.pageSpace.synchronizePageSources().finally(() => {
        synchronizationInProgress.current = null
      })
    }
    return synchronizationInProgress.current
  }, [])

  const synchronizePageSourcesWithProgress = useCallback(
    async (detectedPages?: PageSummary[]): Promise<PageSummary[]> => {
      const currentPages = detectedPages ?? (await window.pageSpace.listPages())
      const updatingIds = currentPages
        .filter((page) => page.sourceSync.state === 'update-available')
        .map((page) => page.id)
      if (updatingIds.length > 0) {
        setSynchronizingSourceIds((current) => new Set([...current, ...updatingIds]))
      }
      try {
        return await synchronizePageSources()
      } finally {
        if (updatingIds.length > 0) {
          setSynchronizingSourceIds((current) => {
            const next = new Set(current)
            updatingIds.forEach((pageId) => next.delete(pageId))
            return next
          })
        }
      }
    },
    [synchronizePageSources]
  )

  useEffect(() => {
    let isCurrent = true

    const loadPages = async (): Promise<void> => {
      try {
        const loadedPages = await window.pageSpace.listPages()
        if (!isCurrent) return
        setPages(loadedPages)
        setIsLoading(false)

        const synchronizedPages = await synchronizePageSourcesWithProgress(loadedPages)
        if (!isCurrent) return
        setPages(synchronizedPages)
      } catch {
        if (isCurrent) {
          setIsLoading(false)
          window.alert('Não foi possível carregar as páginas locais.')
        }
      }
    }

    void loadPages()

    return () => {
      isCurrent = false
    }
  }, [synchronizePageSourcesWithProgress])

  useEffect(() => {
    let active = true
    const refreshStatuses = (): void => {
      synchronizePageSourcesWithProgress()
        .then((nextPages) => {
          if (active) setPages(nextPages)
        })
        .catch(() => undefined)
    }
    window.addEventListener('focus', refreshStatuses)
    return () => {
      active = false
      window.removeEventListener('focus', refreshStatuses)
    }
  }, [synchronizePageSourcesWithProgress])

  async function importPage(): Promise<void> {
    if (isImporting) return
    setIsImporting(true)
    try {
      const result = await window.pageSpace.importPage()
      if (!result) return
      setPages((currentPages) => [
        result.page,
        ...currentPages.filter((page) => page.id !== result.page.id)
      ])
    } catch (importError) {
      const message =
        importError instanceof Error
          ? importError.message
          : 'Não foi possível trazer a página para o PageSpace.'
      window.alert(message)
    } finally {
      setIsImporting(false)
    }
  }

  const displayedPages = pages.map(toDashboardPage)
  const settingsPage = pages.find((page) => page.id === settingsPageId)
  const problemPage = pages.find((page) => page.id === problemPageId)

  function updatePage(updatedPage: PageSummary): void {
    setPages((currentPages) =>
      currentPages.map((page) => (page.id === updatedPage.id ? updatedPage : page))
    )
  }

  function deletePage(pageId: string): void {
    setPages((currentPages) => currentPages.filter((page) => page.id !== pageId))
    if (openPageId === pageId) setOpenPageId(null)
    if (settingsPageId === pageId) setSettingsPageId(null)
  }

  async function refreshPageSource(pageId: string): Promise<void> {
    if (refreshingSourceId) return
    setRefreshingSourceId(pageId)
    try {
      const updated = await window.pageSpace.refreshPageFromSource(pageId)
      updatePage(updated)
    } catch (refreshError) {
      try {
        updatePage((await window.pageSpace.getPage(pageId)).page)
      } catch {
        // Keep the last known card state if publication-state recovery also fails.
      }
      window.alert(
        refreshError instanceof Error
          ? refreshError.message
          : 'Não foi possível atualizar a página da origem.'
      )
    } finally {
      setRefreshingSourceId(null)
    }
  }

  function closeEditor(): void {
    setOpenPageId(null)
    synchronizePageSources()
      .then(setPages)
      .catch(() => undefined)
  }

  function openPage(pageId: string): void {
    setOpenPageId(pageId)
  }

  async function recoverPage(): Promise<void> {
    if (!problemPage || isRecovering) return
    setIsRecovering(true)
    setRecoveryError(null)
    try {
      const recoveredPage = await window.pageSpace.recoverPage(problemPage.id)
      try {
        recoveredPage.previewDataUrl = await window.pageSpace.capturePagePreview(recoveredPage.id)
      } catch {
        // The recovered editable page remains valid if its replaceable preview cannot be rebuilt.
      }
      updatePage(recoveredPage)
      setProblemPageId(null)
    } catch (recoverError) {
      setRecoveryError(
        recoverError instanceof Error
          ? recoverError.message
          : 'Não foi possível recuperar a página.'
      )
    } finally {
      setIsRecovering(false)
    }
  }

  if (openPageId) {
    const openPage = pages.find((page) => page.id === openPageId)
    if (!openPage) return <main className="app-shell" />
    const editor = (
      <PackagePageEditor
        pageId={openPageId}
        page={openPage}
        onBack={closeEditor}
        onOpenSettings={(pageId, hasUnsavedChanges) => {
          setSettingsHasUnsavedChanges(hasUnsavedChanges)
          setSettingsPageId(pageId)
        }}
        onSaved={(savedPage) => {
          setPages((currentPages) => [
            savedPage.page,
            ...currentPages.filter((page) => page.id !== savedPage.page.id)
          ])
        }}
      />
    )
    return (
      <>
        {editor}
        {settingsPage ? (
          <PageSettingsDialog
            page={settingsPage}
            onClose={() => setSettingsPageId(null)}
            onUpdated={updatePage}
            onDeleted={deletePage}
            hasUnsavedChanges={settingsHasUnsavedChanges}
          />
        ) : null}
      </>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <h1 id="pages-heading">Minhas Páginas</h1>
        <button
          className="icon-button global-settings"
          type="button"
          aria-label="Configurações gerais"
          onClick={() => setIsAppSettingsOpen(true)}
        >
          <SettingsIcon size={26} />
        </button>
      </header>

      <div className="dashboard-scroll-area">
        <section className="dashboard" aria-labelledby="pages-heading">
          <div className="pages-grid">
            {displayedPages.map((page) => (
              <SiteCard
                key={page.id}
                page={page}
                onRefreshSource={refreshPageSource}
                isRefreshingSource={refreshingSourceId === page.id}
                isSynchronizingSource={
                  synchronizingSourceIds.has(page.id) || refreshingSourceId === page.id
                }
                onOpen={openPage}
                onOpenSettings={(pageId) => {
                  setSettingsHasUnsavedChanges(false)
                  setSettingsPageId(pageId)
                }}
                onOpenLocal={(pageId) => {
                  void window.pageSpace.openLocalPage(pageId).catch((openError) => {
                    window.alert(
                      openError instanceof Error
                        ? openError.message
                        : 'Não foi possível abrir a página local.'
                    )
                  })
                }}
                onProblem={setProblemPageId}
              />
            ))}
            <AddPageCard
              onClick={() => void importPage()}
              disabled={isLoading || isImporting}
              isImporting={isImporting}
            />
          </div>
        </section>
      </div>

      {settingsPage ? (
        <PageSettingsDialog
          page={settingsPage}
          onClose={() => setSettingsPageId(null)}
          onUpdated={updatePage}
          onDeleted={deletePage}
          hasUnsavedChanges={settingsHasUnsavedChanges}
        />
      ) : null}
      {problemPage ? (
        <PageRecoveryDialog
          page={problemPage}
          isRecovering={isRecovering}
          error={recoveryError}
          onClose={() => {
            setRecoveryError(null)
            setProblemPageId(null)
          }}
          onRecover={recoverPage}
        />
      ) : null}
      {isAppSettingsOpen ? (
        <AppSettingsDialog
          initialPages={pages}
          onClose={() => setIsAppSettingsOpen(false)}
          onPagesRefreshed={setPages}
          onOpenProblem={setProblemPageId}
        />
      ) : null}
    </main>
  )
}

export default App
