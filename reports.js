const fs = require('fs')
const path = require('path')
const os = require('os')
const { shell } = require('electron')
const { ipcRenderer } = require('electron')
const { logError } = require('./utils')

function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

async function loadReports() {
  const userDataPath = await ipcRenderer.invoke('get-user-data-path')
  const testDataDir = path.join(userDataPath, 'Test Data')
  const testsFilePath = path.join(testDataDir, 'tests.json')
  const backupDir = path.join(testDataDir, 'PDFs')
  const reportsList = document.getElementById('reportsList')
  if (!reportsList) {
    console.warn('⚠️ reportsList element not found')
    return
  }
  reportsList.innerHTML = ''

  try {
    if (!fs.existsSync(testsFilePath)) {
      reportsList.innerHTML = '<p>No reports found.</p>'
      return
    }

    const data = fs.readFileSync(testsFilePath, 'utf-8')
    const tests = JSON.parse(data)

    if (!Array.isArray(tests) || tests.length === 0) {
      reportsList.innerHTML = '<p>No reports found.</p>'
      return
    }

    // sorting LogarithmicScale, testing
    tests.sort((a, b) => {
      const dateA = new Date(a.metadata?.equipment?.testDate || 0)
      const dateB = new Date(b.metadata?.equipment?.testDate || 0)
      return dateB - dateA // Descending: newest first
    })

    let matchFound = false
    // Search input cleanup
    const rawSearch = document.getElementById('reportSearch')?.value || ''
    const searchTerm = rawSearch.trim().toLowerCase()

    const table = document.createElement('table')
    table.innerHTML = `
        <thead>
        <tr>
          <th>Equipment Name</th>
          <th>Location</th>
          <th>Test Date</th>
          <th>Peak Load</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    `
    const tbody = table.querySelector('tbody')

    for (const test of tests) {
      const equipmentName = toTitleCase(
        test.metadata?.equipment?.equipmentName || 'Untitled'
      )
      const location = toTitleCase(test.metadata?.equipment?.location || 'N/A')
      const testDate = test.metadata?.equipment?.testDate
        ? new Date(test.metadata.equipment.testDate).toLocaleDateString('en-IN')
        : 'N/A'
      const peakLoad = test.peakValue || 'N/A'

      const combinedText =
        `${equipmentName} ${location} ${testDate}`.toLowerCase()

      if (searchTerm && !combinedText.includes(searchTerm)) {
        continue // skip non-matching
      }

      matchFound = true

      const resolvedPath =
        test.filePath && fs.existsSync(test.filePath)
          ? test.filePath
          : test.backupPath && fs.existsSync(test.backupPath)
          ? test.backupPath
          : null
      const label = resolvedPath ? '📄 View' : '❌ Missing'

      //   const originalPath = test.filePath || ''
      //   const fileName = path.basename(originalPath)
      //   const backupPath = path.join(backupDir, fileName)

      //   let filePath = originalPath
      //   let label = '📄 View'
      //   let isBackup = false

      //   if (!fs.existsSync(filePath)) {
      //     if (fs.existsSync(backupPath)) {
      //       filePath = backupPath
      //       label = '📂 View'
      //       isBackup = true
      //     } else {
      //       filePath = null
      //     }
      //   }
      //   const resolvedPath = filePath

      const encodedPath = encodeURIComponent(resolvedPath || '')

      const row = document.createElement('tr')
      row.innerHTML = `
        <td>${equipmentName}</td>
        <td>${location}</td>
        <td>${testDate}</td>
        <td>${peakLoad} Tons</td>

     <td>
  ${
    resolvedPath
      ? `
          <button class="view-btn" onclick="openReport('${encodedPath}')">${label}</button>
          <button class="download-btn" onclick="downloadBackup('${encodedPath}', event)">⬇️ Download</button>
          <button class="delete-btn" onclick="deleteReport('${test.id}', '${encodedPath}')">🗑️ Delete</button>
        `
      : `<span style="color:red;">❌ Report not found</span>`
  }
</td>
      `

      tbody.appendChild(row)
    }
    reportsList.appendChild(table)
    if (!matchFound) {
      tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; padding: 12px;">
              No reports match your search, Try adjusting keywords.
            </td>
          </tr>
        `
    }
  } catch (err) {
    console.error('❌ Failed to load test reports:', err)
    await logError('Failed to load test reports:', err)
    reportsList.innerHTML =
      '<p style="color: red;">⚠️ Error loading reports</p>'
  }
}

window.openReport = async (encodedPath) => {
  const resolvedPath = decodeURIComponent(encodedPath)
  try {
    if (fs.existsSync(resolvedPath)) {
      await shell.openPath(resolvedPath)
      await loadReports()
      return
    }

    const userDataPath = await ipcRenderer.invoke('get-user-data-path')
    const backupDir = path.join(userDataPath, 'Test Data', 'PDFs')
    const backupFile = path.join(backupDir, path.basename(resolvedPath))
    if (fs.existsSync(backupFile)) {
      await shell.openPath(backupFile)
    } else {
      alert('⚠️ Report file is missing. Please re-download from backup.')
    }
    await loadReports()
  } catch (err) {
    console.error('❌ Error during report view:', err)
    await logError('Error during report view', err)
  }
}

// ✅ Use Node.js to copy the file to Downloads
window.downloadBackup = async (encodedPath, event) => {
  let resolvedPath = decodeURIComponent(encodedPath)
  const downloadsDir = path.join(os.homedir(), 'Downloads')
  const fileName = path.basename(resolvedPath)
  const destPath = path.join(downloadsDir, fileName)
  const userDataPath = await ipcRenderer.invoke('get-user-data-path')
  const backupDir = path.join(userDataPath, 'Test Data', 'PDFs')
  const backupFile = path.join(backupDir, fileName)
  const btn = event?.target
  if (btn) btn.disabled = true
  try {
    if (!fs.existsSync(resolvedPath)) {
      if (fs.existsSync(backupFile)) {
        resolvedPath = backupFile
      } else {
        alert('⚠️ Cannot download — source and backup files are missing.')
        return
      }
    }

    if (fs.existsSync(destPath)) {
      const overwrite = confirm(
        '⚠️ File already exists in Downloads.\nDo you want to overwrite it?'
      )

      if (!overwrite) {
        if (btn) btn.disabled = false
        return
      }
    }
    fs.copyFileSync(resolvedPath, destPath)
    await loadReports()
    alert(`✅ Report Downloaded: \n${fileName}`)
  } catch (err) {
    await logError('Failed to copy report::', err)
    console.error('❌ Failed to copy report:', err)
    updateStatus('Error copying report to Downloads.', 'error')
  } finally {
    if (btn) btn.disabled = false
  }
}

window.deleteReport = async (testId, encodedPath) => {
  const confirmed = confirm(
    '⚠️ Are you sure you want to delete this report permanently?'
  )
  if (!confirmed) return

  const resolvedPath = decodeURIComponent(encodedPath)

  try {
    const userDataPath = await ipcRenderer.invoke('get-user-data-path')
    const testDataDir = path.join(userDataPath, 'Test Data')
    const testsFilePath = path.join(testDataDir, 'tests.json')
    const reportsList = document.getElementById('reportsList')
    if (!reportsList) {
      console.warn('⚠️ reportsList element not found')
      return
    }

    if (!fs.existsSync(testsFilePath)) {
      reportsList.innerHTML = '<p>No reports found.</p>'
      return
    }
    // Load current tests
    const data = fs.readFileSync(testsFilePath, 'utf-8')
    let tests = JSON.parse(data)
    // Find the test to get the filename
    const testToDelete = tests.find((t) => t.id === testId)
    if (testToDelete) {
      if (resolvedPath && fs.existsSync(resolvedPath)) {
        fs.unlinkSync(resolvedPath)
      }
      // Delete original filePath (Downloads) — even if it's same as resolvedPath
      if (testToDelete.filePath && fs.existsSync(testToDelete.filePath)) {
        fs.unlinkSync(testToDelete.filePath)
      }

      // Delete backupPath
      if (testToDelete.backupPath && fs.existsSync(testToDelete.backupPath)) {
        fs.unlinkSync(testToDelete.backupPath)
      }
      // Remove from tests.json
      const updatedTests = tests.filter((t) => t.id !== testId)
      fs.writeFileSync(testsFilePath, JSON.stringify(updatedTests, null, 2))
    }

    await loadReports()
    alert('✅ Report deleted successfully.')
  } catch (err) {
    await logError('Failed to delete report:', err)
    console.error('❌ Failed to delete report:', err)
    updateStatus('Error Deleting Report.', 'error')
  }
}

module.exports = { loadReports }
