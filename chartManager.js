const Chart = require('chart.js/auto')
const annotationPlugin = require('chartjs-plugin-annotation')
Chart.register(annotationPlugin)
const state = require('./state')
const { logError } = require('./utils')

let destroyInProgress = false
let retryAttempts = 0
const MAX_RETRIES = 10

/**
 * Render or re-render the load chart with given data and peak annotation.
 * Ensures safe handling of chart lifecycle to avoid duplication or DOM conflicts.
 * @param {Array<{time: string, loadTons: number}>} chartData - Array of time/load points
 * @param {number} peakValue - Current peak value for annotation
 */

function renderChart(chartData, peakValue) {
  const canvas = document.getElementById('loadChart')
  if (!canvas || destroyInProgress) {
    if (retryAttempts < MAX_RETRIES) {
      retryAttempts++
      console.warn(
        '⚠️ Chart canvas not ready or destroy in progress. Retrying...'
      )
      setTimeout(() => renderChart(chartData, peakValue), 150)
    } else {
      console.error('🛑 Max retries reached. Chart not rendered.')
      retryAttempts = 0
    }
    return
  }

  retryAttempts = 0
  try {
    const existing = state.get('chartInstance')
    if (existing) {
      try {
        existing.destroy()
        state.set('chartInstance', null)
      } catch (destroyErr) {
        console.warn('⚠️ Failed to destroy existing chart:', destroyErr)
        logError('⚠️ Chart destroy error in renderChart()', destroyErr)
      }
    }

    const ctx = canvas.getContext('2d')
    const labels =
      chartData.length > 0 ? chartData.map((point) => point.time) : ['']
    const dataTons =
      chartData.length > 0 ? chartData.map((point) => point.loadTons) : [0]

    const datasets = [
      {
        label: 'Load (tons)',
        data: dataTons,
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
        fill: true,
        pointRadius: 0.5,
        tension: 0.5,
      },
    ]
    const enablePeakAnnotation = peakValue > 0

    const annotationOptions = enablePeakAnnotation
      ? {
          annotations: {
            peakLine: {
              type: 'line',
              yMin: peakValue,
              yMax: peakValue,
              borderColor: 'red',
              borderWidth: 1,
              label: {
                content:
                  peakValue > 0
                    ? `Peak: ${peakValue.toFixed(2)} t`
                    : 'Peak: --',
                enabled: true,
                position: 'start',
                backgroundColor: 'rgba(255,0,0,0.2)',
                color: 'red',
                font: {
                  size: 14,
                  style: 'normal',
                  weight: 'bold',
                },
              },
            },
          },
        }
      : {}
    const chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        scales: {
          x: { title: { display: true, text: 'Time' } },
          y: { title: { display: true, text: 'Load (tons)' } },
        },
        plugins: {
          legend: { display: true },
          annotation: annotationOptions,
        },
      },
    })

    state.set('chartInstance', chartInstance)
  } catch (err) {
    console.error('❌ Chart rendering failed:', err)
    logError('❌ Chart rendering error', err)
  }
}

/**
 * Clean up any existing chart and reset the canvas.
 * Optionally followed by `renderChart([], 0)` externally.
 */

function clearChart() {
  destroyInProgress = true
  try {
    const chartInstance = state.get('chartInstance') // CHANGED
    const canvas = document.getElementById('loadChart')
    if (chartInstance) {
      try {
        chartInstance.destroy()
        state.set('chartInstance', null)
        console.log('ℹ️ Chart instance cleared.')
      } catch (err) {
        console.warn('⚠️ Chart destroy error during clearChart():', err)
      }
    }

    if (!chartInstance && (!canvas || !canvas.getContext)) {
      console.log('ℹ️ No chart to clear.')
      return
    }

    if (canvas && canvas.getContext) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      canvas.width = 800
      canvas.height = 300
    }
  } catch (err) {
    console.error('⚠️ Error during chart cleanup:', err)
    logError('⚠️ Chart cleanup error in clearChart()', err)
  } finally {
    setTimeout(() => {
      destroyInProgress = false
    }, 250)
  }
}

module.exports = {
  renderChart,
  clearChart,
}
