import { useEffect, useState } from 'react'
import { AddPageCard } from './components/AddPageCard'
import { AddPageDialog } from './components/AddPageDialog'
import { AppSettingsDialog } from './components/AppSettingsDialog'
import { CreatePageDialog } from './components/CreatePageDialog'
import { PackagePageEditor } from './components/PackagePageEditor'
import { PageEditor } from './components/PageEditor'
import { PageRecoveryDialog } from './components/PageRecoveryDialog'
import { PageSettingsDialog } from './components/PageSettingsDialog'
import { SettingsIcon } from './components/icons'
import { SiteCard } from './components/SiteCard'
import type { DashboardPage } from './components/SiteCard'
import type { CreatePageInput, PageSummary } from '../../shared/page-contracts'

const placeholderPage: DashboardPage = {
  id: 'template-page',
  name: 'Nome da página',
  description: 'Descrição da página',
  status: 'local',
  preview: 'empty',
  isPlaceholder: true,
  source: { kind: 'simple' },
  sourceSync: { state: 'not-applicable' }
}

function toDashboardPage(page: PageSummary): DashboardPage {
  return {
    id: page.id,
    name: page.name,
    description: page.description || 'Sem descrição',
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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openPageId, setOpenPageId] = useState<string | null>(null)
  const [settingsPageId, setSettingsPageId] = useState<string | null>(null)
  const [settingsHasUnsavedChanges, setSettingsHasUnsavedChanges] = useState(false)
  const [problemPageId, setProblemPageId] = useState<string | null>(null)
  const [isRecovering, setIsRecovering] = useState(false)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false)
  const [refreshingSourceId, setRefreshingSourceId] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true

    window.pageSpace
      .listPages()
      .then((loadedPages) => {
        if (isCurrent) setPages(loadedPages)
      })
      .catch(() => {
        if (isCurrent) setError('Não foi possível carregar as páginas locais.')
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const refreshStatuses = (): void => {
      window.pageSpace
        .listPages()
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
  }, [])

  async function createPage(input: CreatePageInput): Promise<void> {
    if (!input.name.trim()) {
      setError('Informe o nome da página.')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const createdPage = await window.pageSpace.createPage(input)
      setPages((currentPages) => [...currentPages, createdPage])
      setIsCreateDialogOpen(false)
      setIsAddDialogOpen(false)
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : 'Não foi possível criar a página.'
      )
    } finally {
      setIsCreating(false)
    }
  }

  async function importPage(): Promise<void> {
    if (isImporting) return
    setIsImporting(true)
    setError(null)
    try {
      const result = await window.pageSpace.importPage()
      if (!result) return
      setPages((currentPages) => [
        result.page,
        ...currentPages.filter((page) => page.id !== result.page.id)
      ])
      setIsAddDialogOpen(false)
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : 'Não foi possível trazer a página para o PageSpace.'
      )
    } finally {
      setIsImporting(false)
    }
  }

  const displayedPages = pages.length > 0 ? pages.map(toDashboardPage) : [placeholderPage]
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
      const existing = pages.find((page) => page.id === pageId)
      let updated = await window.pageSpace.refreshPageFromSource(pageId)
      if (existing?.deployment.kind === 'published') {
        updated = (await window.pageSpace.publishPage({ pageId })).page
      }
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
    window.pageSpace
      .listPages()
      .then(setPages)
      .catch(() => undefined)
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
    const editor =
      openPage?.source.kind !== 'simple' ? (
        <PackagePageEditor
          pageId={openPageId}
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
      ) : (
        <PageEditor
          pageId={openPageId}
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
                onOpen={setOpenPageId}
                onOpenSettings={
                  page.isPlaceholder
                    ? undefined
                    : (pageId) => {
                        setSettingsHasUnsavedChanges(false)
                        setSettingsPageId(pageId)
                      }
                }
                onOpenLocal={(pageId) => {
                  void window.pageSpace.openLocalPage(pageId).catch((openError) => {
                    setError(
                      openError instanceof Error
                        ? openError.message
                        : 'Não foi possível abrir a página local.'
                    )
                  })
                }}
                onProblem={setProblemPageId}
              />
            ))}
            <AddPageCard onClick={() => setIsAddDialogOpen(true)} disabled={isLoading} />
          </div>
        </section>
      </div>

      {isAddDialogOpen ? (
        <AddPageDialog
          isImporting={isImporting}
          error={error}
          onClose={() => {
            setError(null)
            setIsAddDialogOpen(false)
          }}
          onCreateSimple={() => {
            setError(null)
            setIsAddDialogOpen(false)
            setIsCreateDialogOpen(true)
          }}
          onImport={importPage}
        />
      ) : null}
      {isCreateDialogOpen ? (
        <CreatePageDialog
          isSaving={isCreating}
          error={error}
          onClose={() => {
            setError(null)
            setIsCreateDialogOpen(false)
          }}
          onCreate={createPage}
        />
      ) : null}
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
