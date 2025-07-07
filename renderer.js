const {
  loadMasterCalibration,
  collectAndSaveCalibration,
  collectAndSaveEquipmentTest,
  resetEquipmentData,
  isTestMetadataComplete,
} = require('./formManager')
const { updateStatus } = require('./utils')
const {
  startPolling,
  stopPolling,
  clearChartData,
  resetPeakValue,
} = require('./modbusManager')
const { downloadReport } = require('./reportManager')
const { clearChart } = require('./chartManager')
const state = require('./state')
const { loadSettings, saveSettings, saveLogo } = require('./settingsManager')

const calibrationForm = document.getElementById('masterCalibrationForm')
const equipmentForm = document.getElementById('equipmentTestForm')
const startButton = document.getElementById('startButton')
const stopButton = document.getElementById('stopButton')
const downloadButton = document.getElementById('downloadButton')
const clearDataButton = document.getElementById('clearDataButton')

startButton.disabled = false
stopButton.disabled = true
downloadButton.disabled = true

// ✅ Load calibration data on startup, passing the form explicitly
window.addEventListener('DOMContentLoaded', () => {
  if (calibrationForm) {
    loadMasterCalibration(calibrationForm)
    clearChart()
  }
})
window.addEventListener('DOMContentLoaded', () => {
  loadSettingsIntoForm()
})

function loadSettingsIntoForm() {
  const settings = state.get('settings') || {}
  document.getElementById('companyNameInput').value =
    settings.companyName || 'Samaa Aerospace LLP'
  const logoPreview = document.getElementById('logoPreview')
  if (settings.logoPath) {
    logoPreview.src = settings.logoPath
  } else {
    logoPreview.src = 'assets/placeholder-logo.png' // fallback
  }
}

document.getElementById('logoUploadInput').addEventListener('change', (e) => {
  const file = e.target.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    alert('⚠️ Please upload a valid image file.')
    return
  }
  saveLogo(file.path)
  document.getElementById('logoPreview').src = './settings/logo.png'
  alert('✅ Logo updated.')
})

document.getElementById('settingsForm').addEventListener('submit', (e) => {
  e.preventDefault()
  const companyName = document.getElementById('companyNameInput').value.trim()
  if (!companyName) {
    alert('⚠️ Company name cannot be empty.')
    return
  }
  const currentSettings = state.get('settings') || {}
  currentSettings.companyName = companyName
  saveSettings(currentSettings)
  alert('✅ Settings saved.')
})

// function downloadReport() {

//   try {
//     const footerHeight = 15
//     const downloadButton = document.getElementById('downloadButton')
//     downloadButton.disabled = true
//     if (
//       !testMetadata ||
//       typeof testMetadata !== 'object' ||
//       Object.keys(testMetadata).length === 0
//     ) {
//       alert('⚠️ No test metadata available. Please start polling first.')
//       downloadButton.disabled = false
//       return
//     }

//     const tableData = getTableData()
//     if (!Array.isArray(tableData) || tableData.length === 0) {
//       alert('⚠️ No test data recorded.')
//       downloadButton.disabled = false
//       return
//     }
//     const reportsDir = path.join(__dirname, 'reports')
//     if (!fs.existsSync(reportsDir)) {
//       fs.mkdirSync(reportsDir)
//     }

//     const fileName = `Load_Test_Certificate_${new Date()
//       .toISOString()
//       .replace(/[:.]/g, '-')}.pdf`
//     const filePath = path.join(reportsDir, fileName)

//     const doc = new PDFDocument({ margin: 50, autoFirstPage: true })
//     const stream = fs.createWriteStream(filePath)
//     doc.pipe(stream)

//     let pageNumber = 0

//     function addFooter() {
//       try {
//         pageNumber++ // increment first

//         const bottom = doc.page.margins.bottom
//         doc.page.margins.bottom = 0
//         const footerY = doc.page.height - 40
//         // Always show company name on ALL pages
//         doc
//           .fontSize(10)
//           .fillColor('gray')
//           .text('Samaa Aerospace LLP', 50, footerY, { align: 'left' })

