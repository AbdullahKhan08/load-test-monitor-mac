const ModbusRTU = require('modbus-serial')
const { updateStatus } = require('./utils')
const { isTestMetadataComplete } = require('./formManager')
const { renderChart } = require('./chartManager')
const state = require('./state') // CHANGED: Import state manager

const client = new ModbusRTU()
const POLLING_INTERVAL_MS = 1000

async function pollLoop() {
  if (!state.get('isPolling')) return // CHANGED

  try {
    const timestamp = new Date().toLocaleTimeString()
    const data = await client.readHoldingRegisters(0, 2) // 0x0001 and 0x0002
    const registers = data.data
    const high = registers[0]
    const low = registers[1]
    const combined = (high << 16) | low // 32-bit combined value
    const loadKg = combined * 10 // DLC-6 scaling
    const loadTons = loadKg / 1000 // Display in tons
    const loadKN = (loadKg * 9.80665) / 1000 // kg to kN conversion
    let peakValue = state.get('peakValue') || 0 // CHANGED
    if (loadTons > peakValue) {
      peakValue = loadTons
      state.set('peakValue', peakValue) // CHANGED
    }

    const chartData = state.get('chartData') || [] // CHANGED
    chartData.push({ time: timestamp, loadTons })
    state.set('chartData', chartData) // CHANGED
    renderChart(chartData, peakValue)

    document.getElementById('loadValue').innerText = `${loadTons.toFixed(
      3
    )} t / ${loadKN.toFixed(2)} kN`
    document.getElementById(
      'peakDisplay'
    ).innerText = `Peak Load ${peakValue.toFixed(3)} t`
    console.log(`✅ Live Load: (${loadTons.toFixed(3)} t) [Raw: ${combined}]`)
    document.getElementById(
      'lastTimestamp'
    ).innerText = `Last Update: ${timestamp}`

    // Append to table for tracking history
    const tableBody = document.getElementById('dataTableBody')
    const row = document.createElement('tr')
    row.innerHTML = `
            <td>${timestamp}</td>
            <td>${loadTons.toFixed(3)} t</td>
            <td>${loadKN.toFixed(2)} kN</td>
          `
    tableBody.appendChild(row)
    // Auto-scroll to bottom for live monitoring
    const logWrapper = document.getElementById('logWrapper')
    logWrapper.scrollTop = logWrapper.scrollHeight

    console.log(
      `✅ Load: ${loadKg.toFixed(1)} kg | ${loadTons.toFixed(
        3
      )} t | ${loadKN.toFixed(2)} kN at ${timestamp}`
    )
    // (Chart.js live graph will be added next)
  } catch (err) {
    console.error('⚠️ Polling error:', err)
    updateStatus('Status: Polling Error', 'error')
    cleanupPolling(
      global.globalStartButton,
      global.globalStopButton,
      global.globalDownloadButton
    )
    return // stop further polling on error
  } finally {
    setTimeout(pollLoop, POLLING_INTERVAL_MS)
  }
}

async function startPolling(startButton, stopButton, downloadButton) {
  // Disable Start temporarily to prevent double clicks while connecting
  global.globalStartButton = startButton
  global.globalStopButton = stopButton
  global.globalDownloadButton = downloadButton

  startButton.disabled = true
  stopButton.disabled = true
  downloadButton.disabled = true

  if (state.get('isPolling') || startPolling.locked) {
    console.warn('⚠️ Polling already in progress. Ignoring duplicate start.')
    alert('Polling is already running.')
    return
  }
  startPolling.locked = true

  if (!isTestMetadataComplete()) {
    alert(
      '⚠️ Calibration or Equipment data incomplete. Please save data before starting the test.'
    )
    updateStatus('Status: Data incomplete.', 'error')
    startButton.disabled = false
    startPolling.locked = false
    return
  }

  try {
    updateStatus('Status: Connecting...', 'info')

    if (!client.isOpen) {
      await client.connectTCP('127.0.0.1', { port: 8502 })
      //   await client.connectRTUBuffered('COM4', {
      //     baudRate: 9600,
      //     dataBits: 8,
      //     stopBits: 1,
      //     parity: 'none',
      //   })
      client.setID(0)

      console.log('✅ Connected to Modbus server.')
    } else {
      console.log('ℹ️ Modbus client already connected.')
    }

    updateStatus('Status: Connected. Polling...', 'success')
    startButton.disabled = true
    stopButton.disabled = false
    downloadButton.disabled = true
    state.set('isPolling', true) // CHANGED
    pollLoop()
  } catch (err) {
    console.error('❌ Connection error:', err)
    updateStatus('Status: Connection Failed', 'error')
    cleanupPolling(startButton, stopButton, downloadButton)
  } finally {
    startPolling.locked = false
  }
}

/** Safely stops polling, clears intervals, and resets state */
function cleanupPolling(startButton, stopButton, downloadButton) {
  if (client.isOpen) {
    client.close(() => console.log('ℹ️ Modbus client connection closed.'))
  }
  state.set('isPolling', false) // CHANGED
  startButton.disabled = false
  stopButton.disabled = true
  downloadButton.disabled = true
}

function stopPolling(startButton, stopButton, downloadButton) {
  console.log('🛑 Stopping polling...')
  cleanupPolling(startButton, stopButton, downloadButton)
  downloadButton.disabled = false
  updateStatus('Status: Stopped', 'warning')
  const chartData = state.get('chartData') // CHANGED
  const peakValue = state.get('peakValue') // CHANGED
  renderChart(chartData, peakValue)
}

function getPeakValue() {
  return state.get('peakValue') // CHANGED
}

// modbusManager.js
function resetPeakValue() {
  state.set('peakValue', 0) // CHANGED
}

function clearChartData() {
  state.set('chartData', []) // CHANGED
}

module.exports = {
  startPolling,
  stopPolling,
  cleanupPolling,
  clearChartData,
  resetPeakValue,
  getPeakValue,
  client,
}
