# AGENTS.md — Adeept AWR-V3 Dashboard

This document provides context for coding agents working on this project.

## Project Summary

A React/TypeScript web dashboard for the Adeept AWR-V3 4WD robot. It serves as both a documentation hub (hardware specs, software architecture, expansion proposals) and an interactive control interface (WebSocket-based robot control, camera feed, occupancy mapping).

## Architecture

### Frontend (React + Vite)

- **Entry**: `src/main.tsx` → `src/App.tsx`
- **Theme**: Dark mode only, defined via CSS custom properties in `src/index.css` using Tailwind v4's `@theme` directive
- **Path aliases**: `@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`)
- **Component pattern**: shadcn/ui style — primitive components in `src/components/ui/` use CVA (class-variance-authority) for variants. Application components compose these primitives.
- **State management**: Local React state only (useState/useRef). No global store. The `useWebSocket` hook in `src/hooks/useWebSocket.ts` manages WebSocket connection state, system info polling, and command logging.
- **No router**: Single-page scroll layout with anchor-based section navigation.

### WebSocket Simulation Server (`ws-server.mjs`)

- Runs on **Node.js** using `node:http` and `ws`
- Port **8889**
- Implements the AWR-V3 protocol: authentication handshake, command dispatch, simulated `get_info` telemetry with randomized values, and `/state` for protocol test assertions
- Stateless per-connection authentication (no sessions/tokens)
- Credentials are hardcoded in the simulator (`admin:123456`) since this is a development tool, not production

### Protocol Tests (`tests/ws-protocol.test.mjs` + `scripts/run-protocol-tests.mjs`)

- `npm run test:protocol` runs **`scripts/run-protocol-tests.mjs`**, which starts `ws-server.mjs`, waits for `/capabilities`, executes `node --test tests/ws-protocol.test.mjs`, then stops the simulator.
- `npm run test:protocol:only` assumes a listener is already on **`ws://localhost:8889`** — use with **`npm run robot:sim`** (Node simulator), not as a drop-in for arbitrary firmware without matching HTTP routes and auth strings.

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/App.tsx` | Root layout, navigation, app panel routing | ~130 |
| `src/hooks/useWebSocket.ts` | WebSocket connection, polling, command dispatch | ~120 |
| `src/components/ControlPanel.tsx` | Interactive robot controls with keyboard shortcuts | ~540 |
| `src/components/apps/OccupancyMap.tsx` | Canvas-based 2D grid exploration simulation | ~350 |
| `src/components/apps/AppGallery.tsx` | Capabilities and roadmap gallery with search/category tabs | ~250 |
| `src/components/apps/CameraView.tsx` | MJPEG stream viewer with connection controls | ~140 |
| `ws-server.mjs` | Node WebSocket protocol simulator | ~130 |
| `scripts/run-protocol-tests.mjs` | Orchestrates simulator + protocol tests | ~80 |
| `tests/ws-protocol.test.mjs` | Protocol acceptance tests | ~160 |

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

## Known Issues / Future Work

- The `resolution` dropdown in CameraView.tsx is cosmetic — it does not affect the stream URL
- The OccupancyMap simulation is frontend-only; real SLAM integration requires the Zig firmware's occupancy grid data streamed over WebSocket
- The Capabilities gallery only opens implemented panels; other capabilities point users to the Control Deck, Robot Modes, Demo Pad, or telemetry
- WebSocket reconnection is not automatic — the user must click Disconnect/Connect manually