//         // Show page number only from page 2 onwards
//         if (pageNumber > 1) {
//           doc.text(`Page ${pageNumber}`, -50, doc.page.height - 40, {
//             align: 'right',
//           })
//         }
//         doc.text('', 50, 50) // reset cursor
//         doc.page.margins.bottom = bottom
//       } catch (err) {
//         console.error('⚠️ Footer rendering error:', err)
//       }
//     }

//     addFooter() // Footer on first page
//     doc.on('pageAdded', addFooter)

//     const x = doc.page.margins.left
//     let y = doc.page.margins.top
//     const rowHeight = 20
//     const companyName = testMetadata.companyName || 'AAR Indamer Technics'
//     const logoPath = path.join(__dirname, 'assets', 'indamer.png')
//     if (fs.existsSync(logoPath)) {
//       const logoWidth = 80
//       const logoHeight = 60
//       const logoX = doc.page.width - doc.page.margins.right - logoWidth
//       const logoY = doc.page.margins.top
//       doc.image(logoPath, logoX, logoY, {
//         width: logoWidth,
//         height: logoHeight,
//       })
//     }

//     doc
//       .fontSize(14)
//       .font('Helvetica-Bold')
//       .fillColor('black')
//       .text(companyName, { align: 'center' })
//     y = doc.y + 10

//     // === HEADER ===
//     doc.fontSize(12).fillColor('black').text(`Load Test Certificate`, {
//       align: 'center',
//       continued: false,
//     })

//     // Add slight vertical spacing
//     y = doc.y + 5

//     // Test Date with "value" bold
//     const testDate = new Date().toLocaleDateString()
//     //  Calculate certificate validity (1 year from test date)
//     const validityDate = new Date()
//     validityDate.setFullYear(validityDate.getFullYear() + 1)
//     const validityDateStr = validityDate.toLocaleDateString()
//     doc
//       .fontSize(8)
//       .fillColor('black')
//       .font('Helvetica')
//       .text('Test Date: ', x, y, { continued: true })
//       .font('Helvetica-Bold')
//       .text(testDate)
//     y = doc.y + 7 // add extra space before metadata block
//     doc
//       .fontSize(8)
//       .fillColor('black')
//       .font('Helvetica')
//       .text('Certificate Valid Upto: ', x, y, { continued: true })
//       .font('Helvetica-Bold')
//       .text(validityDateStr)

//     y = doc.y + 15 // Adjust spacing before metadata table

//     // === METADATA TABLE ===
//     // 1) Remove redundant keys and remove proofLoad
//     const metadataEntries = Object.entries(testMetadata).filter(
//       ([key]) => !['testedBy', 'certifiedBy', 'proofLoad'].includes(key)
//     )

//     const calibrationEntries = Object.entries(testMetadata.calibration || {})
//     const equipmentEntries = Object.entries(testMetadata.equipment || {})

//     const filteredEquipmentEntries = equipmentEntries.filter(
//       ([key]) =>
//         ![
//           'proofLoad',
//           'testedBy',
//           'certifiedBy',
//           'certificateValidity',
//         ].includes(key)
//     )

//     // 2) Segregate Master & Tested fields while maintaining current field names
//     const masterFieldKeys = [
//       'loadCellPartNo',
//       'loadCellSerialNo',
//       'loadCellModelNo',
//       'loadCellLastCalibrationDate',
//       'loadCellCalibrationValidity',
//       'displayPartNo',
//       'displaySerialNo',
//       'displayModelNo',
//       'displayLastCalibrationDate',
//       'displayCalibrationValidity',
//     ]
//     const testedFieldKeys = [
//       'equipmentName',
//       'typeOfEquipment',
//       'equipmentPartNo',
//       'equipmentSerialNo',
//       'equipmentModelNo',
//       'yearOfManufacture',
//       'ratedLoadCapacity',
//       'proofLoadPercentage',
//       'location',
//     ]

//     // const masterEntries = metadataEntries.filter(([key]) =>
//     //   masterFieldKeys.includes(key)
//     // )
//     // const testedEntries = metadataEntries.filter(([key]) =>
//     //   testedFieldKeys.includes(key)
//     // )

//     const masterEntries = calibrationEntries
//     const testedEntries = equipmentEntries

