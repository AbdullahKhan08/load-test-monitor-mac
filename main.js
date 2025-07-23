const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const fs = require('fs-extra')
const path = require('path')
const { SerialPort } = require('serialport')
const { checkLicense } = require('./licenseManager')
const { logMainError } = require('./utils')
require('./loadEnv').loadEnvironment()

process.on('uncaughtException', (err) => {
  logMainError('Uncaught Exception in Main', err)
})

process.on('unhandledRejection', (reason) => {
  logMainError('Unhandled Promise Rejection in Main', reason)
})

let splash = null
let mainWindow = null

ipcMain.handle('list-serial-ports', async () => {
  try {
    const ports = await SerialPort.list()
    return { success: true, ports }
  } catch (err) {
    logMainError('Failed to list serial ports:', err)
    return { success: false, error: err.message }
  }
})

ipcMain.handle('get-user-data-path', () => {
  try {
    const userDataPath = app.getPath('userData')
    return userDataPath
  } catch (err) {
    logMainError('Failed to get user data path', err)
    return null
  }
})

ipcMain.handle('check-license', async () => {
  try {
    const licensePath = path.join(app.getPath('userData'), 'license.json')
    const result = await checkLicense(licensePath)
    return result
  } catch (err) {
    logMainError('Failed to check license', err)
    return { valid: false, error: err.message }
  }
})

// setTimeout(() => {
//   throw new Error('💥 Simulated async error')
// }, 2000)

ipcMain.handle('select-logo', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Select Logo Image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Logo selection was canceled or empty' }
    }
    const src = result.filePaths[0]
    const userDataPath = app.getPath('userData')
    const logosDir = path.join(userDataPath, 'Settings')
    await fs.ensureDir(logosDir)
    const dest = path.join(logosDir, 'logo.png')
    await fs.copyFile(src, dest)
    return dest
  } catch (err) {
    logMainError('Failed to select logo', err)
    return { success: false, error: err.message }
  }
})

function createSplash() {
  splash = new BrowserWindow({
    width: 600,
    height: 400,
    backgroundColor: '#ffffff',
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    show: true,
    skipTaskbar: true,
    movable: false,
    focusable: false,
  })

  splash.loadFile(path.join(__dirname, 'splash.html')).catch((err) => {
    console.error('⚠️ Failed to load splash.html:', err)
    createMainWindow()
    if (splash && !splash.isDestroyed()) splash.close()
  })

  splash.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      createMainWindow()
    }, 2500)
  })
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600, // or 1600,1000 or 1920, 1080
    height: 1000,
    resizable: true,
    maximizable: true,
    minimizable: true,
    title: 'Load Test Monitor',
    fullscreen: true,
    show: false,
    icon: path.join(__dirname, 'assets/logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // devTools: false,
      spellcheck: false,
      zoomFactor: 1.0,
      enableRemoteModule: false,
    },
  })
  // mainWindow.maximize()  -- > enable in windows
  mainWindow.setBounds({ x: 0, y: 0, width: 1600, height: 1000 }) // or 1920x1080  -- > remove in windows
  mainWindow.loadFile(path.join(__dirname, 'index.html')).catch((err) => {
    logMainError('Failed to load index.html', err)
    if (splash && !splash.isDestroyed()) splash.close()
  })

  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splash && !splash.isDestroyed()) splash.close()
      mainWindow.show()
    }, 500)
  })
}

app.whenReady().then(() => {
  createSplash()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
