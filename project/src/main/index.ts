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
  screen,
  shell
} from 'electron'
import { basename, dirname, join, resolve } from 'path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { writeFile } from 'node:fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.ico?asset'
import { PageSpaceWorkspaceService } from './pagespace-workspace-service'
import { GitHubAuthService } from './github-auth-service'
import { GitHubPublishingService } from './github-publishing-service'
import { PublicationDiagnostics } from './publication-diagnostics'
import { createPageSpaceAiInstructions } from './pagespace-ai-instructions'
import { PageSpaceUpdateService } from './pagespace-update-service'
import { readWindowState, writeWindowState, type WindowState } from './window-state'
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

const PAGE_EDITOR_HEADER_HEIGHT = 64
const STORED_PREVIEW_WIDTH = 1104
const PAGE_PREVIEW_ASPECT_RATIO = 11 / 6
const OFFSCREEN_LAYOUT_WIDTH_ALLOWANCE = 16
let mainApplicationWindow: BrowserWindow | null = null
let pendingUpdateMarker = requestedUpdateMarker()

function requestedUpdateMarker(): string | null {
  const markerIndex = process.argv.indexOf('--pagespace-update-marker')
  if (markerIndex < 0 || markerIndex + 1 >= process.argv.length) return null
  const marker = resolve(process.argv[markerIndex + 1])
  if (
    dirname(marker).toLowerCase() !== resolve(tmpdir()).toLowerCase() ||
    !/^pagespace-update-ready-[a-f0-9-]{36}\.txt$/.test(basename(marker))
  ) {
    return null
  }
  return marker
}

async function getPagePreviewViewport(): Promise<{ width: number; height: number }> {
  const mainWindow = mainApplicationWindow
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      const viewport = (await mainWindow.webContents.executeJavaScript(
        `({
          width: Math.max(Math.round(window.innerWidth), 1),
          height: Math.max(Math.round(window.innerHeight - ${PAGE_EDITOR_HEADER_HEIGHT}), 1)
        })`
      )) as { width?: unknown; height?: unknown }
      if (
        typeof viewport.width === 'number' &&
        Number.isFinite(viewport.width) &&
        typeof viewport.height === 'number' &&
        Number.isFinite(viewport.height)
      ) {
        return {
          width: viewport.width,
          height: Math.max(Math.round(viewport.width / PAGE_PREVIEW_ASPECT_RATIO), 1)
        }
      }
    } catch {
      // Fall back to Electron content bounds while the renderer is not ready.
    }
  }
  const contentBounds = mainWindow?.getContentBounds()
  const width = Math.max(contentBounds?.width ?? 1920, 1)
  const height = Math.max(Math.round(width / PAGE_PREVIEW_ASPECT_RATIO), 1)
  return { width, height }
}

function getPagesRoot(): string {
  return app.isPackaged ? join(dirname(process.execPath), 'Pages') : join(app.getAppPath(), 'Pages')
}