//     const renderSection = (title, entries) => {
//       // Add section heading
//       doc
//         .fontSize(10)
//         .font('Helvetica-Bold')
//         .fillColor('black')
//         .text(title, x, y)
//       y = doc.y + 5
//       doc.fontSize(9).font('Helvetica')

//       const half = Math.ceil(entries.length / 2)
//       const leftEntries = entries.slice(0, half)
//       const rightEntries = entries.slice(half)

//       const colGap = 30
//       const colWidth =
//         (doc.page.width -
//           doc.page.margins.left -
//           doc.page.margins.right -
//           colGap) /
//         2
//       const keyWidth = 130 // slightly increased for breathing space
//       const valueWidth = colWidth - keyWidth - 10
//       const adjustedRowHeight = 22

//       for (let i = 0; i < half; i++) {
//         const left = leftEntries[i]
//         const right = rightEntries[i]
//         let rowHeight = adjustedRowHeight

//         if (left) {
//           const [keyL, valueL] = left
//           const cleanKeyL = keyL
//             .replace(/([A-Z])/g, ' $1')
//             .replace(/^./, (s) => s.toUpperCase())
//             .trim()
//           const hL = Math.max(
//             doc.heightOfString(`${cleanKeyL}:`, { width: keyWidth }),
//             doc.heightOfString(valueL, { width: valueWidth })
//           )
//           rowHeight = Math.max(rowHeight, hL + 6)
//         }
//         if (right) {
//           const [keyR, valueR] = right
//           const cleanKeyR = keyR
//             .replace(/([A-Z])/g, ' $1')
//             .replace(/^./, (s) => s.toUpperCase())
//             .trim()
//           const hR = Math.max(
//             doc.heightOfString(`${cleanKeyR}:`, { width: keyWidth }),
//             doc.heightOfString(valueR, { width: valueWidth })
//           )
//           rowHeight = Math.max(rowHeight, hR + 6)
//         }

//         // Shading
//         if (i % 2 === 0) {
//           doc.save()
//           doc.rect(x, y, colWidth * 2 + colGap, rowHeight).fill('#f9f9f9')
//           doc.restore()
//         }

//         if (left) {
//           const [keyL, valueL] = left
//           const cleanKeyL = keyL
//             .replace(/([A-Z])/g, ' $1')
//             .replace(/^./, (s) => s.toUpperCase())
//             .trim()
//           doc
//             .fillColor('black')
//             .text(`${cleanKeyL}:`, x + 5, y + 3, { width: keyWidth })
//           doc.text(`${valueL}`, x + 5 + keyWidth, y + 3, { width: valueWidth })
//         }
//         if (right) {
//           const [keyR, valueR] = right
//           const cleanKeyR = keyR
//             .replace(/([A-Z])/g, ' $1')
//             .replace(/^./, (s) => s.toUpperCase())
//             .trim()
//           const rightX = x + colWidth + colGap
//           doc
//             .fillColor('black')
//             .text(`${cleanKeyR}:`, rightX + 5, y + 3, { width: keyWidth })
//           doc.text(`${valueR}`, rightX + 5 + keyWidth, y + 3, {
//             width: valueWidth,
//           })
//         }

//         y += rowHeight
//       }

//       y += 15 // spacing between sections
//     }

//     // === Render the sections ===
//     renderSection('Master Calibration Data', masterEntries)
//     renderSection('Tested Equipment Data', filteredEquipmentEntries)

//     y += 10 // Padding before chart

//     const chartCanvas = document.getElementById('loadChart')
//     if (chartCanvas) {
//       const chartImage = chartCanvas.toDataURL('image/png')
//       const pageWidth =
//         doc.page.width - doc.page.margins.left - doc.page.margins.right
//       const imageWidth = pageWidth
//       const imageHeight = 225
//       const imageX = doc.page.margins.left + (pageWidth - imageWidth) / 2

//       doc
//         .fontSize(10)
//         .fillColor('black')
//         .text('Load vs Time Chart:', doc.page.margins.left, y, {
//           align: 'center',
//           width: pageWidth, // ensure true centering
//         })
//       y = doc.y + 5
//       doc.image(chartImage, imageX, y, {
//         width: imageWidth,
//         height: imageHeight,
//       })
//       y += imageHeight + 10

