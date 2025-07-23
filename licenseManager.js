// licenseManager.js
const axios = require('axios')
const { machineIdSync } = require('node-machine-id')
const fs = require('fs-extra')
const { signData, logError } = require('./utils')
const path = require('path')
// require('./loadEnv').loadEnvironment()
const SERVER_URL = process.env.LICENSE_SERVER_URL

/**
 * ✅ Verify signature locally using HMAC SHA256
 * @param {string} licenseKey
 * @param {string} organization
 * @param {string} deviceFingerprint
 * @param {string} signature
 */
function verifySignature(
  licenseKey,
  organization,
  deviceFingerprint,
  signature
) {
  try {
    const expectedSig = signData(licenseKey, organization, deviceFingerprint)
    return expectedSig === signature
  } catch (err) {
    logError('Signature verification failed', err)
    console.error('❌ Signature verification error:', err.message)
    return false
  }
}

/**
 * ✅ Check license validity on launch (Local Validation Only)
 * @param {string} licenseFilePath - Full path to license.json inside userData
 */

async function checkLicense(licenseFilePath) {
  if (!fs.existsSync(licenseFilePath)) {
    console.log('ℹ️ No license file found.')
    return { valid: false, message: 'No license found' }
  }
  try {
    const licenseData = await fs.readJSON(licenseFilePath)
    const { licenseKey, organization, deviceFingerprint, signature } =
      licenseData
    if (!licenseKey || !deviceFingerprint || !organization || !signature)
      throw new Error('Invalid license file')

    const isValid = verifySignature(
      licenseKey,
      organization,
      deviceFingerprint,
      signature
    )
    if (isValid) {
      console.log('✅ License valid (local check).')
      return { valid: true, message: 'License valid' }
    } else {
      console.log('❌ License signature mismatch.')
      await fs.remove(licenseFilePath)
      return { valid: false, message: 'Invalid license signature' }
    }
  } catch (err) {
    await logError('Local license validation failed', err)
    console.error('❌ Local validation error:', err.message)
    await fs.remove(licenseFilePath)
    return { valid: false, message: err.message }
  }
}

// ✅ Activate license if no license.json found or on user action
/**
 * ✅ Activate license and store securely
 * @param {string} licenseKey
 * @param {string} organization
 * @param {string} licenseFilePath - Full path to license.json inside userData
 */
async function activateLicense(licenseKey, organization, licenseFilePath) {
  try {
    // ✅ Generate secure hardware fingerprint
    const deviceFingerprint = machineIdSync({ original: true })

    const response = await axios.post(`${SERVER_URL}/activate`, {
      licenseKey,
      organization,
      deviceFingerprint,
    })

    if (response.data.status === 'approved') {
      const signature = response.data.signature
      const licenseData = {
        licenseKey,
        organization,
        deviceFingerprint,
        signature,
      }
      // ✅ Store license.json securely in userData path
      await fs.ensureDir(path.dirname(licenseFilePath))
      await fs.writeJSON(licenseFilePath, licenseData, { spaces: 2 })
      console.log('✅ License activated and saved.')
      return {
        success: true,
        status: 'approved',
        message: 'Activated',
        data: licenseData,
      }
    } else {
      console.log('ℹ️ Activation pending:', response.data.message)
      return {
        success: false,
        status: response.data.status,
        message: response.data.message,
      }
    }
  } catch (err) {
    if (
      err.code === 'ECONNREFUSED' ||
      err.code === 'ENOTFOUND' ||
      err.message.includes('Network Error') ||
      err.message.includes('timeout')
    ) {
      await logError('Network error during license activation', err)
      console.error('❌ Network/server error during activation:', err.message)
      return {
        success: false,
        message:
          '❌ Cannot reach server to activate. Please check your network or try again later.',
      }
    }
    // ✅ Extract and return detailed message from server if available
    if (err.response && err.response.data && err.response.data.message) {
      await logError('Server responded with error during activation', err)
      console.error('❌ Activation error:', err.response.data.message)
      return {
        success: false,
        message: err.response.data.message,
      }
    }
    await logError('Unknown activation error', err)
    console.error('❌ Activation error:', err.message)
    return {
      success: false,
      message: err.message,
    }
  }
}

module.exports = { checkLicense, activateLicense }
