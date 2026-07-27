export type PageStatus = 'local' | 'published'

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

export type PageEditorData = {
  page: PageSummary
  content: PageContent
}

export type SavePageContentInput = {
  pageId: string
  content: PageContent
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