//       doc
//         .fontSize(10)
//         .font('Helvetica-Bold')
//         .fillColor('black')
//         .text(
//           `Peak Load During Test: ${peakValue.toFixed(3)} t`,

//           doc.page.margins.left,
//           y,
//           {
//             align: 'center',
//             width: pageWidth, // ensure true centering
//           }
//         )
//       y = doc.y + 15
//       doc
//         .font('Helvetica-Bold')
//         .fontSize(10)
//         .fillColor('black')
//         .text(`Proof Load Test Value: ${testMetadata.equipment.proofLoad} t`, {
//           align: 'center',
//         })
//       y = doc.y + 15
//       //   y += imageHeight + 20
//     }
//     y += 20
//     // === SIGNATURE BLOCK ===
//     doc
//       .font('Helvetica-Bold')
//       .fontSize(9)
//       .text(`Tested By: ${testMetadata.equipment.testedBy || ''}`, x, y)
//       .text(
//         `Certified By: ${testMetadata.equipment.certifiedBy || ''}`,
//         x + 250,
//         y
//       )
//     y += 15
//     // doc.font('Helvetica').text(`Location: ${testMetadata.location || ''}`, x, y)
//     // y += 15

//     // === FORCE TEST DATA TO NEW PAGE ===
//     doc.addPage()
//     y = doc.page.margins.top
//     // doc.fontSize(14).text('Test Data:', { underline: true })
//     y = doc.y + 10

//     const colTimeWidth = 180
//     const colTonsWidth = 160
//     const colkNWidth = 160

//     // Test Data Table Header
//     doc.save()
//     doc
//       .rect(x, y, colTimeWidth + colTonsWidth + colkNWidth, rowHeight)
//       .fill('#e6e6e6')
//     doc
//       .fillColor('black')
//       .font('Helvetica-Bold')
//       .fontSize(10)
//       .text('Timestamp', x + 5, y + 5, { width: colTimeWidth - 10 })
//       .text('Load (t)', x + colTimeWidth + 5, y + 5, {
//         width: colTonsWidth - 10,
//         align: 'center',
//       })
//       .text('Load (kN)', x + colTimeWidth + colTonsWidth + 5, y + 5, {
//         width: colkNWidth - 10,
//         align: 'center',
//       })
//     doc.restore()
//     y += rowHeight

//     tableData.forEach((row, index) => {
//       if (
//         y + rowHeight >
//         doc.page.height - doc.page.margins.bottom - footerHeight - 10
//       ) {
//         doc.addPage()
//         y = doc.page.margins.top

//         // Redraw table header
//         doc.save()
//         doc
//           .rect(x, y, colTimeWidth + colTonsWidth + colkNWidth, rowHeight)
//           .fill('#e6e6e6')
//         doc
//           .fillColor('black')
//           .font('Helvetica-Bold')
//           .fontSize(10)
//           .text('Timestamp', x + 5, y + 5, { width: colTimeWidth - 10 })
//           .text('Load (t)', x + colTimeWidth + 5, y + 5, {
//             width: colTonsWidth - 10,
//             align: 'center',
//           })
//           .text('Load (kN)', x + colTimeWidth + colTonsWidth + 5, y + 5, {
//             width: colkNWidth - 10,
//             align: 'center',
//           })
//         doc.restore()
//         y += rowHeight
//       }

//       doc.save()
//       if (index % 2 === 0) {
//         doc
//           .rect(x, y, colTimeWidth + colTonsWidth + colkNWidth, rowHeight)
//           .fill('#f9f9f9')
//       }
//       doc.restore()

//       doc
//         .fillColor('black')
//         .font('Helvetica')
//         .fontSize(10)
//         .text(row[0] || '', x + 5, y + 5, { width: colTimeWidth - 10 })
//         .text(row[1] || '', x + colTimeWidth + 5, y + 5, {
//           width: colTonsWidth - 10,
//           align: 'center',
//         })
//         .text(row[2] || '', x + colTimeWidth + colTonsWidth + 5, y + 5, {
//           width: colkNWidth - 10,
//           align: 'center',
//         })
//       y += rowHeight
//     })

//     // y += 30

//     doc.end()

