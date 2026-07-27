import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron'
import { dirname, join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { PageWorkspaceService } from './page-workspace-service'
import type {
  CreatePageInput,
  SavePageContentInput,
  UpdatePageDetailsInput
} from '../shared/page-contracts'

function getPagesRoot(): string {
  return app.isPackaged ? join(dirname(process.execPath), 'Pages') : join(app.getAppPath(), 'Pages')
}

function createWindow(): void {
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
  ipcMain.handle('pages:delete-local', async (_, pageId: string) => {
    const folderPath = await pageWorkspace.getPageFolderPath(pageId)
    await shell.trashItem(folderPath)
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
