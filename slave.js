const modbus = require('jsmodbus')
const net = require('net')

const server = new net.Server()
const holding = Buffer.alloc(4)

server.listen(8502, () => {
  console.log('✅ SAMAA Load Cell Slave Simulator started on port 8502')
})

const serverTCP = new modbus.server.TCP(server, {
  holding: holding,
})

// Initial test value
let testLoadKg = 0

serverTCP.on('connection', () => {
  console.log('✅ Master connected to SAMAA Load Cell Slave Simulator')
})

// Increment weight to simulate lifting
const maxLoadKg = 100000 // 100 tons in kg

const incrementInterval = setInterval(() => {
  if (testLoadKg < maxLoadKg) {
    const increment = Math.random() * 100 + 50
    testLoadKg += increment
    if (testLoadKg > maxLoadKg) testLoadKg = maxLoadKg

    const scaledLoad = Math.round(testLoadKg / 10)
    holding.writeUInt16BE((scaledLoad >> 16) & 0xffff, 0)
    holding.writeUInt16BE(scaledLoad & 0xffff, 2)

    console.log(
      `Simulated Load: ${testLoadKg.toFixed(2)} kg (${(
        testLoadKg / 1000
      ).toFixed(2)} tons) | Raw: ${scaledLoad}`
    )
  }
}, 1000)
