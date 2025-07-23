const fs = require('fs-extra')
const path = require('path')
const state = require('./state')
const { ipcRenderer } = require('electron')
const { logError } = require('./utils')

let settingsFile = null
let settingsDir = null

const defaultSettings = {
  companyName: 'Your Company Name',
  defaultTestLocation: 'Your Default Location',
}

async function initPaths() {
  try {
    const userDataPath = await ipcRenderer.invoke('get-user-data-path')
    settingsDir = path.join(userDataPath, 'Settings')
    settingsFile = path.join(settingsDir, 'settings.json')
  } catch (err) {
    console.error('❌ Failed to initialize settings paths:', err)
    await logError('Failed to initPaths in settingsManager', err)
  }
}

/**
 * Loads settings from settings/settings.json and updates state.
 */
async function loadSettings() {
  if (!settingsFile || !settingsDir) await initPaths()
  if (!settingsFile || !settingsDir) {
    console.error('❌ Settings path not initialized.')
    return
  }
  if (await fs.pathExists(settingsFile)) {
    try {
      const data = await fs.readJson(settingsFile)
      // ✅ Add validation here
      const isValidSettings = (obj) =>
        obj &&
        typeof obj.companyName === 'string' &&
        typeof obj.defaultTestLocation === 'string'
      if (isValidSettings(data)) {
        state.set('settings', data)
        console.log('✅ Settings loaded:', data)
      } else {
        throw new Error('Invalid settings format')
      }
    } catch (err) {
      console.error('❌ Failed to parse settings.json, using defaults:', err)
      await logError('Failed to load settings in settingsManager', err)
      state.set('settings', defaultSettings)
      await saveSettings(defaultSettings)
    }
  } else {
    console.log('ℹ️ No settings file found, using defaults.')
    state.set('settings', defaultSettings)
    await saveSettings(defaultSettings)
  }
}

/**
 * Saves settings to disk and updates state.
 * @param {object} settings
 */
async function saveSettings(settings) {
  try {
    if (!settingsFile || !settingsDir) await initPaths()
    if (!settingsFile || !settingsDir) {
      console.error('❌ Settings path not initialized.')
      return
    }
    await fs.ensureDir(settingsDir)
    await fs.writeJson(settingsFile, settings, { spaces: 2 })
    state.set('settings', settings)
    console.log('✅ Settings saved:', settings)
  } catch (err) {
    console.error('❌ Failed to save settings:', err)
    await logError('Failed to save settings in settingsManager', err)
  }
}

module.exports = { loadSettings, saveSettings }
