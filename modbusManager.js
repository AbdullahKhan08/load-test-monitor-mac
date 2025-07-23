const ModbusRTU = require('modbus-serial')
const { updateStatus, logError } = require('./utils')
const {
  isTestMetadataComplete,
  collectAndSaveCalibration,
  collectAndSaveEquipmentTest,
  populateTestMetadataFields,
} = require('./formManager')
const { renderChart, clearChart } = require('./chartManager')
const state = require('./state')

const client = new ModbusRTU()
const POLLING_INTERVAL_MS = 1000

async function connectDevice(port) {
  if (state.get('connectInProgress')) {
    console.warn('⏳ Connection attempt already in progress...')
    return false
  }

  state.set('connectInProgress', true)

  try {
    if (client.isOpen) {
      try {
        await client.readHoldingRegisters(0, 1)
        console.log('ℹ️ Client already connected.')
        updateStatus('Status: Already Connected', 'info')
        state.set('isDeviceConnected', true)
        disableConnectButton()
        return true
      } catch (testErr) {
        console.warn('⚠️ Client open but unresponsive. Forcing reconnect...')
        client.close()
      }
    }
    updateStatus(`Status: Connecting...`, 'info')
    // await client.connectTCP('127.0.0.1', { port: 8502 })
    await client.connectRTUBuffered(port, {
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
    })
    client.setID(0)
    console.log(`✅ Connected to device on ${port}.`)
    updateStatus(`Status: Device Connected`, 'success')
    state.set('isDeviceConnected', true)
    disableConnectButton()
    return true
  } catch (err) {
    await logError('❌ Device connection error', err)
    console.error('❌ Device connection error:', err)
    updateStatus('Status: Connection Failed', 'error')
    state.set('isDeviceConnected', false)
    enableConnectButton()
    return false
  } finally {
    state.set('connectInProgress', false)
  }
}

function disableConnectButton() {
  const btn = document.getElementById('connectButton')
  if (btn) btn.disabled = true
}

function enableConnectButton() {
  const btn = document.getElementById('connectButton')
  if (btn) btn.disabled = false
}

async function pollLoop() {
  if (!state.get('isPolling')) return

  try {
    const timestamp = new Date().toLocaleTimeString()
    const data = await client.readHoldingRegisters(0, 2)
    const registers = data.data
    const high = registers[0]
    const low = registers[1]
    const combined = (high << 16) | low
    const loadKg = combined * 10
    const loadTons = loadKg / 1000
    const loadKN = (loadKg * 9.80665) / 1000 // kg to kN conversion
    let peakValue = state.get('peakValue') || 0
    if (loadTons > peakValue) {
      peakValue = loadTons
      state.set('peakValue', peakValue)
    }
    const HOLD_THRESHOLD_TONS = 0.05 // 50kg
    const HOLD_PUSH_INTERVAL_MS = 5000 // 5 sec

    const lastLoad = state.get('lastLoadTons') || 0
    const lastPushTime = state.get('lastPushTime') || 0
    const now = Date.now()

    const loadChanged = Math.abs(loadTons - lastLoad) > HOLD_THRESHOLD_TONS
    const timeElapsed = now - lastPushTime > HOLD_PUSH_INTERVAL_MS

    if (loadChanged || timeElapsed) {
      const chartData = state.get('chartData') || []
      chartData.push({ time: timestamp, loadTons })
      state.set('chartData', chartData)
      state.set('lastLoadTons', loadTons)
      state.set('lastPushTime', now)
      try {
        renderChart(chartData, peakValue)
        const loadValueElem = document.getElementById('loadValue')
        const peakDisplayElem = document.getElementById('peakDisplay')
        const timeStampElem = document.getElementById('lastTimestamp')

        if (loadValueElem) {
          loadValueElem.innerText = `${loadTons.toFixed(
            3
          )} t / ${loadKN.toFixed(2)} kN`
        }
        if (peakDisplayElem) {
          peakDisplayElem.innerText = `Peak Load ${peakValue.toFixed(3)} t`
        }
        if (timeStampElem) {
          timeStampElem.innerText = `Last Update: ${timestamp}`
        }
      } catch (chartErr) {
        await logError('⚠️ Error rendering chart', chartErr)
        console.warn('⚠️ Chart update error:', chartErr)
      }

      // Append to table
      if (!document || !document.getElementById) {
        console.warn('⚠️ DOM not ready or detached. Skipping UI update.')
        return
      }

      const tableBody = document.getElementById('dataTableBody')
      const row = document.createElement('tr')
      row.innerHTML = `
              <td>${timestamp}</td>
              <td>${loadTons.toFixed(3)} t</td>
              <td>${loadKN.toFixed(2)} kN</td>
            `
      tableBody.appendChild(row)

      const logWrapper = document.getElementById('logWrapper')
      logWrapper.scrollTop = logWrapper.scrollHeight
    }
  } catch (err) {
    await logError('⚠️ Error During Load Test', err)
    console.error('⚠️Error During Load Test:', err)
    updateStatus('Status: Device disconnected. Retrying...', 'error')
    stopPolling(
      global.globalStartButton,
      global.globalStopButton,
      global.globalDownloadButton
    )
    setTimeout(async () => {
      const port = document.getElementById('serialPortSelect')?.value
      if (port) {
        await connectDevice(port)
      } else {
        console.warn('⚠️ No port selected. Cannot auto-reconnect.')
        updateStatus('Status: Error During Load Test', 'error')
      }
    }, 3000)
    return
  } finally {
    setTimeout(pollLoop, POLLING_INTERVAL_MS)
  }
}

