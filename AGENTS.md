# AGENTS.md — Adeept AWR-V3 Dashboard

This document provides context for coding agents working on this project.

## Project Summary

A React/TypeScript web dashboard for the Adeept AWR-V3 4WD robot. It runs locally as a PWA and connects to a remote firmware endpoint (vendor Python on `:8888`, Zig firmware on `:8889`, or the bundled Node simulator on `:8889`). It owns the cockpit UI, demo pad, robot-mode toggles, live SLAM panel, and the protocol acceptance suite. It does **not** ship hardware control code.

## Architecture

### Frontend (React + Vite)

- **Entry**: `src/main.tsx` → `src/App.tsx`
- **Theme**: Dark mode only, defined via CSS custom properties in `src/index.css` using Tailwind v4's `@theme` directive
- **Path aliases**: `@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`)
- **Component pattern**: shadcn/ui style — primitive components in `src/components/ui/` use CVA (class-variance-authority) for variants. Application components compose these primitives.
- **State management**: A single `WebSocketProvider` (in `src/hooks/useWebSocket.tsx`) owns the WebSocket connection, telemetry polling, command log, and the latest `get_map` snapshot. Both `ControlPanel` and `LiveOccupancyMap` consume it via `useWebSocket()`. Outside of that, components use local `useState`/`useRef`.
- **No router**: Single-page scroll layout with anchor-based section navigation.

### WebSocket Simulation Server (`ws-server.mjs`)

- Runs on **Node.js** using `node:http` and `ws`
- Port **8889**
- Implements the AWR-V3 protocol: authentication handshake, command dispatch, simulated `get_info` telemetry, and a SLAM track (`mapping`/`mappingOff`/`slam_reset`/`get_map`/`slam_plan`) with a fake mapping thread that updates the simulated grid as forward/rotate commands arrive. Exposes `/state` and `/capabilities` for protocol-test assertions.
- Stateless per-connection authentication (no sessions/tokens)
- Credentials are hardcoded in the simulator (`admin:123456`) since this is a development tool, not production

### Protocol Tests (`tests/ws-protocol.test.mjs` + `scripts/run-protocol-tests.mjs`)

- `npm run test:protocol` runs **`scripts/run-protocol-tests.mjs`**, which starts `ws-server.mjs`, waits for `/capabilities`, executes `node --test tests/ws-protocol.test.mjs`, then stops the simulator.
- `npm run test:protocol:only` assumes a listener is already on **`ws://localhost:8889`** — use with **`npm run robot:sim`** (Node simulator), not as a drop-in for arbitrary firmware without matching HTTP routes and auth strings.

### Playwright E2E suite (`tests/e2e/`)

The dashboard ships **two Playwright projects** wired in `playwright.config.ts`:

1. **`chromium`** (default, runs on `npm run test:e2e`) — drives the React UI in headless
   Chromium against the bundled Node simulator. Hermetic, fast (~58 s), 87 tests covering
   every dashboard surface: connection lifecycle, drive arming, control mixer, keyboard
   shortcuts, demo pad (all 12 cards), servo calibration (all 5 buttons), robot modes
   (all 7 toggles), LED ports, telemetry, command log, capabilities gallery + roadmap +
   panel close, camera view (preset/URL/resolution/start/stop), and both occupancy map
   panels.
2. **`chromium-live-pi`** (runs on `npm run test:e2e:live` with `LIVE_PI=1`) — drives the
   same React UI but against a real Raspberry Pi running the Zig firmware. Verifies the
   full UI → WebSocket → Zig firmware → PCA9685 / GPIO loop by reading hardware state
   directly over SSH (PCA9685 channels via `smbus2`, GPIO pins via `pinctrl`). 48 tests
   covering motor channels per direction, speed-slider duty cycle, camera tilt + servo
   calibration on PCA9685 ch0, LED ports on GPIO 9/25/11, SLAM round-trips, telemetry
   (real CPU/RAM/temp/battery), buzzer tunes, demo pad macros, robot modes, and L/K
   keyboard shortcuts.

Tests share locator-only **page objects** (`tests/e2e/pages/control-deck.ts`,
`tests/e2e/pages/app-gallery.ts`, `tests/e2e/pages/live-occupancy-map.ts`) so a UI
restructure that doesn't change the user-visible affordances doesn't ripple through
every spec. The page objects intentionally target accessibility-first locators (visible
names, roles, `title` attributes) rather than `data-testid` markers.

