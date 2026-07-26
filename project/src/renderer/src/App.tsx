import { AddPageCard } from './components/AddPageCard'
import { SettingsIcon } from './components/icons'
import { SiteCard } from './components/SiteCard'
import { dashboardPages } from './dashboard/dashboard-data'

function App(): React.JSX.Element {
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
          <div className="pages-grid">
            {dashboardPages.map((page) => (
              <SiteCard key={page.id} page={page} />
            ))}
            <AddPageCard />
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
