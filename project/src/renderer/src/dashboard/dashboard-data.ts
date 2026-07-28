import type { DashboardPage } from '../components/SiteCard'

// Temporary empty-state cards used only to establish the dashboard layout.
export const dashboardPages: DashboardPage[] = [
  {
    id: 'template-page',
    name: 'Nome da página',
    description: 'Descrição da página',
    status: 'local',
    preview: 'empty',
    isPlaceholder: true,
    source: { kind: 'simple' }
  }
]