Live-Pi fixtures (`tests/e2e/fixtures/live.ts`) **enforce a quiescent baseline** on every
test: a WS quiescing burst (`DS`/`TS`/`UDstop`/`mappingOff`/`Switch_*_off`/...) followed
by a PCA9685 probe that asserts ch08–ch15 = 0. Any test that leaves motors armed will
fail the *next* test's pre-flight rather than silently coexist with stale PWM. The
`zig-awr-v3/scripts/run-live-pi-e2e.sh` orchestrator wraps this with an `awr-stack zig`
toggle plus a top-level `trap '...' EXIT INT TERM` that emergency-stops on any abnormal
exit.

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/App.tsx` | Root layout, `WebSocketProvider`, navigation, app panel routing | ~140 |
| `src/hooks/useWebSocket.tsx` | WebSocket provider/hook with `latestMap` snapshot streaming | ~190 |
| `src/components/ControlPanel.tsx` | Interactive robot controls + Live Mapping mode toggle + keyboard shortcuts | ~560 |
| `src/components/apps/LiveOccupancyMap.tsx` | Real backend SLAM panel (mapping/get_map/slam_plan) | ~230 |
| `src/components/apps/OccupancyMap.tsx` | Browser-only 2D grid exploration simulation | ~350 |
| `src/components/apps/AppGallery.tsx` | Capabilities and roadmap gallery with search/category tabs | ~260 |
| `src/components/apps/CameraView.tsx` | MJPEG stream viewer with connection controls | ~140 |
| `ws-server.mjs` | Node WebSocket protocol simulator (incl. SLAM track) | ~300 |
| `scripts/run-protocol-tests.mjs` | Orchestrates simulator + protocol tests | ~80 |
| `scripts/setup-dashboard.sh` | One-shot local setup (Node check + npm install) | ~40 |
| `tests/ws-protocol.test.mjs` | Protocol acceptance tests (auth, telemetry, actions, SLAM) | ~210 |
| `playwright.config.ts` | Two-project Playwright config (chromium + chromium-live-pi) | ~95 |
| `tests/e2e/pages/control-deck.ts` | Page object: connection, drive grid, mixer, modes, LEDs, log | ~290 |
| `tests/e2e/pages/app-gallery.ts` | Page object: capabilities + roadmap gallery | ~115 |
| `tests/e2e/pages/live-occupancy-map.ts` | Page object: SLAM panel | ~90 |
| `tests/e2e/fixtures/dashboard.ts` | Sim-suite fixtures (simulatorReset + connectedDeck) | ~160 |
| `tests/e2e/fixtures/live.ts` | Live-Pi fixtures (liveReset + connectedDeck) | ~180 |
| `tests/e2e/utils/sim-client.ts` | Typed client for simulator's `/state` and `/capabilities` | ~70 |
| `tests/e2e/utils/pi-pca9685.ts` | SSH+smbus2 PCA9685 reader + MOTOR_INTENT table | ~165 |
| `tests/e2e/utils/pi-gpio.ts` | SSH+pinctrl GPIO level reader | ~90 |

## Development Commands

```bash
npm install                          # Install dependencies
npm run robot:sim                    # Start simulation server (port 8889)
npm run dev                          # Start Vite dev server (port 8080)
npx tsc -b --noEmit                  # Type check (strict mode, zero errors expected)
npx tsc --project tsconfig.e2e.json --noEmit   # Type check the E2E suite separately
npx eslint src/                      # Lint (zero warnings with current config)
npm run test:protocol                # Starts simulator, runs protocol tests, exits
npm run test:protocol:only           # Tests only; expects robot:sim already on :8889

# Playwright E2E
npm run test:e2e                     # Sim project: 87 tests against ws-server.mjs (~58s)
npm run test:e2e:headed              # Sim project with the browser visible
npm run test:e2e:ui                  # Sim project in Playwright UI mode
npm run test:e2e:live                # Live-Pi project: 48 tests against the real Pi (~3 min)
npm run test:e2e:live:headed         # Live-Pi with the browser visible
npm run test:e2e:report              # Open the last run's HTML report
```

The live-Pi project requires `AWR_PI_PASSWORD` (or `AWR_PI_USE_AGENT=1`),
`AWR_PI_HOST` (defaults to `dmz@raspberry-pi.local`), and `AWR_PI_WS_URL`
(defaults to `ws://raspberry-pi.local:8889`). The `LIVE_PI=1` env var disables
the simulator `webServer` entry in `playwright.config.ts` so we don't waste a
port spinning it up.

## Conventions

- **TypeScript strict mode** enabled with `noUnusedLocals` and `noUnusedParameters`
- **No `any` casts** — Badge variant lookups use typed `Record<string, "default" | "success" | ...>` records
- **Explicit type imports** — use `import type { X }` for type-only imports
- **Button type safety** — all `<button>` elements in non-submit contexts use `type="button"`
- **Keyboard guards** — keyboard event handlers check for INPUT, TEXTAREA, SELECT, and contentEditable targets
- **No console.log in components** — ESLint warns on `console` usage
- **No files over 800 lines**

## Companion Project

This dashboard is designed to work with the **Zig AWR-V3 firmware** (`zig-awr-v3/`), a Zig rewrite of the original Python robot control software. The dashboard remains decoupled as long as the firmware exposes the same AWR-V3 WebSocket protocol.

