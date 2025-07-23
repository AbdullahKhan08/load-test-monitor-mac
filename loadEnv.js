const path = require('path')
const dotenv = require('dotenv')
const { logError } = require('./utils')

function loadEnvironment() {
  let isPackaged = false

  try {
    const { app } = require('electron')
    // isPackaged = app?.isPackaged ?? false
    isPackaged = !!app?.isPackaged
  } catch (err) {
    isPackaged = false
  }
  try {
    const envPath = isPackaged
      ? path.join(process.resourcesPath, '.env')
      : path.join(__dirname, '.env')

    const result = dotenv.config({ path: envPath })
    console.log(`✅ Loaded .env from: ${envPath}`)
    if (result.error) {
      console.warn('⚠️ .env file not loaded:', result.error.message)
    }
  } catch (e) {
    console.error('❌ Failed to load .env:', e)
    logError('Error loading .env', e)
  }
}

module.exports = { loadEnvironment }
