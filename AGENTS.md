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
| `ws-server.mjs` | Node WebSocket protocol simulator (incl. SLAM track) | ~250 |
| `scripts/run-protocol-tests.mjs` | Orchestrates simulator + protocol tests | ~80 |
| `scripts/setup-dashboard.sh` | One-shot local setup (Node check + npm install) | ~40 |
| `tests/ws-protocol.test.mjs` | Protocol acceptance tests (auth, telemetry, actions, SLAM) | ~210 |

## Development Commands

```bash
npm install                          # Install dependencies
npm run robot:sim                    # Start simulation server (port 8889)
npm run dev                          # Start Vite dev server (port 8080)
npx tsc -b --noEmit                  # Type check (strict mode, zero errors expected)
npx eslint src/                      # Lint (zero warnings with current config)
npm run test:protocol                # Starts simulator, runs protocol tests, exits
npm run test:protocol:only           # Tests only; expects robot:sim already on :8889
```

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

The Zig repo's `scripts/run-functional-acceptance.sh` boots a **Raspberry Pi OS Bookworm** (`dtcooper/raspberrypi-os:bookworm`, `linux/arm64`) Docker image and runs the *entire* AWR-V3 stack end-to-end **for both implementations** — Zig firmware AND the vendor Adeept Python firmware (`setup.py` + `WebServer.py`) — including a live dual-stack phase where both run concurrently (vendor on `:8888`, Zig on `:8889`) and the protocol test passes against both at the same time. 13 phases, ~100 seconds on Apple Silicon, currently 88 / 88 PASS.

When changing either side of the protocol contract (new command, new field on `get_map`, new auth strings, etc.) an agent must:

1. Mirror the change in `ws-server.mjs` (Node simulator) and Zig firmware (`src/net/ws_server.zig`); if the change is in the *common* protocol subset (movement, switches, functions, telemetry), also verify the vendor `WebServer.py` already supports it — if it does not, the change is a Zig-specific extension and must be gated on `INCLUDE_SLAM=1` (or a similar capability flag) in the generic test.
2. Add an assertion to **both** `tests/ws-protocol.test.mjs` (exercises the simulator's `/state` and `/capabilities` HTTP helpers) **and** `zig-awr-v3/scripts/acceptance/ws-protocol-test.mjs` (HTTP-helper-free; runs against the Zig binary, the Node simulator, and the vendor Python `WebServer.py`).
3. Re-run `bash zig-awr-v3/scripts/run-functional-acceptance.sh` (with `VENDOR_SRC` pointing at the vendor V3 source) and ensure all 13 phases stay green. This includes empirical evidence that the install scripts run, that the protocols are exercised across both implementations, and that the two stacks coexist without conflict.

This is the gating check that the dashboard, the Zig firmware, the vendor Python firmware, and the install/coexistence flow remain self-consistent without requiring a real Pi on the bench.

## Known Issues / Future Work

- The `resolution` dropdown in CameraView.tsx is cosmetic — it does not affect the stream URL
- The browser-only `OccupancyMap` (sim) is preserved for offline UI demos; the real surface is the new **Live Occupancy Map** panel which talks to the firmware via `mapping`/`get_map`/`slam_plan`
- Pose tracking on the Zig firmware is dead-reckoned (no encoders / IMU yet), so the live map drifts on long runs — mark this clearly in any new SLAM features
- The Capabilities gallery only opens implemented panels; other capabilities point users to the Control Deck, Robot Modes, Demo Pad, or telemetry
- WebSocket reconnection is not automatic — the user must click Disconnect/Connect manually