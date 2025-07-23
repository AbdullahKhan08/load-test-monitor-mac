const { ipcRenderer } = require('electron')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
// require('./loadEnv').loadEnvironment()

/**
 * Updates the status badge with the provided text and status type.
 * @param {string} text
 * @param {'info' | 'success' | 'error' | 'warning'} statusType
 */

function updateStatus(text, statusType = 'info') {
  const statusEl = document.getElementById('status')
  if (!statusEl) {
    console.warn('⚠️ Status element not found.')
    return
  }
  statusEl.innerText = text

  const statusStyles = {
    info: { background: '#e0e7ef', color: '#0a3a71' },
    success: { background: '#d4edda', color: '#155724' },
    error: { background: '#f8d7da', color: '#721c24' },
    warning: { background: '#fff3cd', color: '#856404' },
  }

  const style = statusStyles[statusType] || statusStyles.info
  statusEl.style.background = style.background
  statusEl.style.color = style.color
}

/**
 * Collects the current data table rows into an array for report generation.
 * @returns {string[][]} Table data as array of [timestamp, kg, tons].
 */
function getTableData() {
  /** @type {string[][]} */
  const data = []
  const rows = document.querySelectorAll('#dataTableBody tr')

  rows.forEach((row) => {
    const cells = row.querySelectorAll('td')
    data.push([
      cells[0]?.textContent?.trim() || '',
      cells[1]?.textContent?.trim() || '',
      cells[2]?.textContent?.trim() || '',
    ])
  })

  return data
}

function signData(licenseKey, organization, deviceFingerprint) {
  const secret = process.env.LICENSE_SECRET
  if (!secret) {
    throw new Error('❌ LICENSE_SECRET is not defined in environment.')
  }
  const payload = `${licenseKey}|${organization}|${deviceFingerprint}`
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

const logError = async (message, err) => {
  try {
    const userDataPath = await ipcRenderer.invoke('get-user-data-path')
    const logPath = path.join(userDataPath, 'error.log')
    const logMessage = `${new Date().toISOString()} - ${message} ${
      err?.stack || err
    }\n`
    fs.appendFileSync(logPath, logMessage)
  } catch (error) {
    console.error('⚠️ Failed to write error log:', error)
  }
}

function logMainError(message, err) {
  try {
    const { app } = require('electron')
    const logPath = path.join(app.getPath('userData'), 'error.log')
    const logMessage = `${new Date().toISOString()} - ${message} ${
      err?.stack || err
    }\n`
    fs.appendFileSync(logPath, logMessage)
  } catch (e) {
    console.error('⚠️ Failed to write to error.log:', e)
  }
}

module.exports = {
  getTableData,
  updateStatus,
  signData,
  logError,
  logMainError,
}
