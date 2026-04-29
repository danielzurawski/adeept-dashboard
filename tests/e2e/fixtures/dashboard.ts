/**
 * Custom Playwright test fixtures for the AWR-V3 dashboard.
 *
 * The fixtures provided here:
 *
 *   - `dashboard`       — a freshly-loaded dashboard at `/`, with
 *                          localStorage pre-seeded so that the
 *                          connection inputs default to the local
 *                          simulator (the `Local simulator` preset is
 *                          already first in the dropdown but a hostile
 *                          earlier test could have changed it; we
 *                          force a known baseline).
 *   - `controlDeck`     — a `ControlDeck` page object bound to the page.
 *   - `appGallery`      — an `AppGallery` page object bound to the page.
 *   - `connectedDeck`   — a `ControlDeck` already connected and
 *                          authenticated against the simulator,
 *                          ready for assertions on commands.
 *   - `simulatorReset`  — runs once per test before the page loads,
 *                          resetting the simulator's mutable state by
 *                          firing a few neutralising commands. This
 *                          guarantees test isolation without needing
 *                          to restart the `ws-server.mjs` process.
 *
 * Tests should `import { test, expect } from '../fixtures/dashboard'`
 * rather than from `@playwright/test` directly so they pick up these
 * fixtures.
 */

import { test as base, expect, type Page } from '@playwright/test'
import { WebSocket as NodeWebSocket } from 'ws'
import { ControlDeck } from '../pages/control-deck'
import { AppGallery } from '../pages/app-gallery'
import { getSimulatorState } from '../utils/sim-client'

const SIMULATOR_BASE_URL = 'http://localhost:8889'

interface Fixtures {
  dashboard: Page
  controlDeck: ControlDeck
  appGallery: AppGallery
  connectedDeck: ControlDeck
  simulatorReset: void
}

export const test = base.extend<Fixtures>({
  /**
   * Reset the simulator's mutable state before every test by sending
   * a short sequence of neutralising commands over a one-shot WS
   * connection. We can't restart the simulator process between tests
   * (Playwright's `webServer` keeps it alive for the whole suite), so
   * this is the cheapest way to guarantee `lastMotion`, `lastTilt`,
   * `lights`, `switches`, etc. all start in a known state.
   */
  simulatorReset: [
    async ({ request }, use) => {
      // Use the `ws` package directly. Playwright's test process runs
      // under whichever Node ships globally on the developer's
      // machine, and the global `WebSocket` constructor only landed
      // in Node 22 — older versions throw `ReferenceError`. The `ws`
      // import works on every Node we support and is already a
      // first-class dependency of the dashboard.
      await new Promise<void>((resolve, reject) => {
        const ws = new NodeWebSocket(`ws://localhost:8889`)
        ws.on('open', () => {
          ws.send('admin:123456')
          // The simulator acks each command synchronously, but we
          // don't actually need to wait — by the time we close
          // the socket the server has already mutated state.
          for (const cmd of [
            'DS',
            'TS',
            'UDstop',
            'wsB 50',
            'mappingOff',
            'slam_reset',
            'policeOff',
            'lights_off',
            'Switch_1_off',
            'Switch_2_off',
            'Switch_3_off',
            'stopCV',
            'automaticOff',
            'trackLineOff',
            'keepDistanceOff',
          ]) {
            ws.send(cmd)
          }
          // Give the server ~100 ms to flush. The simulator processes
          // each frame as it arrives so this is overkill, but it
          // protects against scheduler hiccups under load.
          setTimeout(() => {
            try {
              ws.close()
            } catch {
              /* ignore */
            }
            resolve()
          }, 100)
        })
        ws.on('error', (e: Error) => reject(e))
      })

      // Sanity: the simulator should now report a quiescent state.
      const state = await getSimulatorState(request, SIMULATOR_BASE_URL)
      if (state.slam.mapping) {
        throw new Error(
          'Simulator reset did not clear SLAM mapping. ' +
            'Inspect ws-server.mjs / sim state.',
        )
      }
      await use()
    },
    { auto: true },
  ],

  dashboard: async ({ page }, use) => {
    // Force the connection panel to default to the simulator on the
    // *first* page load of each test by seeding localStorage with the
    // simulator URL/auth — but only when the keys are absent. This
    // way:
    //   • Fresh test runs are deterministic (no leakage from a prior
    //     dev session).
    //   • Tests that exercise persistence by writing new values via
    //     the UI and then reloading still see their writes (the init
    //     script no-ops on subsequent loads where the keys exist).
    await page.addInitScript(() => {
      try {
        if (!localStorage.getItem('awr-v3.wsUrl')) {
          localStorage.setItem('awr-v3.wsUrl', 'ws://localhost:8889')
        }
        if (!localStorage.getItem('awr-v3.wsAuth')) {
          localStorage.setItem('awr-v3.wsAuth', 'admin:123456')
        }
      } catch {
        /* localStorage may be unavailable in some browser modes */
      }
    })
    await page.goto('/')
    await expect(page).toHaveTitle(/Adeept AWR-V3 Dashboard/)
    await use(page)
  },

  controlDeck: async ({ dashboard }, use) => {
    await use(new ControlDeck(dashboard))
  },

  appGallery: async ({ dashboard }, use) => {
    await use(new AppGallery(dashboard))
  },

  connectedDeck: async ({ controlDeck }, use) => {
    await controlDeck.connect()
    await use(controlDeck)
  },
})

export { expect }
