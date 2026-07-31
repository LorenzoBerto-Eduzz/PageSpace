import { contextBridge, ipcRenderer } from 'electron'
import type {
  CreatePageInput,
  PublishPageInput,
  SavePackageContentInput,
  SavePageContentInput,
  UpdatePageDetailsInput
} from '../shared/page-contracts'

contextBridge.exposeInMainWorld(
  'pageSpace',
  Object.freeze({
    listPages: () => ipcRenderer.invoke('pages:list'),
    createPage: async (input: CreatePageInput) => {
      try {
        return await ipcRenderer.invoke('pages:create', input)
      } catch {
        throw new Error('Não foi possível criar a página local. Tente novamente.')
      }
    },
    importPage: async () => {
      try {
        return await ipcRenderer.invoke('pages:import')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(message.replace(/^Error invoking remote method '[^']+': Error:\s*/, ''))
      }
    },
    getPage: async (pageId: string) => {
      try {
        return await ipcRenderer.invoke('pages:get', pageId)
      } catch {
        throw new Error('Não foi possível abrir a página local.')
      }
    },
    refreshPageFromSource: async (pageId: string) => {
      try {
        return await ipcRenderer.invoke('pages:refresh-source', pageId)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(message.replace(/^Error invoking remote method '[^']+': Error:\s*/, ''))
      }
    },
    savePageContent: async (input: SavePageContentInput) => {
      try {
        return await ipcRenderer.invoke('pages:save-content', input)
      } catch {
        throw new Error('Não foi possível salvar as alterações da página.')
      }
    },
    savePackageContent: async (input: SavePackageContentInput) => {
      try {
        return await ipcRenderer.invoke('pages:save-package-content', input)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(message.replace(/^Error invoking remote method '[^']+': Error:\s*/, ''))
      }
    },
    choosePageImage: async (pageId: string) => {
      try {
        return await ipcRenderer.invoke('pages:choose-image', pageId)
      } catch {
        throw new Error('Não foi possível importar a imagem selecionada.')
      }
    },
    capturePagePreview: async (pageId: string) => {
      try {
        return await ipcRenderer.invoke('pages:capture-preview', pageId)
      } catch {
        throw new Error('Não foi possível atualizar a imagem da página.')
      }
    },
    updatePageDetails: async (input: UpdatePageDetailsInput) => {
      try {
        return await ipcRenderer.invoke('pages:update-details', input)
      } catch {
        throw new Error('Não foi possível atualizar os dados da página.')
      }
    },
    openPageFolder: async (pageId: string) => {
      try {
        await ipcRenderer.invoke('pages:open-folder', pageId)
      } catch {
        throw new Error('Não foi possível abrir a pasta da página.')
      }
    },
    openLocalPage: async (pageId: string) => {
      try {
        await ipcRenderer.invoke('pages:open-local', pageId)
      } catch {
        throw new Error('Não foi possível abrir a página local.')
      }
    },
    openPublishedPage: async (pageId: string) => {
      try {
        await ipcRenderer.invoke('pages:open-public', pageId)
      } catch {
        throw new Error('Não foi possível abrir o endereço público.')
      }
    },
    deleteLocalPage: async (pageId: string) => {
      try {
        await ipcRenderer.invoke('pages:delete-local', pageId)
      } catch {
        throw new Error('Não foi possível mover a página para a Lixeira.')
      }
    },
    recoverPage: async (pageId: string) => {
      try {
        return await ipcRenderer.invoke('pages:recover', pageId)
      } catch {
        throw new Error('Não foi possível recuperar o último backup válido.')
      }
    },
    getAppSettings: async () => {
      try {
        return await ipcRenderer.invoke('app-settings:refresh')
      } catch {
        throw new Error('Não foi possível verificar as páginas locais.')
      }
    },
    openPagesFolder: async () => {
      try {
        await ipcRenderer.invoke('app-settings:open-pages-folder')
      } catch {
        throw new Error('Não foi possível abrir a pasta Pages.')
      }
    },
    downloadAiInstructions: () => ipcRenderer.invoke('app-settings:download-ai-instructions'),
    beginGitHubLink: async () => {
      try {
        return await ipcRenderer.invoke('github:begin-link')
      } catch (error) {
        throw new Error(
          error instanceof Error ? error.message : 'Não foi possível iniciar a vinculação.'
        )
      }
    },
    completeGitHubLink: async (flowId: string) => {
      try {
        return await ipcRenderer.invoke('github:complete-link', flowId)
      } catch (error) {
        throw new Error(
          error instanceof Error ? error.message : 'Não foi possível vincular a conta GitHub.'
        )
      }
    },
    cancelGitHubLink: async (flowId: string) => {
      await ipcRenderer.invoke('github:cancel-link', flowId)
    },
    copyGitHubCode: async (userCode: string) => {
      await ipcRenderer.invoke('github:copy-code', userCode)
    },
    openGitHubDevicePage: async () => {
      await ipcRenderer.invoke('github:open-device-page')
    },
    disconnectGitHub: async () => {
      try {
        await ipcRenderer.invoke('github:disconnect')
      } catch {
        throw new Error('Não foi possível desvincular a conta GitHub.')
      }
    },
    getGitHubStatus: () => ipcRenderer.invoke('github:status'),
    publishPage: async (input: PublishPageInput) => {
      try {
        return await ipcRenderer.invoke('pages:publish', input)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(message.replace(/^Error invoking remote method '[^']+': Error:\s*/, ''))
      }
    }
  })
)
