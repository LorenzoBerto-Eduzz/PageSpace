import type {
  AppSettingsSnapshot,
  AppUpdateInstallResult,
  AppUpdateStatus,
  DeletePublicationInput,
  DeletePublicationResult,
  ImportPageResult,
  PageEditorData,
  PageEditorImageResult,
  PageSummary,
  SavePackageContentInput,
  UpdatePageDetailsInput,
  GitHubConnectionStatus,
  GitHubDeviceAuthorization,
  PublishPageInput,
  PublishPageResult
} from '../shared/page-contracts'

declare global {
  interface Window {
    pageSpace: Readonly<{
      listPages: () => Promise<PageSummary[]>
      synchronizePageSources: () => Promise<PageSummary[]>
      importPage: () => Promise<ImportPageResult | null>
      getPage: (pageId: string) => Promise<PageEditorData>
      getPagePreviewUrl: (pageId: string) => Promise<string>
      refreshPageFromSource: (pageId: string) => Promise<PageSummary>
      savePackageContent: (input: SavePackageContentInput) => Promise<PageEditorData>
      choosePageImage: (pageId: string) => Promise<PageEditorImageResult | null>
      pastePageImage: (pageId: string) => Promise<PageEditorImageResult>
      openPageLink: (url: string) => Promise<void>
      capturePagePreview: (pageId: string) => Promise<string>
      updatePageDetails: (input: UpdatePageDetailsInput) => Promise<PageSummary>
      openPageFolder: (pageId: string) => Promise<void>
      openLocalPage: (pageId: string) => Promise<void>
      openPublishedPage: (pageId: string) => Promise<void>
      openPublishedRepository: (pageId: string) => Promise<void>
      deleteLocalPage: (pageId: string) => Promise<void>
      recoverPage: (pageId: string) => Promise<PageSummary>
      getAppSettings: () => Promise<AppSettingsSnapshot>
      openPagesFolder: () => Promise<void>
      downloadAiInstructions: () => Promise<boolean>
      checkForAppUpdate: (force?: boolean) => Promise<AppUpdateStatus>
      installAppUpdate: () => Promise<AppUpdateInstallResult>
      beginGitHubLink: () => Promise<GitHubDeviceAuthorization>
      completeGitHubLink: (flowId: string) => Promise<GitHubConnectionStatus>
      cancelGitHubLink: (flowId: string) => Promise<void>
      copyGitHubCode: (userCode: string) => Promise<void>
      openGitHubDevicePage: () => Promise<void>
      disconnectGitHub: () => Promise<void>
      getGitHubStatus: () => Promise<GitHubConnectionStatus>
      publishPage: (input: PublishPageInput) => Promise<PublishPageResult>
      deletePublication: (input: DeletePublicationInput) => Promise<DeletePublicationResult>
      minimizeWindow: () => void
      toggleMaximizeWindow: () => void
      closeWindow: () => void
    }>
  }
}
