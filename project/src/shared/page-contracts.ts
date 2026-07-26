export type PageStatus = 'local'

export type PageSummary = {
  id: string
  name: string
  description: string
  status: PageStatus
  createdAt: string
  updatedAt: string
}

export type CreatePageInput = {
  name: string
  description: string
}
