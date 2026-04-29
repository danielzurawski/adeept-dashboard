/**
 * Playwright fixtures for the **live-Pi** project. Whereas the
 * default `dashboard` fixture in `dashboard.ts` points the dashboard
 * at the local Node WebSocket simulator, this fixture points it at a
 * real Raspberry Pi running the Zig firmware so we can exercise the
 * full end-to-end path:
 *
 *     React UI  →  WebSocket frame  →  Zig dispatcher  →
 *     PCA9685 PWM channels  →  H-bridge  →  motor coils
 *
 * The simulator-based suite owns the protocol-shape contract; this
 * suite owns the on-the-wire behaviour. They are intentionally
 * separate projects (see `playwright.config.ts`) so a developer with
 * no Pi can run the simulator suite locally without touching env
 * vars, while a developer with a Pi runs `npm run test:e2e:live`.
 *
 * Required env:
 *
 *   - `AWR_PI_HOST`           e.g. `dmz@raspberry-pi.local` (default).
 *   - `AWR_PI_PASSWORD`       password for `sshpass` (or set
 *                              `AWR_PI_USE_AGENT=1` to use the SSH
 *                              agent + key auth).
 *   - `AWR_PI_WS_URL`         dashboard target — defaults to
 *                              `ws://raspberry-pi.local:8889` (Zig
 *                              firmware port).
 *   - `AWR_PI_WS_AUTH`        defaults to `admin:123456`.
 *
 * Behavioural guarantees the fixtures provide:
 *
 *   - `liveReset` — every test starts with motors quiescent
 *     (PCA9685 ch08–ch15 all read 0). Achieves this by sending a
 *     full quiescing burst over WS *and* probing the chip directly.
 *   - `dashboard`  — first load seeds localStorage with the live-Pi
 *     URL/auth so the connection panel is pre-populated.
 *   - `connectedDeck` — connects to the live Pi and waits for the
 *     "Connected" banner before yielding.
 *
 * After every test, the suite re-asserts that motors are quiescent.
 * If a test left them spinning, the *next* test will fail loudly via
 * `liveReset` rather than silently coexist with stale PWM.
 */

import { test as base, expect, type Page } from '@playwright/test'
import { WebSocket as NodeWebSocket } from 'ws'
import { ControlDeck } from '../pages/control-deck'
import { AppGallery } from '../pages/app-gallery'
import {
  readMotorChannels,
  sshConfigFromEnv,
  type SshConfig,
} from '../utils/pi-pca9685'

const WS_URL = process.env.AWR_PI_WS_URL ?? 'ws://raspberry-pi.local:8889'
const WS_AUTH = process.env.AWR_PI_WS_AUTH ?? 'admin:123456'

interface LiveFixtures {
  ssh: SshConfig
  liveReset: void
  dashboard: Page
  controlDeck: ControlDeck
  appGallery: AppGallery
  connectedDeck: ControlDeck
}

/**
 * Send a quiescing command burst over a one-shot WebSocket
 * connection. We don't rely on the dashboard for this — we want the
 * fixture to work even when the dashboard is in a degraded state.
 */
async function quiesceFirmware(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const ws = new NodeWebSocket(WS_URL)
    const timeout = setTimeout(() => {
      ws.close()
      reject(
        new Error(
          `quiesceFirmware: timed out connecting to ${WS_URL}. ` +
            `Check that the Zig service is running on the Pi: ` +
            `ssh ${process.env.AWR_PI_HOST ?? 'dmz@raspberry-pi.local'} ` +
            `'systemctl is-active awr-v3-zig.service'.`,
        ),
      )
    }, 5_000)

    ws.on('open', () => {
      clearTimeout(timeout)
      ws.send(WS_AUTH)
      // The Zig firmware accepts each frame as it lands; this list
      // mirrors the simulator's reset sequence so the surface is
      // explicitly quiet (motors AND tilt AND switches AND speed).
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
      // Generous flush window — the network round-trip + Zig
      // mutex contention can take a few hundred ms on the Pi 3B.
      setTimeout(() => {
        try {
          ws.close()
        } catch {
          /* ignore */
        }
        resolve()
      }, 250)
    })
    ws.on('error', (e: Error) => {
      clearTimeout(timeout)
      reject(e)
    })
  })
}

export const test = base.extend<LiveFixtures>({
  ssh: async ({}, use) => {
    const cfg = sshConfigFromEnv()
    if (!cfg.useAgent && !cfg.password) {
      test.skip(
        true,
        'live-pi project requires AWR_PI_PASSWORD or AWR_PI_USE_AGENT=1',
      )
    }
    await use(cfg)
  },

  liveReset: [
    async ({ ssh }, use) => {
      await quiesceFirmware()

      const motors = await readMotorChannels(ssh)
      for (const ch of [8, 9, 10, 11, 12, 13, 14, 15]) {
        if (motors[ch] !== 0) {
          throw new Error(
            `liveReset: PCA9685 ch${ch} = ${motors[ch]} after quiescing burst. ` +
              `Motors are not idle — refusing to start the test. ` +
              `Power-cycle the robot or send DS/TS manually before retrying.`,
          )
        }
      }

      await use()

      // Best-effort post-test cleanup.  We never want a failing test
      // to leave the wheels spinning.
      try {
        await quiesceFirmware()
      } catch {
        /* swallow — the next test's liveReset will detect this */
      }
    },
    { auto: true },
  ],

  dashboard: async ({ page }, use) => {
    await page.addInitScript(
      ({ url, auth }) => {
        try {
          if (!localStorage.getItem('awr-v3.wsUrl')) {
            localStorage.setItem('awr-v3.wsUrl', url)
          }
          if (!localStorage.getItem('awr-v3.wsAuth')) {
            localStorage.setItem('awr-v3.wsAuth', auth)
          }
        } catch {
          /* ignore */
        }
      },
      { url: WS_URL, auth: WS_AUTH },
    )
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
    // Make sure the URL/auth are pointed at the Pi (defensive — if a
    // dev runs both projects in the same browser profile, the sim
    // values might still be in localStorage).  The connect() helper
    // simply clicks Connect with whatever the inputs hold, so we
    // re-fill them here to be safe.
    await controlDeck.fillUrl(WS_URL)
    await controlDeck.fillAuth(WS_AUTH)
    await controlDeck.connect()
    await use(controlDeck)
    try {
      await controlDeck.disconnect()
    } catch {
      /* ignore */
    }
  },
})

export { expect }