//     stream.on('finish', () => {
//       alert(`✅ PDF report saved as ${fileName}`)
//       const testsFilePath = path.join(reportsDir, 'tests.json')
//       let tests = []
//       if (fs.existsSync(testsFilePath)) {
//         try {
//           tests = JSON.parse(fs.readFileSync(testsFilePath, 'utf-8'))
//         } catch (e) {
//           console.error(
//             '⚠️ Could not parse existing tests.json. Initializing fresh.',
//             e
//           )
//         }
//       }

//       tests.push({
//         id: new Date().toISOString(),
//         metadata: testMetadata,
//         chartData: chartData,
//         peakValue: peakValue,
//         filePath: filePath,
//       })

//       fs.writeFileSync(testsFilePath, JSON.stringify(tests, null, 2))
//       console.log('✅ Test data appended to tests.json')

//       console.log(`📄 PDF report saved: ${filePath}`)
//       // ✅ Reset form fields
//       //   form.reset()
//       // ✅ Clear live data table
//       chartData = []
//       peakValue = 0
//       document.getElementById('dataTableBody').innerHTML = ''
//       // ✅ Reset equipment form ONLY (not calibration form)
//       const equipmentForm = document.getElementById('equipmentTestForm')
//       if (equipmentForm) equipmentForm.reset()

//       // ✅ Optionally reset status and live readings
//       //   document.getElementById('loadValue').innerText = ''
//       //   document.getElementById('lastTimestamp').innerText = ''
//       startButton.disabled = false
//       stopButton.disabled = true
//       updateStatus('Status: Ready', 'info')
//       downloadButton.disabled = false
//     })

//     stream.on('error', (err) => {
//       console.error('❌ PDF generation error:', err)
//       alert('❌ Failed to generate PDF report. Check console for details.')
//       downloadButton.disabled = false
//     })
//   } catch (err) {
//     console.error('❌ Unexpected error during PDF generation:', err)
//     alert('❌ Unexpected error during PDF generation.')
//     document.getElementById('downloadButton').disabled = false
//   }
// }

// Button Bindings

// ✅ Start Polling with final validation
startButton.addEventListener('click', () => {
  if (!isTestMetadataComplete()) {
    alert(
      '⚠️ Calibration or Equipment data incomplete. Please save all data before starting.'
    )
    updateStatus('Status: Data incomplete.', 'error')
    return
  }
  startPolling(startButton, stopButton, downloadButton)
})

stopButton.addEventListener('click', () =>
  stopPolling(startButton, stopButton, downloadButton)
)

document
  .getElementById('saveCalibrationButton')
  .addEventListener('click', (e) => {
    e.preventDefault()
    if (calibrationForm) {
      collectAndSaveCalibration(calibrationForm)
    }
  })

document
  .getElementById('saveEquipmentButton')
  .addEventListener('click', (e) => {
    e.preventDefault()
    if (equipmentForm) {
      collectAndSaveEquipmentTest(equipmentForm)
    }
  })

// ✅ Download Report with final validation
downloadButton.addEventListener('click', () => {
  if (!isTestMetadataComplete()) {
    alert(
      '⚠️ Calibration or Equipment data incomplete. Please save all data before downloading report.'
    )
    updateStatus('Status: Data incomplete.', 'error')
    return
  }
  downloadReport(startButton, stopButton, downloadButton)
})

clearDataButton.addEventListener('click', () => {
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
      console.log('✅ Polling stopped due to data clear.')
    }
    // Clear chart data and reset visuals
    clearChartData()
    resetPeakValue()
    clearChart()

    // Clear data table
    document.getElementById('dataTableBody').innerHTML = ''

    // Clear displayed values

    document.getElementById('loadValue').innerText = '0.000 t / 0.00 kN'
    document.getElementById('lastTimestamp').innerText = 'Last Update: -'
    document.getElementById('peakDisplay').innerText = 'Peak Load: 0.000 t'
    document.getElementById('proofLoadDisplay').innerText =
      'Proof Load: 0.000 t'

    if (equipmentForm) equipmentForm.reset()
    // Preserve calibration, clear only equipment
    // Clear equipment data in state while preserving calibration
    resetEquipmentData()
    // Reset buttons
    updateStatus('Status: Ready', 'info')
    startButton.disabled = false
    stopButton.disabled = true
    alert('✅ Data cleared.')
  }
})
