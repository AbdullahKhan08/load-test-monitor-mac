const { ipcRenderer } = require('electron')
const {
  loadMasterCalibration,
  collectAndSaveCalibration,
  collectAndSaveEquipmentTest,
  isTestMetadataComplete,
  populateTestMetadataFields,
} = require('./formManager')
const { updateStatus, logError } = require('./utils')
const path = require('path')
const {
  startPolling,
  stopPolling,
  clearChartData,
  resetPeakValue,
  connectDevice,
  resetTestApp,
  closeClient,
} = require('./modbusManager')
const { activateLicense } = require('./licenseManager')
const { downloadReport } = require('./reportManager')
const { clearChart, renderChart } = require('./chartManager')
const state = require('./state')
const { loadSettings, saveSettings } = require('./settingsManager')
const { loadReports } = require('./reports')

// ------------------- Constants --------------------
const calibrationForm = document.getElementById('masterCalibrationForm')
const equipmentForm = document.getElementById('equipmentTestForm')
const startButton = document.getElementById('startButton')
const stopButton = document.getElementById('stopButton')
const downloadButton = document.getElementById('downloadButton')
const clearDataButton = document.getElementById('clearDataButton')
const connectButton = document.getElementById('connectButton')
const resetButton = document.getElementById('resetButton')

// 🧠 Make sure these global references exist
global.globalStartButton = startButton
global.globalStopButton = stopButton
global.globalDownloadButton = downloadButton
global.globalConnectButton = connectButton
global.globalResetButton = resetButton

startButton.disabled = true
stopButton.disabled = true
downloadButton.disabled = true

// ------------------- License Helper --------------------
async function getLicenseFilePath() {
  try {
    const userDataPath = await ipcRenderer.invoke('get-user-data-path')
    return path.join(userDataPath, 'license.json')
  } catch (err) {
    await logError('getting user data path failed', err)
  }
}

// ✅ Page toggle helpers
function showActivationPage() {
  document.getElementById('activationPage').style.display = 'block'
  document.getElementById('mainAppPage').style.display = 'none'
}

function showMainApp() {
  document.getElementById('activationPage').style.display = 'none'
  document.getElementById('mainAppPage').style.display = 'block'
}

// ------------------- DOMContentLoaded --------------------
window.addEventListener('DOMContentLoaded', async () => {
  const activationStatus = document.getElementById('activationStatus')
  activationStatus.innerText = 'Checking license...'
  try {
    const result = await ipcRenderer.invoke('check-license')
    if (result.valid) {
      showMainApp()
      activationStatus.innerText = '✅ License valid. Loading app...'
    } else {
      showActivationPage()
      activationStatus.innerText = '⚠️ ' + result.message
    }
  } catch (err) {
    console.error('❌ License check failed:', err.message)
    showActivationPage()
    activationStatus.innerText = '⚠️ ' + err.message
    await logError(err.message, err)
  }
  try {
    if (typeof loadMasterCalibration === 'function' && calibrationForm) {
      await loadMasterCalibration(calibrationForm)
      setTimeout(() => renderChart([], 0), 200)
    }
    await loadSettings()
    setTimeout(() => {
      loadSettingsIntoForm()
      loadLogoPreview()
      const settings = state.get('settings') || {}
      const locationInput = document.querySelector(
        '#equipmentTestForm [name="location"]'
      )
      if (
        locationInput &&
        (!locationInput.value || locationInput.value.trim() === '') &&
        settings.defaultTestLocation
      ) {
        locationInput.value = settings.defaultTestLocation
      }
    }, 100)
    await populateSerialPorts()
    await loadReports()
  } catch (err) {
    await logError('Error loading settings on startup:', err)
    console.error('❌ Error loading settings on startup:', err)
  }
  const testDateInput = document.querySelector(
    '#equipmentTestForm [name="testDate"]'
  )
  if (testDateInput && !testDateInput.value) {
    const today = new Date().toISOString().split('T')[0]
    testDateInput.value = today
  }
  const searchInput = document.getElementById('reportSearch')
  if (searchInput) {
    searchInput.addEventListener('input', async () => {
      await loadReports()
    })
  }
})

