import { useEffect, useState } from 'react'
import { AddPageCard } from './components/AddPageCard'
import { AppSettingsDialog } from './components/AppSettingsDialog'
import { CreatePageDialog } from './components/CreatePageDialog'
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
  isPlaceholder: true
}

function toDashboardPage(page: PageSummary): DashboardPage {
  return {
    id: page.id,
    name: page.name,
    description: page.description || 'Sem descrição',
    status: page.status,
    preview: page.previewDataUrl ? 'captured' : 'empty',
    previewDataUrl: page.previewDataUrl,
    health: page.health
  }
}

function App(): React.JSX.Element {
  const [pages, setPages] = useState<PageSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openPageId, setOpenPageId] = useState<string | null>(null)
  const [settingsPageId, setSettingsPageId] = useState<string | null>(null)
  const [settingsHasUnsavedChanges, setSettingsHasUnsavedChanges] = useState(false)
  const [problemPageId, setProblemPageId] = useState<string | null>(null)
  const [isRecovering, setIsRecovering] = useState(false)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false)

  useEffect(() => {
    let isCurrent = true

    window.pageMaker
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

  async function createPage(input: CreatePageInput): Promise<void> {
    if (!input.name.trim()) {
      setError('Informe o nome da página.')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const createdPage = await window.pageMaker.createPage(input)
      setPages((currentPages) => [...currentPages, createdPage])
      setIsCreateDialogOpen(false)
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : 'Não foi possível criar a página.'
      )
    } finally {
      setIsCreating(false)
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

  async function recoverPage(): Promise<void> {
    if (!problemPage || isRecovering) return
    setIsRecovering(true)
    setRecoveryError(null)
    try {
      const recoveredPage = await window.pageMaker.recoverPage(problemPage.id)
      try {
        recoveredPage.previewDataUrl = await window.pageMaker.capturePagePreview(recoveredPage.id)
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
    return (
      <>
        <PageEditor
          pageId={openPageId}
          onBack={() => setOpenPageId(null)}
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
          {error && !isCreateDialogOpen ? <p className="dashboard-error">{error}</p> : null}
          <div className="pages-grid">
            {displayedPages.map((page) => (
              <SiteCard
                key={page.id}
                page={page}
                onOpen={setOpenPageId}
                onOpenSettings={
                  page.isPlaceholder
                    ? undefined
                    : (pageId) => {
                        setSettingsHasUnsavedChanges(false)
                        setSettingsPageId(pageId)
                      }
                }
                onProblem={setProblemPageId}
              />
            ))}
            <AddPageCard onClick={() => setIsCreateDialogOpen(true)} disabled={isLoading} />
          </div>
        </section>
      </div>

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
