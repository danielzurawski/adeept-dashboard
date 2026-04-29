# Adeept AWR-V3 Dashboard

A React + TypeScript cockpit for the [Adeept AWR-V3](https://www.adeept.com/) 4WD smart robot.
The dashboard runs locally as a single-page app and connects over WebSocket to whichever
firmware is currently active on the Raspberry Pi:

- **Vendor Python firmware** (`Adeept_Robot.service`) on `:8888`
- **Zig firmware** (`awr-v3-zig.service`, see [`zig-awr-v3`](https://github.com/danielzurawski/zig-awr-v3)) on `:8889`
- **Bundled Node.js simulator** (`ws-server.mjs`) on `:8889`, for hardware-free development

It owns the cockpit UI, demo pad, robot-mode toggles, live SLAM panel, and a complete
end-to-end acceptance suite. It does **not** ship any hardware-control code.

## Why a separate dashboard?

The original AWR-V3 ships a Flask app served *from* the Pi. That conflates "control surface"
with "robot firmware" and forces every UI iteration through a Pi reflash. By moving the
cockpit off the Pi entirely:

- The UI iterates at full Vite-HMR speed on the developer's laptop.
- The firmware on the Pi only has to speak the AWR-V3 WebSocket protocol; it does not need
  to bundle an HTTP server, Flask templates, or static assets.
- The same dashboard works for the vendor Python firmware, the Zig firmware, and a local
  Node simulator — switch with one click in the connection panel.

## Quick start

```bash
git clone https://github.com/danielzurawski/adeept-dashboard.git
cd adeept-dashboard

npm install
npm run robot:sim          # local Node simulator on ws://localhost:8889 (terminal 1)
npm run dev                # Vite dev server on http://localhost:8080  (terminal 2)
```

Open `http://localhost:8080`, leave the connection panel pointed at `ws://localhost:8889`,
click **Connect**, and you have a fully-functional dashboard talking to the bundled
simulator.

To talk to a real robot, change the URL to `ws://raspberry-pi.local:8888` (vendor Python)
or `ws://raspberry-pi.local:8889` (Zig firmware) — those are the first-class connection
presets.

## What's on the dashboard

| Surface | Notes |
|---|---|
| **Connection panel** | Preset dropdown, free-form URL/auth, Connect/Disconnect, status dot, backend label. |
| **Demo Pad** | 12 one-tap macros: tunes (Baby Shark, Happy Birthday, Seven Notes, Beep), lights (Police, Breathe Blue, Rainbow), LEDs (LED Wink), telemetry (Sensor Snapshot), camera (Camera Nod), motion (Tiny Forward Tap, Tiny Spin Tap). |
| **Control Mixer** | 4-WD drive grid with WASD/arrow/Q/E keyboard bindings, speed slider (0–100% in 10% steps), camera tilt (Up/Down + L/K), servo calibration (PWM-, Middle, PWM+, Reset, Init). |
| **System Info** | CPU temperature, CPU usage, RAM usage, battery — populated by `get_info` polling. |
| **Robot Modes** | 7 toggles: Find Color, Motion Detect, Auto Obstacle, Track Line, Keep Distance, CV Line Follow, Live Mapping. |
| **LED Ports** | 3 GPIO LED ports backed by `Switch_<n>_on` / `Switch_<n>_off`. |
| **Command Log** | 50-entry circular buffer of every TX and RX frame. |
| **Capabilities & Roadmap** | Searchable gallery of implemented capabilities + roadmap items with dependency notes. |
| **Live Camera** | MJPEG stream viewer with preset/URL/resolution selectors. |
| **Live Occupancy Map** | Real backend SLAM panel — toggles `mapping`/`mappingOff`, polls `get_map`, exposes A* `slam_plan X Y` and `slam_reset`. |
| **Occupancy Map (sim)** | Browser-only mapping demo (no backend traffic). |

## Drive arming

Motor controls are gated by an explicit **Arm Drive** toggle. Until armed:
- The drive grid (W/A/S/D/Q/E + buttons) is disabled.
- Motion-touching demos and Robot Modes (Auto Obstacle, Track Line, Keep Distance,
  CV Line Follow, Tiny Forward/Spin Tap) are disabled.
- Camera tilt + telemetry + LED ports remain available.

The **Stop All** button works at all times and emits `DS`, `TS`, `UDstop`,
followed by disarming, regardless of whether the drive was armed.

## Acceptance tests

The dashboard ships **three** complementary test suites:

### 1. Protocol suite (Node, hermetic)

Runs `node:test` against the bundled simulator. No browser, no Pi.

```bash
npm run test:protocol           # spins up ws-server.mjs, runs tests, tears it down
npm run test:protocol:only      # tests only; expects ws-server.mjs already running
```

### 2. Playwright E2E — simulator project

Drives the React UI in headless Chromium against the bundled simulator. Verifies every
dashboard surface fires the right WebSocket frames, the simulator records the right
state, and the UI updates accordingly.

```bash
npm run test:e2e                # full sim suite (~58 s, 87 tests)
npm run test:e2e:headed         # same, with the browser visible
npm run test:e2e:ui             # Playwright UI mode
npm run test:e2e:report         # open the HTML report
```

Coverage: connection lifecycle, drive arming, control mixer, keyboard shortcuts,
demo pad, servo calibration, robot modes, LED ports, telemetry, command log, gallery,
camera view, both occupancy map panels.

### 3. Playwright E2E — live-Pi project

Runs the same React UI in headless Chromium but against a **real Raspberry Pi** running
the Zig firmware. Verifies the full UI → WebSocket → Zig → I²C / GPIO / servo loop
by reading PCA9685 channel duty cycles and GPIO pin levels directly off the bus over
SSH.

```bash
# Set credentials — sshpass + password OR rely on a working SSH agent + key.
export AWR_PI_PASSWORD='your-pi-password'
export AWR_PI_HOST='dmz@raspberry-pi.local'
export AWR_PI_WS_URL='ws://raspberry-pi.local:8889'

npm run test:e2e:live           # ~3 min, 48 tests, wheels actually spin
```

Or use the orchestrator from `zig-awr-v3` (switches the Pi to the Zig backend, pre-flights
motor quiescence, runs the suite, post-flights, emergency-stops on any abnormal exit):

```bash
bash ../zig-awr-v3/scripts/run-live-pi-e2e.sh \
    --host raspberry-pi.local --user dmz --password 'your-pi-password'
```

Coverage: every drive direction (PCA9685 H-bridge channels), Stop All, speed slider duty
cycle, camera tilt + servo calibration (PCA9685 ch0), L/K keyboard shortcuts, LED Ports
(GPIO 9/25/11 via `pinctrl`), LED Wink macro, telemetry round-trip, full SLAM lifecycle
(`mapping`/`mappingOff`/`get_map`/`slam_plan`/`slam_reset`), buzzer tunes, Camera Nod,
motion macros (Tiny Forward/Spin Tap), Robot Modes ON/OFF pairs, vendor-only effects
(verified via dashboard log even though Zig silently ignores them).

The robot **must be on a stand** for the live-Pi suite — wheels turn briefly during
motion tests. Pre- and post-flight probes confirm `ch08–ch15 = 0` (motors quiescent)
before *and* after the run; the fixture refuses to start if the chip is non-idle.

## Project structure

```
adeept-dashboard/
├── src/
│   ├── App.tsx                          # Root layout + WebSocketProvider
│   ├── hooks/useWebSocket.tsx           # WS connection, telemetry polling, command log, latestMap
│   ├── components/
│   │   ├── ControlPanel.tsx             # Cockpit (connection, demo pad, mixer, modes, LEDs, log)
│   │   ├── apps/
│   │   │   ├── LiveOccupancyMap.tsx     # Real-backend SLAM panel
│   │   │   ├── OccupancyMap.tsx         # Browser-only mapping demo
│   │   │   ├── CameraView.tsx           # MJPEG bridge
│   │   │   └── AppGallery.tsx           # Capabilities + Roadmap gallery
│   │   └── ui/                          # Shadcn-style primitives (Button, Card, Badge, Tabs, …)
│   └── index.css                        # Tailwind v4 theme
├── ws-server.mjs                        # Node WebSocket simulator (incl. SLAM)
├── tests/
│   ├── ws-protocol.test.mjs             # Protocol acceptance (node:test)
│   └── e2e/
│       ├── pages/                       # Page objects (control-deck, app-gallery, live-occupancy-map)
│       ├── fixtures/
│       │   ├── dashboard.ts             # Sim suite fixtures (simulatorReset + dashboard + connectedDeck)
│       │   └── live.ts                  # Live-Pi fixtures (liveReset + dashboard + connectedDeck)
│       ├── utils/
│       │   ├── sim-client.ts            # Typed client for simulator's /state and /capabilities
│       │   ├── pi-pca9685.ts            # SSH+smbus2 PCA9685 reader + MOTOR_INTENT table
│       │   └── pi-gpio.ts               # SSH+pinctrl GPIO level reader
│       ├── specs/                       # Sim-suite specs (87 tests)
│       └── live/                        # Live-Pi specs (48 tests)
├── playwright.config.ts                 # Two projects: chromium (sim) + chromium-live-pi
└── scripts/
    ├── run-protocol-tests.mjs           # Orchestrates simulator + protocol tests
    └── setup-dashboard.sh               # Local Node-version check + npm install
```

## Companion firmware

The Zig firmware lives in [`zig-awr-v3`](https://github.com/danielzurawski/zig-awr-v3) and
ships an `awr-stack` helper on the Pi (`zig | python | both | stop | status`) so a single
Pi can host both the vendor `Adeept_Robot.service` and `awr-v3-zig.service` and toggle
between them. The dashboard's connection presets cover both ports out of the box.

## License

Apache License 2.0.
