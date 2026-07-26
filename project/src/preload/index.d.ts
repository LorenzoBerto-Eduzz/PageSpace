import type { CreatePageInput, PageSummary } from '../shared/page-contracts'

declare global {
  interface Window {
    pageMaker: Readonly<{
      listPages: () => Promise<PageSummary[]>
      createPage: (input: CreatePageInput) => Promise<PageSummary>
    }>
  }
}
