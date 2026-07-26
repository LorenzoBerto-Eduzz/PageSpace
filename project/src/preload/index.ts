import { contextBridge, ipcRenderer } from 'electron'
import type { CreatePageInput } from '../shared/page-contracts'

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
    }
  })
)
