# Load Test Monitor

An Electron desktop application for monitoring and recording industrial load tests through RS-485 / Modbus RTU-connected load indicators.

Built for the **SAMAA Aerospace LLP Load Test Monitor** workflow, the application collects live load readings, displays real-time charts, records test information, generates reports, and supports machine-bound license activation.

> This repository contains the software implementation only. Production customer data, license keys, hardware credentials, and confidential test records are not included.

## Key Features

* Connect to load indicators through **RS-485 / Modbus RTU**
* Read and process live load values
* Real-time load monitoring and charting
* Start, stop, reset, and manage test sessions
* Capture test metadata and equipment details
* Calibration record support
* Generate PDF test reports
* Export test data for records and review
* Local application settings and data handling
* Machine-bound licensing and activation workflow
* Splash screen and desktop packaging support

## Tech Stack

* Electron
* Node.js
* JavaScript
* HTML / CSS
* Chart.js
* Modbus RTU over RS-485
* PDF report generation
* Local file-based data storage

## System Workflow

```text
Load Indicator / Load Cell
        ↓
RS-485 Connection
        ↓
Modbus RTU Polling
        ↓
Electron Desktop Application
        ↓
Live Load Display + Charting
        ↓
Test Records + PDF Reports
```

## Core Modules

* `modbusManager.js` — Handles Modbus RTU communication and load-value polling
* `chartManager.js` — Manages real-time load chart rendering
* `formManager.js` — Handles test, equipment, and calibration form data
* `reportManager.js` / `reports.js` — Generates test reports and supporting records
* `licenseManager.js` — Manages application licensing and activation checks
* `settingsManager.js` — Stores and retrieves application settings
* `main.js` — Electron main process and application lifecycle
* `renderer.js` — Desktop interface behavior and UI coordination

## Hardware Integration

The application is designed to work with a digital load indicator connected using RS-485 / Modbus RTU.

Typical communication configuration includes:

* Configurable serial port
* Baud rate
* Parity
* Stop bits
* Modbus device address
* Register mapping for live load values

> Exact hardware configuration varies by the connected indicator and load-testing setup.

## Installation

```bash
git clone https://github.com/AbdullahKhan08/load-test-monitor-mac.git
cd load-test-monitor-mac
npm install
```

## Running Locally

```bash
npm start
```

Check `package.json` before using this command. If your Electron script uses a different command, update this section to match it.

## License Activation

The application uses a separate backend service for license activation and machine-bound validation.

Typical flow:

1. User enters a license key and organization details.
2. The application sends an activation request.
3. The request is reviewed and approved.
4. The license is tied to the machine identity.
5. The application validates the approved license before allowing use.

Related backend repository:

* [License Server](https://github.com/AbdullahKhan08/license-server)

## What I Built

* Electron-based desktop application architecture
* RS-485 / Modbus RTU polling workflow
* Live load-value processing and charting
* Test session and equipment data workflows
* Calibration-related records
* PDF report generation
* Local settings and file-based data handling
* Machine-bound licensing integration
* Desktop UI, dialogs, and packaging workflow

## Engineering Challenges

* Reading reliable live values from industrial hardware through serial communication
* Converting raw Modbus register data into usable engineering values
* Keeping real-time chart updates responsive during active tests
* Producing clear test reports suitable for operational records
* Separating licensing and activation logic from the desktop client
* Managing local application state across test sessions

## Screenshots

Add screenshots here when ready:

* Main monitoring dashboard
* Live load chart during a test
* Equipment or calibration form
* Generated PDF report
* License activation screen

## Future Improvements

* Cross-platform Windows build
* Automated test coverage
* Improved export options
* Centralized test-record storage
* Enhanced hardware configuration interface
* Audit trail for operational actions

## License

Copyright © 2025 SAMAA Aerospace LLP. All rights reserved.

See [LICENSE.txt](./LICENSE.txt) for the end-user license agreement.
