import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  nativeImage,
  nativeTheme,
  net,
  protocol,
  shell
} from 'electron'
import { dirname, join } from 'path'
import { pathToFileURL } from 'node:url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { PageSpaceWorkspaceService } from './pagespace-workspace-service'
import { GitHubAuthService } from './github-auth-service'
import { GitHubPublishingService } from './github-publishing-service'
import { PublicationDiagnostics } from './publication-diagnostics'
import { createPageSpaceAiInstructions } from './pagespace-ai-instructions'
import type {
  DeletePublicationInput,
  PublishPageInput,
  SavePackageContentInput,
  UpdatePageDetailsInput
} from '../shared/page-contracts'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'pagespace-preview',
    privileges: { standard: true, secure: true, supportFetchAPI: true }
  }
])

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
    title: 'PageSpace',
    icon,
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
          'Fechar agora pode interromper o envio. O PageSpace manterá o estado local para permitir uma nova tentativa.',
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
  pageWorkspace: PageSpaceWorkspaceService,
  pageId: string
): Promise<string> {
  const generatedSite = await pageWorkspace.generatePageSite(pageId)
  const previewWindow = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    useContentSize: true,
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

async function ensureCurrentPagePreviews(
  pageWorkspace: PageSpaceWorkspaceService,
  pages: Awaited<ReturnType<PageSpaceWorkspaceService['listPages']>>
): Promise<typeof pages> {
  const refreshedPages: typeof pages = []
  for (const page of pages) {
    if (page.health === 'damaged') {
      refreshedPages.push(page)
      continue
    }
    const currentPreview = page.previewDataUrl
      ? nativeImage.createFromDataURL(page.previewDataUrl)
      : null
    const dimensions = currentPreview && !currentPreview.isEmpty() ? currentPreview.getSize() : null
    if (dimensions?.width === 960 && dimensions.height === 540) {
      refreshedPages.push(page)
      continue
    }
    try {
      refreshedPages.push({
        ...page,
        previewDataUrl: await captureCleanPagePreview(pageWorkspace, page.id)
      })
    } catch {
      refreshedPages.push(page)
    }
  }
  return refreshedPages
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pagespace.app')
  nativeTheme.themeSource = 'light'

  const pageWorkspace = new PageSpaceWorkspaceService(getPagesRoot())
  protocol.handle('pagespace-preview', async (request) => {
    try {
      const url = new URL(request.url)
      if (url.hostname !== 'page') return new Response('Not found', { status: 404 })
      const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
      const pageId = segments.shift()
      if (!pageId || !/^[A-Za-z0-9-]{1,80}$/.test(pageId)) {
        return new Response('Not found', { status: 404 })
      }
      const filePath = await pageWorkspace.resolveGeneratedSiteFile(
        pageId,
        segments.join('/') || 'index.html'
      )
      return net.fetch(pathToFileURL(filePath).toString())
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
  const githubAuth = new GitHubAuthService(app.getPath('userData'))
  const githubPublishing = new GitHubPublishingService(
    githubAuth,
    pageWorkspace,
    new PublicationDiagnostics(app.getPath('userData'))
  )
  ipcMain.handle('pages:list', async () =>
    ensureCurrentPagePreviews(pageWorkspace, await pageWorkspace.listPages())
  )
  ipcMain.handle('pages:import', async () => {
    const selection = await dialog.showOpenDialog({
      title: 'Trazer página para o PageSpace',
      properties: ['openDirectory'],
      buttonLabel: 'Trazer página'
    })
    if (selection.canceled || selection.filePaths.length !== 1) return null
    const imported = await pageWorkspace.importPage(selection.filePaths[0])
    try {
      imported.page.previewDataUrl = await captureCleanPagePreview(pageWorkspace, imported.page.id)
    } catch {
      // A valid imported page remains available if its replaceable preview cannot be captured.
    }
    return imported
  })
  ipcMain.handle('pages:get', (_, pageId: string) => pageWorkspace.getPage(pageId))
  ipcMain.handle('pages:preview-url', async (_, pageId: string) => {
    await pageWorkspace.generatePageSite(pageId)
    return `pagespace-preview://page/${encodeURIComponent(pageId)}/index.html`
  })
  ipcMain.handle('pages:refresh-source', async (_, pageId: string) => {
    const page = await pageWorkspace.refreshPageFromSource(pageId)
    try {
      page.previewDataUrl = await captureCleanPagePreview(pageWorkspace, pageId)
    } catch {
      // A successful source refresh remains valid if its replaceable preview cannot be captured.
    }
    return page
  })
  ipcMain.handle('pages:save-package-content', (_, input: SavePackageContentInput) =>
    pageWorkspace.savePackageContent(input)
  )
  ipcMain.handle('pages:choose-image', async (_, pageId: string) => {
    const selection = await dialog.showOpenDialog({
      title: 'Escolher imagem',
      properties: ['openFile'],
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (selection.canceled || selection.filePaths.length !== 1) return null
    const image = nativeImage.createFromPath(selection.filePaths[0])
    if (image.isEmpty()) throw new Error('A imagem selecionada não pôde ser aberta.')
    return pageWorkspace.savePackageImage(pageId, image.toPNG())
  })
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
  ipcMain.handle('pages:open-local', async (_, pageId: string) => {
    const generated = await pageWorkspace.generatePageSite(pageId)
    const openError = await shell.openPath(generated.indexPath)
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
  ipcMain.handle('pages:open-repository', async (_, pageId: string) => {
    const page = (await pageWorkspace.getPage(pageId)).page
    if (page.deployment.kind !== 'published') throw new Error('A página ainda não foi publicada.')
    const repositoryUrl = new URL(page.deployment.repositoryUrl)
    if (
      repositoryUrl.protocol !== 'https:' ||
      repositoryUrl.hostname.toLowerCase() !== 'github.com' ||
      repositoryUrl.pathname !== `/${page.deployment.owner}/${page.deployment.repository}`
    ) {
      throw new Error('O endereço do repositório salvo é inválido.')
    }
    await shell.openExternal(repositoryUrl.toString())
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
    const refreshedPages = await ensureCurrentPagePreviews(
      pageWorkspace,
      await pageWorkspace.listPages()
    )
    return {
      version: app.getVersion(),
      github: await githubAuth.getStatus(),
      pages: refreshedPages
    }
  })
  ipcMain.handle('app-settings:download-ai-instructions', async () => {
    const destination = await dialog.showSaveDialog({
      title: 'Baixar instruções para IA',
      defaultPath: `PageSpace-${app.getVersion()}-instrucoes-para-IA.txt`,
      filters: [{ name: 'Arquivo de texto', extensions: ['txt'] }]
    })
    if (destination.canceled || !destination.filePath) return false
    const { writeFile } = await import('node:fs/promises')
    await writeFile(destination.filePath, createPageSpaceAiInstructions(app.getVersion()), 'utf8')
    return true
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
  ipcMain.handle('pages:delete-publication', (_, input: DeletePublicationInput) =>
    githubPublishing.deletePublication(input)
  )

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
