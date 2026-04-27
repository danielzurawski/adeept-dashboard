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

- Runs on **Bun** (not Node.js) using `Bun.serve()` with native WebSocket support
- Port **8889**
- Implements the full AWR-V3 protocol: authentication handshake, command dispatch, simulated `get_info` telemetry with randomized values
- Stateless per-connection authentication (no sessions/tokens)
- Credentials are hardcoded in the simulator (`admin:123456`) since this is a development tool, not production

### E2E Tests (`tests/ws-protocol.test.ts`)

- Uses **Bun's test runner** (`bun:test`)
- 55 tests across 12 suites validating every protocol command
- Tests connect to `ws://localhost:8889` — requires the simulation server (or the Zig firmware server) to be running
- Helper functions: `openWs()`, `sendAndReceive()`, `authenticate()`, `authAndCommand()`
- Tests are intentionally compatible with both the Bun simulator AND the Zig firmware server — the same 55 tests pass against either

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/App.tsx` | Root layout, navigation, app panel routing | ~130 |
| `src/hooks/useWebSocket.ts` | WebSocket connection, polling, command dispatch | ~120 |
| `src/components/ControlPanel.tsx` | Interactive robot controls with keyboard shortcuts | ~305 |
| `src/components/apps/OccupancyMap.tsx` | Canvas-based 2D grid exploration simulation | ~350 |
| `src/components/apps/AppGallery.tsx` | 28-app gallery with search and category tabs | ~160 |
| `src/components/apps/CameraView.tsx` | MJPEG stream viewer with connection controls | ~140 |
| `ws-server.mjs` | Bun WebSocket protocol simulator | ~78 |
| `tests/ws-protocol.test.ts` | 55 E2E protocol acceptance tests | ~510 |

## Development Commands

```bash
npm install                          # Install dependencies
bun run ws-server.mjs &              # Start simulation server (port 8889)
npm run dev                          # Start Vite dev server (port 8080)
npx tsc -b --noEmit                  # Type check (strict mode, zero errors expected)
npx eslint src/                      # Lint (zero errors, 1 accepted shadcn warning expected)
bun test                             # Run 55 E2E tests (requires ws-server running)
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

This dashboard is designed to work with the **Zig AWR-V3 firmware** (`zig-awr-v3/`), a Zig rewrite of the original Python robot control software. The same 55 E2E tests validate both the Bun simulation server and the Zig firmware's WebSocket server. The Zig server uses environment variables `AWR_WS_USER`/`AWR_WS_PASS` for credentials instead of hardcoding them.

## Known Issues / Future Work

- The `resolution` dropdown in CameraView.tsx is cosmetic — it does not affect the stream URL
- The OccupancyMap simulation is frontend-only; real SLAM integration requires the Zig firmware's occupancy grid data streamed over WebSocket
- The AppGallery "Open" button only works for `camera-view` and `occupancy-map`; other apps show the button but have no panel implementation yet
- WebSocket reconnection is not automatic — the user must click Disconnect/Connect manually