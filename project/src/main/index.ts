import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeTheme, shell } from 'electron'
import { dirname, join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { PageWorkspaceService } from './page-workspace-service'
import { GitHubAuthService } from './github-auth-service'
import { GitHubPublishingService } from './github-publishing-service'
import { PublicationDiagnostics } from './publication-diagnostics'
import type {
  CreatePageInput,
  PublishPageInput,
  SavePageContentInput,
  UpdatePageDetailsInput
} from '../shared/page-contracts'

function getPagesRoot(): string {
  return app.isPackaged ? join(dirname(process.execPath), 'Pages') : join(app.getAppPath(), 'Pages')
}

function createWindow(hasActivePublications: () => boolean): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f6f7fb',
    title: 'PageMaker',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })

  let allowCloseDuringPublication = false
  let isShowingPublicationWarning = false
  mainWindow.on('close', (event) => {
    if (allowCloseDuringPublication || !hasActivePublications()) return
    event.preventDefault()
    if (isShowingPublicationWarning) return
    isShowingPublicationWarning = true
    void dialog
      .showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Publicação em andamento',
        message: 'Uma página ainda está sendo publicada.',
        detail:
          'Fechar agora pode interromper o envio. O PageMaker manterá o estado local para permitir uma nova tentativa.',
        buttons: ['Continuar aguardando', 'Fechar mesmo assim'],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      })
      .then(({ response }) => {
        if (response === 1) {
          allowCloseDuringPublication = true
          mainWindow.close()
        }
      })
      .finally(() => {
        isShowingPublicationWarning = false
      })
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function captureCleanPagePreview(
  pageWorkspace: PageWorkspaceService,
  pageId: string
): Promise<string> {
  const generatedSite = await pageWorkspace.generatePageSite(pageId)
  const previewWindow = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false
    }
  })

  try {
    await previewWindow.loadFile(generatedSite.indexPath)
    await previewWindow.webContents.executeJavaScript(
      'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
    )
    const capturedPage = await previewWindow.webContents.capturePage()
    const preview = capturedPage.resize({ width: 960, quality: 'good' }).toPNG()
    return await pageWorkspace.savePreview(pageId, preview)
  } finally {
    previewWindow.destroy()
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pagemaker.app')
  nativeTheme.themeSource = 'light'

  const pageWorkspace = new PageWorkspaceService(getPagesRoot())
  const githubAuth = new GitHubAuthService(app.getPath('userData'))
  const githubPublishing = new GitHubPublishingService(
    githubAuth,
    pageWorkspace,
    new PublicationDiagnostics(app.getPath('userData'))
  )
  ipcMain.handle('pages:list', () => pageWorkspace.listPages())
  ipcMain.handle('pages:create', async (_, input: CreatePageInput) => {
    const createdPage = await pageWorkspace.createPage(input)
    try {
      const previewDataUrl = await captureCleanPagePreview(pageWorkspace, createdPage.id)
      return { ...createdPage, previewDataUrl }
    } catch {
      // Page creation remains successful even if its replaceable dashboard preview fails.
      return createdPage
    }
  })
  ipcMain.handle('pages:get', (_, pageId: string) => pageWorkspace.getPage(pageId))
  ipcMain.handle('pages:save-content', (_, input: SavePageContentInput) =>
    pageWorkspace.savePageContent(input)
  )
  ipcMain.handle('pages:capture-preview', (_, pageId: string) =>
    captureCleanPagePreview(pageWorkspace, pageId)
  )
  ipcMain.handle('pages:update-details', (_, input: UpdatePageDetailsInput) =>
    pageWorkspace.updatePageDetails(input)
  )
  ipcMain.handle('pages:open-folder', async (_, pageId: string) => {
    const folderPath = await pageWorkspace.getPageFolderPath(pageId)
    const openError = await shell.openPath(folderPath)
    if (openError) throw new Error(openError)
  })
  ipcMain.handle('pages:open-public', async (_, pageId: string) => {
    const page = (await pageWorkspace.getPage(pageId)).page
    if (page.deployment.kind !== 'published') throw new Error('A página ainda não foi publicada.')
    const publicUrl = new URL(page.deployment.publicUrl)
    if (
      publicUrl.protocol !== 'https:' ||
      !publicUrl.hostname.toLowerCase().endsWith('.github.io')
    ) {
      throw new Error('O endereço público salvo é inválido.')
    }
    await shell.openExternal(publicUrl.toString())
  })
  ipcMain.handle('pages:delete-local', async (_, pageId: string) => {
    const folderPath = await pageWorkspace.getPageFolderPath(pageId)
    await shell.trashItem(folderPath)
  })
  ipcMain.handle('pages:recover', (_, pageId: string) => pageWorkspace.recoverPage(pageId))
  ipcMain.handle('app-settings:open-pages-folder', async () => {
    const pagesRoot = getPagesRoot()
    await pageWorkspace.ensurePagesRoot()
    const openError = await shell.openPath(pagesRoot)
    if (openError) throw new Error(openError)
  })
  ipcMain.handle('app-settings:refresh', async () => {
    const pages = await pageWorkspace.listPages()
    const refreshedPages = await Promise.all(
      pages.map(async (page) => {
        if (page.health === 'damaged') return page
        try {
          await pageWorkspace.generatePageSite(page.id)
          if (!page.previewDataUrl) {
            return {
              ...page,
              previewDataUrl: await captureCleanPagePreview(pageWorkspace, page.id)
            }
          }
        } catch {
          // Replaceable output failures do not turn valid editable content into corruption.
        }
        return page
      })
    )
    return {
      version: app.getVersion(),
      github: await githubAuth.getStatus(),
      pages: refreshedPages
    }
  })
  ipcMain.handle('github:begin-link', async () => {
    const authorization = await githubAuth.beginDeviceFlow()
    clipboard.writeText(authorization.userCode)
    await shell.openExternal(authorization.verificationUri)
    return authorization
  })
  ipcMain.handle('github:complete-link', (_, flowId: string) =>
    githubAuth.completeDeviceFlow(flowId)
  )
  ipcMain.handle('github:cancel-link', (_, flowId: string) => {
    githubAuth.cancelDeviceFlow(flowId)
  })
  ipcMain.handle('github:copy-code', (_, userCode: string) => {
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(userCode)) {
      throw new Error('Código de vinculação inválido.')
    }
    clipboard.writeText(userCode)
  })
  ipcMain.handle('github:open-device-page', () =>
    shell.openExternal('https://github.com/login/device')
  )
  ipcMain.handle('github:disconnect', () => githubAuth.disconnect())
  ipcMain.handle('github:status', () => githubAuth.getStatus())
  ipcMain.handle('pages:publish', (_, input: PublishPageInput) => githubPublishing.publish(input))

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow(() => githubPublishing.hasActivePublications())

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(() => githubPublishing.hasActivePublications())
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
