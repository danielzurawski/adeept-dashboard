# Adeept AWR-V3 Dashboard

A modern web dashboard and control interface for the [Adeept AWR-V3](https://www.adeept.com/) 4WD smart robot platform, built with React, TypeScript, Tailwind CSS v4, and shadcn/ui patterns.

## Overview

This project provides:

- **Hardware & software documentation** — interactive reference for the AWR-V3's electronics, GPIO mapping, ICs, expansion ports, and Python module architecture
- **Robot control panel** — WebSocket-based reimplementation of the original AWR-V3 protocol with keyboard shortcuts (WASD/QE/IK), movement controls, camera tilt, speed slider, function toggles, LED switches, servo calibration, and a live command log
- **Robot Apps gallery** — 28 mini-applications across 8 categories (Control, Vision, Autonomy, Output, System, AI/ML, Hardware) with built-in, ready-to-deploy, and coming-soon statuses
- **Camera view** — MJPEG stream viewer connecting to the robot's Flask video feed
- **Occupancy mapping** — canvas-based 2D occupancy grid with simulated frontier exploration, path visualization, and real-world implementation guide
- **Expansion proposals** — 40+ project ideas organized by difficulty level
- **WebSocket simulation server** — Bun-based server that mimics the full AWR-V3 protocol for development without hardware

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Bun](https://bun.sh/) 1.0+ (for the simulation server and tests)

## Quick Start

```bash
# Install dependencies
npm install

# Start the simulation WebSocket server (port 8889)
bun run ws-server.mjs &

# Start the development server (port 8080)
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

## Running Tests

The E2E test suite validates the full WebSocket protocol against either the Bun simulation server or the Zig firmware server:

```bash
# Ensure the WebSocket server is running on port 8889
bun run ws-server.mjs &

# Run all 55 E2E acceptance tests
bun test
```

Test coverage includes: authentication (5 tests), system info (6), movement commands (10), camera tilt (4), speed control (4), function toggles (8), switch controls (4), servo configuration (6), JSON commands (2), response structure (3), connection lifecycle (2), HTTP endpoint (1).

## Type Checking & Linting

```bash
# TypeScript strict mode type checking
npx tsc -b --noEmit

# ESLint
npx eslint src/
```

## Project Structure

```
adeept-dashboard/
├── src/
│   ├── App.tsx                          # Main layout with navigation
│   ├── main.tsx                         # React entry point
│   ├── index.css                        # Tailwind v4 theme
│   ├── lib/utils.ts                     # cn() utility
│   ├── hooks/useWebSocket.ts            # WebSocket connection hook
│   ├── components/
│   │   ├── Hero.tsx                     # Overview section
│   │   ├── HardwareSection.tsx          # Hardware inventory tables
│   │   ├── SoftwareSection.tsx          # Architecture documentation
│   │   ├── ControlPanel.tsx             # Interactive robot controls
│   │   ├── CapabilitiesSection.tsx      # Built-in features grid
│   │   ├── ProposalsSection.tsx         # Expansion ideas (tabbed)
│   │   ├── apps/
│   │   │   ├── AppGallery.tsx           # Mini-apps marketplace
│   │   │   ├── CameraView.tsx           # MJPEG stream viewer
│   │   │   └── OccupancyMap.tsx         # 2D grid mapping simulation
│   │   └── ui/                          # shadcn-style primitives
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── badge.tsx
│   │       ├── tabs.tsx
│   │       └── separator.tsx
├── tests/
│   └── ws-protocol.test.ts             # 55 E2E acceptance tests
├── ws-server.mjs                        # Bun WebSocket simulation server
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
└── eslint.config.js
```

## WebSocket Protocol

The control panel and simulation server implement the AWR-V3 WebSocket protocol:

| Command | Description |
|---------|-------------|
| `admin:123456` | Authentication handshake |
| `forward`, `backward`, `left`, `right`, `rotate-left`, `rotate-right` | Movement |
| `DS`, `TS` | Direction/turn stop |
| `up`, `down`, `UDstop` | Camera tilt |
| `wsB N` | Set speed (0-100) |
| `findColor`, `motionGet`, `automatic`, `trackLine`, `keepDistance`, `police`, `CVFL` | Function on |
| `stopCV`, `automaticOff`, `trackLineOff`, `keepDistanceOff`, `policeOff` | Function off |
| `Switch_N_on`, `Switch_N_off` | LED port control (N=1,2,3) |
| `SiLeft N`, `SiRight N`, `PWMMS N`, `PWMINIT`, `PWMD` | Servo calibration |
| `get_info` | Returns `{status, title:"get_info", data:[cpuTemp, cpuUse, ramUse, battery]}` |
| `{"title":"findColorSet","data":[H,S,V]}` | JSON color config |

## Tech Stack

- **React 19** + **TypeScript 6**
- **Vite 8** with HMR
- **Tailwind CSS v4** via `@tailwindcss/vite`
- **class-variance-authority** + **tailwind-merge** for component variants
- **Lucide React** icons
- **Bun** runtime for WebSocket server and test runner

## Hardware Compatibility

Designed for the Adeept AWR-V3 robot with:
- Raspberry Pi 3B/3B+/4/5
- Adeept Robot HAT V3.2 (PCA9685 + ADS7830 + DRV8833)
- HC-SR04 ultrasonic, 3-CH IR line tracker, WS2812 LEDs, camera module

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.