The Zig repo's `scripts/install-pi.sh` is the equivalent of the vendor `setup.py` for the new stack, and ships an `awr-stack` helper (`python|zig|both|stop|status`) so a single Pi can host both the vendor `Adeept_Robot.service` and `awr-v3-zig.service` and switch between them. The dashboard's connection presets cover both ports out of the box.

## End-to-end black-box acceptance — dual-stack

The Zig repo's `scripts/run-functional-acceptance.sh` boots a **Raspberry Pi OS Bookworm** (`dtcooper/raspberrypi-os:bookworm`, `linux/arm64`) Docker image and runs the *entire* AWR-V3 stack end-to-end **for both implementations** — Zig firmware AND the vendor Adeept Python firmware (`setup.py` + `WebServer.py`) — including a live dual-stack phase where both run concurrently (vendor on `:8888`, Zig on `:8889`), `awr-stack` toggles, full uninstall, and a final **Phase N** that runs the on-Pi orchestrator (`scripts/in-situ-test.sh --rehearsal`) end-to-end against the same container so any script-logic regression is caught before the Pi sees it. 14 phases, ~70 seconds on Apple Silicon, currently 115 / 115 PASS.

When changing either side of the protocol contract (new command, new field on `get_map`, new auth strings, etc.) an agent must:

1. Mirror the change in `ws-server.mjs` (Node simulator) and Zig firmware (`src/net/ws_server.zig`); if the change is in the *common* protocol subset (movement, switches, functions, telemetry), also verify the vendor `WebServer.py` already supports it — if it does not, the change is a Zig-specific extension and must be gated on `INCLUDE_SLAM=1` (or a similar capability flag) in the generic test.
2. Add an assertion to **both** `tests/ws-protocol.test.mjs` (exercises the simulator's `/state` and `/capabilities` HTTP helpers) **and** `zig-awr-v3/scripts/acceptance/ws-protocol-test.mjs` (HTTP-helper-free; runs against the Zig binary, the Node simulator, and the vendor Python `WebServer.py`).
3. Re-run `bash zig-awr-v3/scripts/run-functional-acceptance.sh` (with `VENDOR_SRC` pointing at the vendor V3 source) and ensure all **14 phases** stay green (Phase N also re-installs from clean and runs the in-situ rehearsal end-to-end). This includes empirical evidence that the install scripts run, that the protocols are exercised across both implementations, that the two stacks coexist without conflict, and that the on-Pi runner has no script bugs.

This is the gating check that the dashboard, the Zig firmware, the vendor Python firmware, and the install/coexistence flow remain self-consistent without requiring a real Pi on the bench.

## In-situ acceptance test (real Pi)

When the Pi is reachable, the same protocol contract is verified against real `/dev/gpiomem`, real I2C ADS7830/PCA9685, real systemd, and real LAN via `zig-awr-v3/scripts/run-in-situ-test.sh`. The host-side driver `rsync`s the Zig repo to the Pi, runs `scripts/in-situ-test.sh` over SSH (10 phases including ADC battery probe, install-pi.sh real build, Zig binary boot, vendor `WebServer.py` boot, **live dual-stack on the same hardware**, and `awr-stack` toggle against real systemd), and with `--remote-protocol` re-runs `ws-protocol-test.mjs` from the developer host against `ws://<pi>:8889` — exactly the path the dashboard takes.

Agent expectations for protocol changes:

- Any new WebSocket command must keep both the Docker acceptance (88 / 88 PASS, 13 phases) and the in-situ acceptance green. The dashboard `ws-protocol.test.mjs` and `scripts/acceptance/ws-protocol-test.mjs` both gate on `WS_SKIP_MOTION` and `INCLUDE_SLAM` env vars; respect those when adding motor- or SLAM-touching tests so the in-situ runner can stay safe by default.
- Do not add HTTP helpers (`/state`, `/capabilities`) to the firmware-side acceptance test — those exist only on the Node simulator. The black-box test must work against the Zig binary and vendor `WebServer.py` with WebSocket only.
- The in-situ runner is the single source of truth for "this works on real hardware". The host-side driver is intentionally thin (`rsync + ssh`); all phase logic lives on the Pi side.

## Known Issues / Future Work

- The `resolution` dropdown in CameraView.tsx is cosmetic — it does not affect the stream URL
- The browser-only `OccupancyMap` (sim) is preserved for offline UI demos; the real surface is the new **Live Occupancy Map** panel which talks to the firmware via `mapping`/`get_map`/`slam_plan`
- Pose tracking on the Zig firmware is dead-reckoned (no encoders / IMU yet), so the live map drifts on long runs — mark this clearly in any new SLAM features
- The Capabilities gallery only opens implemented panels; other capabilities point users to the Control Deck, Robot Modes, Demo Pad, or telemetry
- WebSocket reconnection is not automatic — the user must click Disconnect/Connect manually