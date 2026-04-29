/**
 * Connection lifecycle scenarios.
 *
 * The dashboard's connection panel is the user's gateway to the
 * robot. It must:
 *
 *   - Default to the simulator preset on a fresh load.
 *   - Allow the user to pick a preset, override the URL/auth, and
 *     persist both inputs across reloads via `localStorage`.
 *   - Display a clear connection state ("Disconnected", "Connecting…",
 *     "Connected") and a backend label inferred from the WS URL.
 *   - Disable the URL/auth/preset inputs while a session is live, so
 *     the operator can't accidentally re-target a robot mid-control.
 *
 * These tests rely solely on the dashboard's UI and the simulator's
 * `/state` endpoint; no real robot is required.
 */

import { test, expect } from '../fixtures/dashboard'

test.describe('Connection lifecycle', () => {
  test('connects to the local simulator and reflects the live state in the badge', async ({
    controlDeck,
    dashboard,
  }) => {
    // Baseline: badge says Disconnected before we click Connect.
    await expect(controlDeck.connectionStatusText).toHaveText('Disconnected')
    await expect(controlDeck.connectButton).toHaveText('Connect')

    // Header carries an "Offline" badge when not connected.
    await expect(dashboard.getByText(/^Offline$/)).toBeVisible()

    await controlDeck.connect()

    // The button label flips to Disconnect, the inline status flips
    // to Connected, and the header badge flips to "Connected".
    await expect(controlDeck.connectButton).toHaveText('Disconnect')
    await expect(dashboard.getByText(/^Connected$/).first()).toBeVisible()
  })

  test('disconnects cleanly on demand', async ({ connectedDeck }) => {
    await connectedDeck.disconnect()
    await expect(connectedDeck.connectionStatusText).toHaveText('Disconnected')
    await expect(connectedDeck.connectButton).toHaveText('Connect')
  })

  test('persists the URL and auth across reloads via localStorage', async ({
    dashboard,
    controlDeck,
  }) => {
    // The dashboard only writes the URL and auth to localStorage when
    // the operator clicks Connect — that's the only moment the
    // dashboard considers a (URL, auth) pair "committed". Clicking
    // Connect against the local simulator triggers the persistence
    // and lets us verify it across a reload without depending on
    // background traffic.
    await controlDeck.connect()
    await controlDeck.disconnect()

    await dashboard.reload()

    // After the reload, the inputs are populated from localStorage.
    await expect(controlDeck.urlInput).toHaveValue('ws://localhost:8889')
    await expect(controlDeck.authInput).toHaveValue('admin:123456')
  })

  test('locks the connection inputs while a session is live', async ({
    connectedDeck,
  }) => {
    // While connected, no operator should be able to retarget the
    // dashboard onto a different robot. Each input is rendered
    // `disabled={connected || connecting}`.
    await expect(connectedDeck.urlInput).toBeDisabled()
    await expect(connectedDeck.authInput).toBeDisabled()
    await expect(connectedDeck.presetSelect).toBeDisabled()
  })

  test('records the connection handshake in the command log', async ({
    connectedDeck,
  }) => {
    // The hook logs the open event and the auth banner immediately.
    await connectedDeck.expectLogContains('Connected to robot server')
    await connectedDeck.expectLogContains('<auth>')
  })

  test('backend badge reflects the WS URL — Simulator / Zig / Python / Custom', async ({
    controlDeck,
  }) => {
    // Default URL is the local simulator → "Simulator backend".
    await expect(controlDeck.backendBadge).toHaveText('Simulator backend')

    // Switching to a Zig host (port 8889 and not localhost) flips it
    // to "Zig backend".
    await controlDeck.fillUrl('ws://raspberry-pi.local:8889')
    await expect(controlDeck.backendBadge).toHaveText('Zig backend')

    // Port 8888 → vendor Python backend.
    await controlDeck.fillUrl('ws://raspberry-pi.local:8888')
    await expect(controlDeck.backendBadge).toHaveText('Python backend')

    // Anything else → Custom.
    await controlDeck.fillUrl('ws://192.168.1.99:9999')
    await expect(controlDeck.backendBadge).toHaveText('Custom backend')

    // Restore the simulator default so subsequent tests are isolated.
    await controlDeck.fillUrl('ws://localhost:8889')
  })

  test('preset dropdown populates URL + auth inputs', async ({
    controlDeck,
  }) => {
    // Presets defined in ControlPanel.tsx — pick each, assert inputs
    // match. We don't connect; the dashboard's persistence layer
    // already has its own coverage above.
    const presets = [
      {
        label: 'Local simulator',
        url: 'ws://localhost:8889',
        auth: 'admin:123456',
      },
      {
        label: 'Python robot (LAN)',
        url: 'ws://192.168.86.34:8888',
        auth: 'admin:123456',
      },
      {
        label: 'Python robot (.local)',
        url: 'ws://raspberry-pi.local:8888',
        auth: 'admin:123456',
      },
      {
        label: 'Zig robot (.local)',
        url: 'ws://raspberry-pi.local:8889',
        auth: 'admin:123456',
      },
    ] as const

    for (const preset of presets) {
      await controlDeck.selectPreset(preset.label)
      await expect(controlDeck.urlInput).toHaveValue(preset.url)
      await expect(controlDeck.authInput).toHaveValue(preset.auth)
    }
  })

  test('status dot is destructive while disconnected, success when connected', async ({
    controlDeck,
  }) => {
    // Tailwind classes:
    //   bg-destructive   → disconnected
    //   bg-warning + animate-pulse → connecting
    //   bg-success       → connected
    await expect(controlDeck.connectionStatusDot).toHaveClass(/bg-destructive/)

    await controlDeck.connect()
    await expect(controlDeck.connectionStatusDot).toHaveClass(/bg-success/)

    await controlDeck.disconnect()
    await expect(controlDeck.connectionStatusDot).toHaveClass(/bg-destructive/)
  })
})
