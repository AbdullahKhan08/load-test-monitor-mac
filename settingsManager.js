// settingsManager.js
const fs = require('fs')
const path = require('path')
const state = require('./state')

const settingsFile = path.join(__dirname, 'settings', 'settings.json')
const logoFile = path.join(__dirname, 'settings', 'logo.png')

/**
 * Loads settings from settings/settings.json and updates state.
 */
function loadSettings() {
  if (fs.existsSync(settingsFile)) {
    const data = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'))
    state.set('settings', data)
    console.log('✅ Settings loaded:', data)
  } else {
    console.log('ℹ️ No settings file found, using defaults.')
    const defaultSettings = {
      companyName: 'Samaa Aerospace LLP',
      footerText: 'Samaa Aerospace LLP',
      logoPath: '',
    }
    state.set('settings', defaultSettings)
    saveSettings(defaultSettings)
  }
}

/**
 * Saves settings to disk and updates state.
 * @param {object} settings
 */
function saveSettings(settings) {
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2))
  state.set('settings', settings)
  console.log('✅ Settings saved:', settings)
}

/**
 * Handles logo upload by copying to settings/logo.png
 * @param {File} file
 */
function saveLogo(filePath) {
  fs.copyFileSync(filePath, logoFile)
  const currentSettings = state.get('settings') || {}
  currentSettings.logoPath = './settings/logo.png'
  saveSettings(currentSettings)
  console.log('✅ Logo saved.')
}

module.exports = { loadSettings, saveSettings, saveLogo }