async function startPolling(
  startButton,
  stopButton,
  downloadButton,
  calibrationForm,
  equipmentForm
) {
  // Disable Start temporarily to prevent double clicks while connecting
  if (!state.get('isDeviceConnected')) {
    alert('⚠️ Device not connected. Please connect before starting test.')
    updateStatus('Status: Device not connected', 'error')
    return
  }
  if (state.get('isPolling') || startPolling.locked) {
    console.warn('⚠️ Test is already in progress. Ignoring duplicate start.')
    alert('Test is already in Progress.')
    return
  }
  startPolling.locked = true
  if (!isTestMetadataComplete()) {
    alert('⚠️ Data Incomplete. Please Save Data Before Starting The Test.')
    updateStatus('Status: Data Incomplete.', 'error')
    startPolling.locked = false
    return
  }
  const success = collectAndSaveEquipmentTest(equipmentForm, calibrationForm)
  if (!success) {
    startPolling.locked = false
    return
  }
  await collectAndSaveCalibration(calibrationForm)
  try {
    updateStatus('Status: Load Test Started...', 'success')
    startButton.disabled = true
    stopButton.disabled = false
    downloadButton.disabled = true
    state.set('isPolling', true)
    pollLoop()
  } catch (err) {
    await logError('❌ Start Load Test Error', err)
    console.error('❌ Start Load Test Error:', err)
    updateStatus(`Status: Failed To Start Load Test`, 'error')
    stopPolling(startButton, stopButton, downloadButton)
    if (!state.get('isDeviceConnected')) {
      enableConnectButton()
    }
  } finally {
    startPolling.locked = false
  }
}
/** Safely stops polling, clears intervals, and resets state */
function cleanupPolling(startButton, stopButton, downloadButton) {
  state.set('isPolling', false)
  startButton.disabled = false
  stopButton.disabled = true
  downloadButton.disabled = true
}

function stopPolling(startButton, stopButton, downloadButton) {
  console.log('🛑 Stopping Load Test...')
  cleanupPolling(startButton, stopButton, downloadButton)
  downloadButton.disabled = false
  updateStatus('Status: Stopped', 'warning')
  renderChart(state.get('chartData') || [], state.get('peakValue') || 0)
}

function getPeakValue() {
  return state.get('peakValue')
}

function resetPeakValue() {
  state.set('peakValue', 0)
}

function clearChartData() {
  state.set('chartData', [])
}

async function closeClient() {
  return new Promise((resolve) => {
    try {
      if (client && client.isOpen) {
        client.close(async (err) => {
          if (err) {
            console.error('⚠️ Error closing Modbus client:', err)
            await logError('⚠️ Error closing Modbus client', err)
          } else {
            console.log('ℹ️ Modbus client connection closed.')
          }
          resolve()
        })
      } else {
        resolve()
      }
    } catch (err) {
      console.error('⚠️ Unexpected error closing Modbus client:', err)
      resolve()
    }
  })
}

async function resetTestApp(
  startButton,
  stopButton,
  downloadButton,
  equipmentForm
) {
  if (
    !confirm(
      '⚠️ Reset everything (data, device connection, and forms)? This cannot be undone.'
    )
  )
    return

  console.log('🔁 Performing full reset...')

  if (state.get('isPolling')) {
    stopPolling(startButton, stopButton, downloadButton)
  }
  await closeClient()
  const chartData = state.get('chartData') || []

  if (chartData.length !== 0 || state.get('chartInstance')) {
    clearChart()
    setTimeout(() => renderChart([], 0), 200)
    clearChartData()
  }
  state.set('isPolling', false)
  state.set('isDeviceConnected', false)
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
  state.set('lastLoadTons', 0)
  state.set('lastPushTime', 0)
  state.set('peakValue', 0)
  state.set('connectInProgress', false)

  // Clear UI elements
  document.getElementById('loadValue').innerText = '0.000 t / 0.00 kN'
  document.getElementById('lastTimestamp').innerText = 'Last Update: -'
  document.getElementById('peakDisplay').innerText = 'Peak Load: 0.000 t'
  document.getElementById('proofLoadDisplay').innerText = 'Proof Load: 0.000 t'

  const tableBody = document.getElementById('dataTableBody')
  if (tableBody) tableBody.innerHTML = ''
  const logWrapper = document.getElementById('logWrapper')
  if (logWrapper) logWrapper.scrollTop = 0
  enableConnectButton()
  if (equipmentForm) {
    equipmentForm.reset()
  } else {
    console.warn('⚠️ Equipment form not found during reset.')
  }
  populateTestMetadataFields()
  updateStatus('Status: Ready. Connect device to begin.', 'info')
}

module.exports = {
  startPolling,
  connectDevice,
  stopPolling,
  cleanupPolling,
  clearChartData,
  resetPeakValue,
  getPeakValue,
  client,
  resetTestApp,
  closeClient,
}
