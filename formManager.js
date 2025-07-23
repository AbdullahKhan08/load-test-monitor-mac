const fs = require('fs-extra')
const path = require('path')
const { updateStatus, logError } = require('./utils')
const state = require('./state')
const { ipcRenderer } = require('electron')

/**
 * Loads calibration data from disk and auto-fills the calibration form.
 * @param {HTMLFormElement} calibrationForm
 */
async function loadMasterCalibration(calibrationForm) {
  try {
    const userDataPath = await ipcRenderer.invoke('get-user-data-path')
    const testDataDir = path.join(userDataPath, 'Test Data')
    const metadataFile = path.join(testDataDir, 'masterCalibration.json')
    if (await fs.pathExists(metadataFile)) {
      const data = await fs.readJSON(metadataFile)
      // Auto-fill calibration fields
      for (const [key, value] of Object.entries(data)) {
        const input = calibrationForm.querySelector(`[name="${key}"]`)
        if (input) input.value = value
      }
      // Save to state
      const testMetadata = state.get('testMetadata') || {}
      testMetadata.calibration = { ...data }
      state.set('testMetadata', testMetadata)
      updateStatus('✅ Master Calibration Equipment Data Loaded.', 'success')
    } else {
      console.log('ℹ️ No Master calibration data found.')
    }
  } catch (err) {
    console.error('❌ Failed to load calibration data:', err)
    await logError('Failed to load calibration data', err)
  }
}

/**
 * Checks if the calibration form is fully filled.
 * @param {HTMLFormElement} calibrationForm
 * @returns {boolean}
 */
function isCalibrationFormComplete(calibrationForm) {
  const requiredCalibrationFields = [
    'loadCellPartNo',
    'loadCellSerialNo',
    'loadCellModelNo',
    'loadCellLastCalibrationDate',
    'loadCellCalibrationValidity',
    'displayPartNo',
    'displayModelNo',
    'displaySerialNo',
    'displayLastCalibrationDate',
    'displayCalibrationValidity',
  ]
  for (const key of requiredCalibrationFields) {
    const input = calibrationForm.querySelector(`[name="${key}"]`)
    if (!input || input.value.trim() === '') {
      return false
    }
  }
  return true
}

/**
 * Collects and saves calibration data from the calibration form to disk and state.
 * @param {HTMLFormElement} calibrationForm
 * @returns {boolean}
 */
async function collectAndSaveCalibration(calibrationForm) {
  try {
    const formData = new FormData(calibrationForm)
    const dataObj = Object.fromEntries(formData.entries())

    // Trim and validate
    const requiredFields = [
      'loadCellPartNo',
      'loadCellSerialNo',
      'loadCellModelNo',
      'loadCellLastCalibrationDate',
      'loadCellCalibrationValidity',
      'displayPartNo',
      'displayModelNo',
      'displaySerialNo',
      'displayLastCalibrationDate',
      'displayCalibrationValidity',
    ]

    const missingFields = requiredFields.filter(
      (field) => !dataObj[field] || dataObj[field].trim() === ''
    )
    if (missingFields.length > 0) {
      alert(`⚠️ Please fill all required fields:\n${missingFields.join(', ')}`)
      updateStatus('Status: Incomplete Data.', 'error')
      return false
    }
    requiredFields.forEach((field) => (dataObj[field] = dataObj[field].trim()))

    const userDataPath = await ipcRenderer.invoke('get-user-data-path')
    const testDataDir = path.join(userDataPath, 'Test Data')
    await fs.ensureDir(testDataDir)
    const metadataFile = path.join(testDataDir, 'masterCalibration.json')
    await fs.writeJson(metadataFile, dataObj, { spaces: 2 })
    // Save to state
    const testMetadata = state.get('testMetadata') || {}
    testMetadata.calibration = { ...dataObj }
    state.set('testMetadata', testMetadata)

    console.log(`✅ Calibration data saved: ${metadataFile}`)
    updateStatus('✅ Master Calibration Equipment Data Saved.', 'success')
    return true
  } catch (err) {
    await logError('Error saving Master calibration equipment data', err)
    console.error('❌ Error saving calibration data:', err)
    updateStatus(
      'Status: Failed To Save Master Calibration Equipment Data',
      'error'
    )
    return false
  }
}

/**
 * Collects and saves equipment test data from the equipment form to state.
 * @param {HTMLFormElement} equipmentForm
 * @returns {boolean}
 */
