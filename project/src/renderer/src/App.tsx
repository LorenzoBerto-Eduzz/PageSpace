import { useEffect, useState } from 'react'
import { AddPageCard } from './components/AddPageCard'
import { CreatePageDialog } from './components/CreatePageDialog'
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
    preview: 'empty'
  }
}

function App(): React.JSX.Element {
  const [pages, setPages] = useState<PageSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setPages((currentPages) => [createdPage, ...currentPages])
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <h1 id="pages-heading">Minhas Páginas</h1>
        <button
          className="icon-button global-settings"
          type="button"
          aria-label="Configurações gerais"
        >
          <SettingsIcon size={26} />
        </button>
      </header>

      <div className="dashboard-scroll-area">
        <section className="dashboard" aria-labelledby="pages-heading">
          {error && !isCreateDialogOpen ? <p className="dashboard-error">{error}</p> : null}
          <div className="pages-grid">
            {displayedPages.map((page) => (
              <SiteCard key={page.id} page={page} />
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
    </main>
  )
}

export default App
