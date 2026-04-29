import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for the Adeept AWR-V3 Dashboard E2E suite.
 *
 * The suite ships two complementary projects:
 *
 *   - `chromium`        — runs against the local Node WebSocket
 *                         simulator (`ws-server.mjs`). Deterministic,
 *                         hermetic, runnable on any laptop with no
 *                         hardware. This is the default when you run
 *                         `npm run test:e2e`.
 *   - `chromium-live-pi` — runs the dashboard against a real Pi over
 *                         LAN, exercising the full
 *                         UI → WebSocket → Zig firmware → PCA9685
 *                         path and asserting via SSH-based I²C reads
 *                         that the right H-bridge channels light up.
 *                         Selected with `--project=chromium-live-pi`
 *                         (or `npm run test:e2e:live`).
 *
 * The live-pi project never starts the simulator webServer — it
 * relies on the Pi already being up. Both projects share the Vite
 * dev server because the dashboard *is* the system under test.
 *
 * Set `reuseExistingServer` to true outside CI so devs can keep their
 * `npm run dev` / `npm run robot:sim` running between iterations.
 */
const PORT_DEV = 8080
const PORT_SIM = 8889

const LIVE_PI = process.env.LIVE_PI === '1'

const webServers = [
  {
    command: 'npm run dev -- --port ' + PORT_DEV,
    url: `http://localhost:${PORT_DEV}`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe' as const,
    stderr: 'pipe' as const,
    timeout: 60_000,
  },
]

if (!LIVE_PI) {
  webServers.unshift({
    command: 'npm run robot:sim',
    url: `http://localhost:${PORT_SIM}/capabilities`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe' as const,
    stderr: 'pipe' as const,
    timeout: 30_000,
  })
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,

  // Both projects own a single piece of mutable state (the simulator
  // process for `chromium`, the live PCA9685 chip for
  // `chromium-live-pi`). Concurrent specs would race each other, so
  // we pin to one worker per project run.
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  outputDir: 'test-results',

  use: {
    baseURL: `http://localhost:${PORT_DEV}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      testDir: './tests/e2e/specs',
      testIgnore: /live\//,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-live-pi',
      testDir: './tests/e2e/live',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: webServers,
})