function collectAndSaveEquipmentTest(equipmentForm, calibrationForm) {
  try {
    const formData = new FormData(equipmentForm)
    const dataObj = Object.fromEntries(formData.entries())

    if (!isCalibrationFormComplete(calibrationForm)) {
      alert('⚠️ Master Calibration Equipment Data Missing or Incomplete.')
      updateStatus(
        'Status: Master Calibration Equipment Details incomplete.',
        'error'
      )
      return false
    }

    // Trim and validate
    const requiredFields = [
      'equipmentName',
      'typeOfEquipment',
      'equipmentPartNo',
      'equipmentModelNo',
      'equipmentSerialNo',
      'ratedLoadCapacity',
      'proofLoadPercentage',
      'yearOfManufacture',
      'testDate',
      'location',
      'testedBy',
      'certifiedBy',
    ]

    if (!dataObj['testDate'] || dataObj['testDate'].trim() === '') {
      const today = new Date()
      dataObj['testDate'] = today.toLocaleDateString('en-GB')
    }

    const missingFields = requiredFields.filter(
      (field) => !dataObj[field] || dataObj[field].trim() === ''
    )
    if (missingFields.length > 0) {
      alert(`⚠️ Please fill all required fields:\n${missingFields.join(', ')}`)
      updateStatus('Status: Incomplete Data.', 'error')
      return false
    }
    requiredFields.forEach((field) => (dataObj[field] = dataObj[field].trim()))
    // Validate ratedLoadCapacity

    const capacity = Number(dataObj.ratedLoadCapacity)
    if (isNaN(capacity) || capacity <= 0) {
      alert('⚠️ Rated Load Capacity must be a valid positive number.')
      updateStatus('Status: Invalid Rated Load Capacity.', 'error')
      return false
    }

    const proofLoadPercent = Number(dataObj.proofLoadPercentage)
    if (isNaN(proofLoadPercent) || proofLoadPercent <= 0) {
      alert('⚠️ Proof Load Percentage must be a valid positive number.')
      updateStatus('Status: Invalid Proof Load Percentage.', 'error')
      return false
    }

    // Calculate proof load and certificate validity
    const proofLoad = (capacity * (proofLoadPercent / 100)).toFixed(1)
    dataObj.proofLoad = proofLoad
    document.getElementById(
      'proofLoadDisplay'
    ).innerText = `Proof Load: ${proofLoad} t`
    const today = new Date()
    // Determine base date for validity
    let baseDate = today
    if (dataObj.testDate) {
      const parsedDate = new Date(dataObj.testDate)
      if (!isNaN(parsedDate)) {
        baseDate = parsedDate
      }
    }
    const validityDate = new Date(baseDate)
    validityDate.setFullYear(today.getFullYear() + 1)
    validityDate.setDate(validityDate.getDate() - 1)
    dataObj.certificateValidity = validityDate.toLocaleDateString('en-GB')

    // Save equipment data to state while preserving calibration
    const testMetadata = state.get('testMetadata') || {}
    testMetadata.equipment = { ...dataObj }
    state.set('testMetadata', testMetadata)

    // Enable start button after successful save
    console.log('✅ Equipment test data collected.')
    updateStatus('✅ Equipment Tested Data Daved.', 'success')
    return true
  } catch (err) {
    console.error('❌ Error saving equipment test data:', err)
    logError('Error saving equipment test data', err)
    updateStatus('Status: Failed To Save Test Tata', 'error')
    return false
  }
}

/**
 * Validates that required calibration and equipment fields are filled before polling.
 * @returns {boolean} True if valid, false otherwise.
 */
function isTestMetadataComplete() {
  const testMetadata = state.get('testMetadata') || {}

  const calibrationFields = [
    'loadCellPartNo',
    'loadCellSerialNo',
    'loadCellModelNo',
    'loadCellLastCalibrationDate',
    'loadCellCalibrationValidity',
    'displayPartNo',
    'displayModelNo',
    'displaySerialNo',
    'displayLastCalibrationDate',
    'displayCalibrationValidity',
  ]

  const equipmentFields = [
    'equipmentName',
    'typeOfEquipment',
    'equipmentPartNo',
    'equipmentSerialNo',
    'equipmentModelNo',
    'yearOfManufacture',
    'testDate',
    'ratedLoadCapacity',
    'proofLoadPercentage',
    'location',
    'testedBy',
    'certifiedBy',
  ]

  const calibrationData = testMetadata.calibration || {}
  const equipmentData = testMetadata.equipment || {}

  // Check calibration fields
  for (const field of calibrationFields) {
    if (!calibrationData[field] || calibrationData[field].trim() === '') {
      console.warn(`⚠️ Missing calibration field: ${field}`)
      return false
    }
  }

  // Check equipment fields
  for (const field of equipmentFields) {
    if (!equipmentData[field] || equipmentData[field].trim() === '') {
      console.warn(`⚠️ Missing equipment field: ${field}`)
      return false
    }
  }
  return true
}

function populateTestMetadataFields(metadata = state.get('testMetadata')) {
  if (!metadata || !metadata.equipment) return

  const { testDate, location, testedBy, certifiedBy } = metadata.equipment

  if (testDate) document.getElementById('testDate').value = testDate

  if (location) document.getElementById('location').value = location

  if (testedBy) document.getElementById('testedBy').value = testedBy
  if (certifiedBy) document.getElementById('certifiedBy').value = certifiedBy
}

function resetEquipmentData() {
  const testMetadata = state.get('testMetadata') || {}
  testMetadata.equipment = {}
  state.set('testMetadata', testMetadata)
}

module.exports = {
  loadMasterCalibration,
  isCalibrationFormComplete,
  collectAndSaveCalibration,
  collectAndSaveEquipmentTest,
  isTestMetadataComplete,
  resetEquipmentData,
  populateTestMetadataFields,
}
