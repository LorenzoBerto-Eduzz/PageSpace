import { contextBridge, ipcRenderer } from 'electron'
import type { CreatePageInput, SavePageContentInput } from '../shared/page-contracts'

contextBridge.exposeInMainWorld(
  'pageMaker',
  Object.freeze({
    listPages: () => ipcRenderer.invoke('pages:list'),
    createPage: async (input: CreatePageInput) => {
      try {
        return await ipcRenderer.invoke('pages:create', input)
      } catch {
        throw new Error('Não foi possível criar a página local. Tente novamente.')
      }
    },
    getPage: async (pageId: string) => {
      try {
        return await ipcRenderer.invoke('pages:get', pageId)
      } catch {
        throw new Error('Não foi possível abrir a página local.')
      }
    },
    savePageContent: async (input: SavePageContentInput) => {
      try {
        return await ipcRenderer.invoke('pages:save-content', input)
      } catch {
        throw new Error('Não foi possível salvar as alterações da página.')
      }
    },
    capturePagePreview: async (pageId: string) => {
      try {
        return await ipcRenderer.invoke('pages:capture-preview', pageId)
      } catch {
        throw new Error('Não foi possível atualizar a imagem da página.')
      }
    }
  })
)