// ------------------- Activation Handler --------------------
document.getElementById('activateBtn').addEventListener('click', async () => {
  const licenseKey = document.getElementById('licenseKeyInput').value.trim()
  const organization = document.getElementById('organizationInput').value.trim()
  const activationStatus = document.getElementById('activationStatus')
  const spinner = document.getElementById('spinner')

  if (!licenseKey || !organization) {
    activationStatus.innerText = '⚠️ Please fill in all fields.'
    return
  }
  activationStatus.innerText = 'Activating...'
  spinner.style.display = 'block'
  try {
    const licenseFilePath = await getLicenseFilePath()
    const result = await activateLicense(
      licenseKey,
      organization,
      licenseFilePath
    )
    if (result.success && result.status === 'approved') {
      activationStatus.innerText = '✅ License activated. Restarting...'
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } else if (result.status === 'pending') {
      activationStatus.innerText = 'ℹ️ ' + result.message
    } else {
      activationStatus.innerText = '❌ ' + result.message
    }
  } catch (err) {
    activationStatus.innerText = '❌ Activation failed. Try again.'
    console.error('Activation error:', err)
    await logError('License activation error', err)
  } finally {
    spinner.style.display = 'none'
  }
})

// ------------------- Logo Upload --------------------
document.getElementById('uploadLogoBtn').addEventListener('click', async () => {
  try {
    const filePath = await ipcRenderer.invoke('select-logo')
    if (!filePath || filePath.success === false) {
      console.error(
        'Logo selection failed:',
        filePath?.error || 'No file selected'
      )
      await logError('Logo selection failed:', filePath.error)
      return
    }
    const settings = state.get('settings') || {}
    settings.logoPath = filePath
    state.set('settings', settings)
    await saveSettings(settings)
    loadLogoPreview()
  } catch (error) {
    console.error('❌ Error uploading logo:', error)
    await logError('Renderer failed to upload logo', error)
  }
})

function loadLogoPreview() {
  const settings = state.get('settings') || {}
  const logoPreview = document.getElementById('logoPreview')
  if (logoPreview && settings.logoPath) {
    logoPreview.src = `file://${settings.logoPath}?t=${Date.now()}`
  }
}

function loadSettingsIntoForm() {
  const settings = state.get('settings') || {}
  document.getElementById('companyNameInput').value =
    settings.companyName || 'Your Company Name'
  document.getElementById('defaultLocationInput').value =
    settings.defaultTestLocation || 'Your Default Location'
}

// ------------------- Settings Form Save --------------------
document
  .getElementById('settingsForm')
  .addEventListener('submit', async (e) => {
    e.preventDefault()

    const companyName = document.getElementById('companyNameInput').value.trim()
    const defaultLocation = document
      .getElementById('defaultLocationInput')
      .value.trim()

    if (!companyName || !defaultLocation) {
      alert('⚠️ Please fill all required fields.')
      return
    }
    const currentSettings = state.get('settings') || {}
    currentSettings.companyName = companyName
    currentSettings.defaultTestLocation = defaultLocation

    try {
      await saveSettings(currentSettings)
      alert('✅ Settings saved.')
    } catch (err) {
      console.error('❌ Error saving settings:', err)
      updateStatus('Status: Failed to save settings.', 'error')
    }
  })

// ------------------- Serial Port Logic --------------------
async function populateSerialPorts() {
  try {
    const response = await ipcRenderer.invoke('list-serial-ports')
    if (!response.success) {
      throw new Error(response.error || 'Unknown error')
    }
    const ports = response.ports
    const select = document.getElementById('serialPortSelect')
    select.innerHTML = '<option value="">Select Serial Port</option>'
    ports.forEach((port) => {
      const option = document.createElement('option')
      option.value = port.path
      option.textContent = `${port.path} (${port.manufacturer || 'Unknown'})`
      select.appendChild(option)
    })
    updateStatus('Status: Device interface ready', 'success')
  } catch (err) {
    console.error('❌ Failed to list serial ports:', err)
    await logError('Failed to list serial ports:', err)
    updateStatus('Status: Device Not Ready', 'error')
  }
}

// ------------------- Button Events --------------------

document
  .getElementById('refreshPortsBtn')
  .addEventListener('click', async () => {
    await populateSerialPorts()
    updateStatus('Status: Serial ports refreshed', 'info')
  })

