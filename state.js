// state.js
const EventEmitter = require('events')

class StateManager extends EventEmitter {
  constructor() {
    super()
    this.state = {
      testMetadata: {},
      masterCalibrationData: {},
      chartData: [],
      peakValue: 0,
      isPolling: false,
      chartInstance: null, // ✅ ADDED for Chart.js management
      settings: {}, // ✅ ADDED: settings object (company name, logo, footer)
    }
  }

  get(key) {
    return this.state[key]
  }

  set(key, value) {
    this.state[key] = value
    this.emit('change', { key, value })
  }

  subscribe(callback) {
    this.on('change', callback)
  }
}

module.exports = new StateManager()
