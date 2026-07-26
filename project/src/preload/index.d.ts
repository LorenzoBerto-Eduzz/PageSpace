import type {
  CreatePageInput,
  PageEditorData,
  PageSummary,
  SavePageContentInput
} from '../shared/page-contracts'

declare global {
  interface Window {
    pageMaker: Readonly<{
      listPages: () => Promise<PageSummary[]>
      createPage: (input: CreatePageInput) => Promise<PageSummary>
      getPage: (pageId: string) => Promise<PageEditorData>
      savePageContent: (input: SavePageContentInput) => Promise<PageEditorData>
      capturePagePreview: (pageId: string) => Promise<string>
    }>
  }
}
