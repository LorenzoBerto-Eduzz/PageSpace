export type PageStatus = 'local'

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