function createWindow(
  hasActivePublications: () => boolean,
  initialWindowState: WindowState | null
): void {
  const mainWindow = new BrowserWindow({
    width: initialWindowState?.width ?? 1280,
    height: initialWindowState?.height ?? 820,
    ...(initialWindowState ? { x: initialWindowState.x, y: initialWindowState.y } : {}),
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#14003a',
    frame: false,
    resizable: true,
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
  mainApplicationWindow = mainWindow

  mainWindow.setFullScreen(true)

  const windowStatePath = join(app.getPath('userData'), 'window-state.json')
  let stateSaveTimer: NodeJS.Timeout | null = null
  const saveWindowState = (): void => {
    if (mainWindow.isDestroyed() || mainWindow.isMinimized()) return
    const bounds = mainWindow.getNormalBounds()
    writeWindowState(windowStatePath, {
      ...bounds,
      maximized: mainWindow.isFullScreen()
    })
  }
  const scheduleWindowStateSave = (): void => {
    if (stateSaveTimer) clearTimeout(stateSaveTimer)
    stateSaveTimer = setTimeout(saveWindowState, 300)
  }
  mainWindow.on('resize', scheduleWindowStateSave)
  mainWindow.on('move', scheduleWindowStateSave)

  mainWindow.on('closed', () => {
    if (stateSaveTimer) clearTimeout(stateSaveTimer)
    if (mainApplicationWindow === mainWindow) mainApplicationWindow = null
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    const marker = pendingUpdateMarker
    pendingUpdateMarker = null
    if (marker)
      void writeFile(marker, 'ready', { encoding: 'utf8', flag: 'wx' }).catch(() => undefined)
  })

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })

  let allowCloseDuringPublication = false
  let isShowingPublicationWarning = false
  mainWindow.on('close', (event) => {
    saveWindowState()
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
  await pageWorkspace.generatePageSite(pageId)
  const viewport = await getPagePreviewViewport()
  const previewWindow = new BrowserWindow({
    show: false,
    width: viewport.width + OFFSCREEN_LAYOUT_WIDTH_ALLOWANCE,
    height: viewport.height,
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
    const pageUrl = `pagespace-preview://page/${encodeURIComponent(pageId)}/index.html`
    const captureHost = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src pagespace-preview:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
          <style>html, body, iframe { width: 100%; height: 100%; margin: 0; border: 0; overflow: hidden; }</style>
        </head>
        <body>
          <iframe src="${pageUrl}" sandbox="allow-scripts"></iframe>
          <script>
            document.querySelector('iframe').addEventListener('load', () => {
              document.documentElement.dataset.pageFrameReady = 'true'
            }, { once: true })
          </script>
        </body>
      </html>`
    await previewWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(captureHost)}`)
    await previewWindow.webContents.executeJavaScript(
      `(async () => {
        const startedAt = Date.now()
        while (document.documentElement.dataset.pageFrameReady !== 'true') {
          if (Date.now() - startedAt > 5000) throw new Error('Page preview timed out')
          await new Promise((resolve) => setTimeout(resolve, 25))
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      })()`
    )
    const capturedPage = await previewWindow.webContents.capturePage({
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height
    })
    const preview = capturedPage.resize({ width: STORED_PREVIEW_WIDTH, quality: 'good' }).toPNG()
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
    const aspectRatio = dimensions ? dimensions.width / dimensions.height : 0
    if (
      dimensions &&
      dimensions.width > 0 &&
      dimensions.height > 0 &&
      Math.abs(aspectRatio - PAGE_PREVIEW_ASPECT_RATIO) < 0.01
    ) {
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

async function synchronizeChangedPageSources(
  pageWorkspace: PageSpaceWorkspaceService
): Promise<Awaited<ReturnType<PageSpaceWorkspaceService['listPages']>>> {
  const detectedPages = await pageWorkspace.listPages()
  for (const page of detectedPages) {
    if (page.health !== 'healthy' || page.sourceSync.state !== 'update-available') continue
    try {
      await pageWorkspace.refreshPageFromSource(page.id)
      await captureCleanPagePreview(pageWorkspace, page.id)
    } catch {
      // Keep the last verified managed copy when a source update is incomplete or invalid.
    }
  }
  return ensureCurrentPagePreviews(pageWorkspace, await pageWorkspace.listPages())
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
  const appUpdates = new PageSpaceUpdateService({
    currentVersion: app.getVersion(),
    installDirectory: dirname(process.execPath),
    executablePath: process.execPath,
    isPackaged: app.isPackaged,
    fetch: (input, init) => net.fetch(input, init),
    requestQuit: () => app.quit()
  })
  ipcMain.handle('pages:list', async () => pageWorkspace.listPages())
  ipcMain.handle('pages:synchronize-sources', async () =>
    synchronizeChangedPageSources(pageWorkspace)
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
    try {
      await pageWorkspace.resolveGeneratedSiteFile(pageId, 'index.html')
    } catch {
      await pageWorkspace.generatePageSite(pageId)
    }
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
    return {
      value: await pageWorkspace.savePackageImage(pageId, image.toPNG()),
      previewDataUrl: image.toDataURL()
    }
  })
  ipcMain.handle('pages:paste-image', async (_, pageId: string) => {
    const image = clipboard.readImage()
    if (image.isEmpty()) {
      throw new Error('A área de transferência não contém uma imagem.')
    }
    return {
      value: await pageWorkspace.savePackageImage(pageId, image.toPNG()),
      previewDataUrl: image.toDataURL()
    }
  })
  ipcMain.handle('pages:open-link', async (_, value: string) => {
    if (typeof value !== 'string') throw new Error('Endereço inválido.')
    const target = new URL(value)
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      throw new Error('Use um endereço iniciado por http:// ou https://.')
    }
    await shell.openExternal(target.toString())
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
    await writeFile(destination.filePath, createPageSpaceAiInstructions(app.getVersion()), 'utf8')
    return true
  })
  ipcMain.handle('app-update:check', (_, force = false) => appUpdates.check(force === true))
  ipcMain.handle('app-update:install', () => {
    if (githubPublishing.hasActivePublications()) {
      throw new Error('Aguarde a publicação atual terminar antes de atualizar o PageSpace.')
    }
    return appUpdates.install()
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
  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.on('window:toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    window.setFullScreen(!window.isFullScreen())
  })
  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const displayAreas = screen.getAllDisplays().map(({ workArea }) => workArea)
  const initialWindowState = readWindowState(
    join(app.getPath('userData'), 'window-state.json'),
    displayAreas
  )
  createWindow(() => githubPublishing.hasActivePublications(), initialWindowState)

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(() => githubPublishing.hasActivePublications(), initialWindowState)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