document.getElementById('connectButton').addEventListener('click', async () => {
  try {
    const selectedPort = document.getElementById('serialPortSelect').value
    if (!selectedPort) {
      alert('⚠️ Please Select a Port To Connect.')
      updateStatus('Status: No Port Selected', 'error')
      return
    }
    if (state.get('connectInProgress')) {
      alert('⏳ Connection already in progress...')
      return
    }

    const connected = await connectDevice(selectedPort)
    updateStatus(
      connected ? `Status: Device Connected` : 'Status: Connection failed',
      connected ? 'success' : 'error'
    )
    startButton.disabled = !connected
  } catch (err) {
    await logError('Device Connection failed', err)
  }
})

startButton.addEventListener('click', async () => {
  if (!isTestMetadataComplete()) {
    alert('⚠️ Data Incomplete. Please Save All Data Before Starting.')
    updateStatus('Status: Data Incomplete.', 'error')
    return
  }
  await startPolling(
    startButton,
    stopButton,
    downloadButton,
    calibrationForm,
    equipmentForm
  )
})

stopButton.addEventListener('click', () =>
  stopPolling(startButton, stopButton, downloadButton)
)

document
  .getElementById('saveCalibrationButton')
  .addEventListener('click', async (e) => {
    e.preventDefault()
    if (calibrationForm) {
      await collectAndSaveCalibration(calibrationForm)
    }
  })

document
  .getElementById('saveEquipmentButton')
  .addEventListener('click', async (e) => {
    e.preventDefault()
    if (equipmentForm && calibrationForm) {
      await collectAndSaveEquipmentTest(equipmentForm, calibrationForm)
    } else {
      console.warn('❌ Form(s) not found in DOM')
    }
  })

// ✅ Download Report with final validation
downloadButton.addEventListener('click', () => {
  if (!isTestMetadataComplete()) {
    alert('⚠️ Data Incomplete. Please Save All Data Before Downloading Report.')
    updateStatus('Status: Data Incomplete.', 'error')
    return
  }
  downloadReport(startButton, stopButton, downloadButton)
})

clearDataButton.addEventListener('click', async () => {
  const chartData = state.get('chartData') || []
  const tableHasData =
    document.getElementById('dataTableBody').children.length > 0
  if (chartData.length === 0 && !tableHasData) {
    alert('⚠️ No data to clear.')
    return
  }

  if (confirm('Clear all collected data? This cannot be undone.')) {
    if (state.get('isPolling')) {
      stopPolling(startButton, stopButton, downloadButton)
      console.log('✅ Test Stopped due to data clear.')
    }
    try {
      await closeClient()
    } catch (err) {
      console.error('⚠️ Error closing Modbus client:', err)
      await logError('Error closing Modbus client:', err)
    }
    state.set('isDeviceConnected', false)
    state.set('connectInProgress', false)

    // Clear chart data and reset visuals
    clearChart()
    setTimeout(() => renderChart([], 0), 200)
    clearChartData()
    resetPeakValue()

    // Clear displayed values
    document.getElementById('dataTableBody').innerHTML = ''
    document.getElementById('loadValue').innerText = '0.000 t / 0.00 kN'
    document.getElementById('lastTimestamp').innerText = 'Last Update: -'
    document.getElementById('peakDisplay').innerText = 'Peak Load: 0.000 t'
    document.getElementById('proofLoadDisplay').innerText =
      'Proof Load: 0.000 t'

    if (equipmentForm) equipmentForm.reset()
    const currentMetadata = state.get('testMetadata') || {}
    const settings = state.get('settings') || {}

    const preservedFields = {
      calibration: currentMetadata.calibration || {},
      equipment: {
        testDate:
          currentMetadata.equipment?.testDate ||
          new Date().toISOString().split('T')[0],
        location:
          currentMetadata.equipment?.location ||
          settings.defaultTestLocation ||
          'Default Test Location',
        testedBy: currentMetadata.equipment?.testedBy || '',
        certifiedBy: currentMetadata.equipment?.certifiedBy || '',
      },
    }

    state.set('testMetadata', {
      ...preservedFields,
    })
    populateTestMetadataFields()
    // Reset buttons
    updateStatus('Status: Ready. Connect device to begin.', 'info')
    connectButton.disabled = false
    startButton.disabled = false
    stopButton.disabled = true
    downloadButton.disabled = true
    alert('✅ Data cleared.')
  }
})

resetButton.addEventListener('click', async () => {
  try {
    const equipmentForm = document.getElementById('equipmentTestForm')
    await resetTestApp(
      global.globalStartButton,
      global.globalStopButton,
      global.globalDownloadButton,
      equipmentForm
    )
  } catch (err) {
    await logError('Resetting app failed', err)
  }
})
