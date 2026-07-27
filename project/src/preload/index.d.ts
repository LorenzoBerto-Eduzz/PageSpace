import type {
  AppSettingsSnapshot,
  CreatePageInput,
  PageEditorData,
  PageSummary,
  SavePageContentInput,
  UpdatePageDetailsInput,
  GitHubConnectionStatus,
  GitHubDeviceAuthorization
} from '../shared/page-contracts'

declare global {
  interface Window {
    pageMaker: Readonly<{
      listPages: () => Promise<PageSummary[]>
      createPage: (input: CreatePageInput) => Promise<PageSummary>
      getPage: (pageId: string) => Promise<PageEditorData>
      savePageContent: (input: SavePageContentInput) => Promise<PageEditorData>
      capturePagePreview: (pageId: string) => Promise<string>
      updatePageDetails: (input: UpdatePageDetailsInput) => Promise<PageSummary>
      openPageFolder: (pageId: string) => Promise<void>
      deleteLocalPage: (pageId: string) => Promise<void>
      recoverPage: (pageId: string) => Promise<PageSummary>
      getAppSettings: () => Promise<AppSettingsSnapshot>
      openPagesFolder: () => Promise<void>
      beginGitHubLink: () => Promise<GitHubDeviceAuthorization>
      completeGitHubLink: (flowId: string) => Promise<GitHubConnectionStatus>
      cancelGitHubLink: (flowId: string) => Promise<void>
      copyGitHubCode: (userCode: string) => Promise<void>
      openGitHubDevicePage: () => Promise<void>
      disconnectGitHub: () => Promise<void>
    }>
  }
}
