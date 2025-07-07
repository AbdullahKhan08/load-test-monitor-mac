const { app, BrowserWindow } = require('electron')
const path = require('path')
if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(process.cwd(), {
    electron: process.cwd() + '/node_modules/.bin/electron',
    ignored: /reports/,
  })
}

// import { fileURLToPath } from 'url'
// import { dirname } from 'path'

// const __filename = fileURLToPath(import.meta.url)
// const __dirname = dirname(__filename)

let splash
let mainWindow

function createSplash() {
  splash = new BrowserWindow({
    width: 600,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
  })
  splash.loadFile(path.join(__dirname, 'splash.html'))

  setTimeout(() => {
    createMainWindow()
    splash.close()
  }, 3000) // show splash for 3 seconds
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 850,
    height: 650,
    fullscreen: true,
    icon: path.join(__dirname, 'assets/logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })
  // mainWindow.loadFile('index.html')
  mainWindow.loadFile(path.join(__dirname, 'index.html'))
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
  // if (process.env.NODE_ENV !== 'development') {
  //   mainWindow.webContents.on('devtools-opened', () => {
  //     mainWindow.webContents.closeDevTools()
  //   })
  // }
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
