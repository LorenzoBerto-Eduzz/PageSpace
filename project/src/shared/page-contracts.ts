import type {
  PageSource,
  PageSpaceEditableContent,
  PageSpaceEditableSchema,
  PageSpacePackageManifest
} from './pagespace-package-contracts'

export type PageStatus = 'local' | 'published'

export type PageSourceSync =
  | { state: 'not-applicable' }
  | { state: 'unlinked' }
  | { state: 'synced' }
  | { state: 'update-available' }
  | { state: 'unavailable' }

export type LocalPageDeployment = {
  kind: 'local-only'
}

export type PublishingPageDeployment = {
  kind: 'publishing'
  owner: string
  repository: string
  repositoryUrl: string
  publicUrl: string
  phase: 'repository-created' | 'content-pushed'
}

export type PublishedPageDeployment = {
  kind: 'published'
  owner: string
  repository: string
  repositoryUrl: string
  publicUrl: string
  publishedAt: string
  lastPublishedAt: string
  lastCommitOid: string
  pendingCommitOid?: string
  hasUnpublishedChanges?: boolean
}

export type PageDeployment =
  LocalPageDeployment | PublishingPageDeployment | PublishedPageDeployment

export type PageSummary = {
  id: string
  name: string
  description: string
  status: PageStatus
  createdAt: string
  updatedAt: string
  lastSavedAt: string | null
  folderName: string
  health: 'healthy' | 'damaged'
  canRecover: boolean
  healthMessage?: string
  deployment: PageDeployment
  source: PageSource
  sourceSync: PageSourceSync
  previewDataUrl?: string
}

export type CreatePageInput = {
  name: string
  description: string
}

export type TitleElement = {
  id: string
  type: 'title'
  text: string
}

export type PageElement = TitleElement

export type PageLayout = {
  marginLeft: number
  marginRight: number
  gaps: number[]
}

export type PageContent = {
  schemaVersion: 2
  elements: PageElement[]
  layout: PageLayout
}

export type SimplePageEditorData = {
  kind: 'simple'
  page: PageSummary
  content: PageContent
}

export type PackagePageEditorData = {
  kind: 'package'
  page: PageSummary
  manifest: PageSpacePackageManifest
  schema: PageSpaceEditableSchema | null
  content: PageSpaceEditableContent | null
}

export type ImportedWebsiteEditorData = {
  kind: 'website'
  page: PageSummary
}

export type PageEditorData =
  SimplePageEditorData | PackagePageEditorData | ImportedWebsiteEditorData

export type SavePageContentInput = {
  pageId: string
  content: PageContent
}

export type SavePackageContentInput = {
  pageId: string
  content: PageSpaceEditableContent
}

export type PageEditorImageResult = {
  value: string
  previewDataUrl: string
}

export type ImportPageResult = {
  page: PageSummary
  outcome: 'imported' | 'updated'
}

export type UpdatePageDetailsInput = {
  pageId: string
  name: string
  description: string
}

export type AppSettingsSnapshot = {
  version: string
  github: GitHubConnectionStatus
  pages: PageSummary[]
}

export type AppUpdateStatus =
  | { state: 'unsupported'; currentVersion: string }
  | { state: 'unavailable'; currentVersion: string }
  | { state: 'up-to-date'; currentVersion: string; latestVersion: string }
  | {
      state: 'available'
      currentVersion: string
      latestVersion: string
      releaseName: string
      publishedAt: string
    }

export type AppUpdateInstallResult = {
  state: 'restarting'
}

export type GitHubAccount = {
  id: number
  login: string
  name: string | null
  avatarUrl: string
  profileUrl: string
}

export type GitHubConnectionStatus =
  { state: 'disconnected' } | { state: 'connected'; account: GitHubAccount }

export type GitHubDeviceAuthorization = {
  flowId: string
  userCode: string
  verificationUri: string
  expiresAt: string
}

export type PublishPageInput = {
  pageId: string
  repositoryName?: string
}

export type PublishPageResult = {
  page: PageSummary
  outcome: 'published' | 'no-changes'
}

export type DeletePublicationInput = {
  pageId: string
}

export type DeletePublicationResult = {
  page: PageSummary
}
