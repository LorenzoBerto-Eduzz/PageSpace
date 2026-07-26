import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { dirname, join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { PageWorkspaceService } from './page-workspace-service'
import type { CreatePageInput, PageContent, SavePageContentInput } from '../shared/page-contracts'

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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function createPreviewHtml(content: PageContent): string {
  const elements = content.elements
    .map(
      (element, index) =>
        `<div style="height:${content.layout.gaps[index]}px"></div>` +
        `<h1>${escapeHtml(element.text)}</h1>`
    )
    .join('')

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <style>
      * { box-sizing: border-box; }
      html, body { width: 100%; min-height: 100%; margin: 0; background: #fff; }
      body {
        padding-right: ${content.layout.marginRight}px;
        padding-left: ${content.layout.marginLeft}px;
        color: #3b3d42;
        font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
      }
      h1 {
        width: fit-content;
        max-width: 100%;
        min-height: 1.1em;
        margin: 0;
        padding: 7px 8px;
        overflow: hidden;
        font-size: 50px;
        font-weight: 500;
        line-height: 1.2;
        letter-spacing: -0.055em;
        white-space: nowrap;
      }
    </style>
  </head>
  <body>
    ${elements}
    <div style="height:${content.layout.gaps[content.elements.length]}px"></div>
  </body>
</html>`
}

async function captureCleanPagePreview(
  pageWorkspace: PageWorkspaceService,
  pageId: string
): Promise<string> {
  const pageData = await pageWorkspace.getPage(pageId)
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
    const html = createPreviewHtml(pageData.content)
    await previewWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
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
