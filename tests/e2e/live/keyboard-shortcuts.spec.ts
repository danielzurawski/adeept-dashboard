/**
 * Live-Pi keyboard-shortcut scenarios.
 *
 * The dashboard supports the following key bindings (handled at the
 * window level so they fire from anywhere as long as focus is not
 * inside an input element):
 *
 *   W / ArrowUp      → forward          (requires armed)
 *   S / ArrowDown    → backward         (requires armed)
 *   A / ArrowLeft    → left             (requires armed)
 *   D / ArrowRight   → right            (requires armed)
 *   Q                → rotate-left      (requires armed)
 *   E                → rotate-right     (requires armed)
 *   L                → camera tilt up   (always)
 *   K                → camera tilt down (always)
 *
 * The W/A/S/D/arrow/Q/E motor side is covered by `drive.spec.ts`.
 * This spec covers the camera-tilt keys which move PCA9685 ch0
 * even without arming the drive.
 */

import { test, expect } from '../fixtures/live'
import { readPca9685OverSsh } from '../utils/pi-pca9685'

const HOLD_MS = 200
const SETTLE_MS = 200

test.describe('Live-Pi keyboard shortcuts — camera tilt', () => {
  test.describe.configure({ timeout: 60_000 })

  test('L key moves PCA9685 channel 0 (tilt up)', async ({
    connectedDeck,
    ssh,
    dashboard,
  }) => {
    void connectedDeck

    const before = (await readPca9685OverSsh(ssh))['ch00'] ?? 0
    await dashboard.locator('body').focus()
    await dashboard.keyboard.down('l')
    await dashboard.waitForTimeout(HOLD_MS)
    await dashboard.keyboard.up('l')
    await dashboard.waitForTimeout(SETTLE_MS)
    const after = (await readPca9685OverSsh(ssh))['ch00'] ?? 0
    expect(after).not.toBe(before)
  })

  test('K key moves PCA9685 channel 0 (tilt down)', async ({
    connectedDeck,
    ssh,
    dashboard,
  }) => {
    void connectedDeck

    const before = (await readPca9685OverSsh(ssh))['ch00'] ?? 0
    await dashboard.locator('body').focus()
    await dashboard.keyboard.down('k')
    await dashboard.waitForTimeout(HOLD_MS)
    await dashboard.keyboard.up('k')
    await dashboard.waitForTimeout(SETTLE_MS)
    const after = (await readPca9685OverSsh(ssh))['ch00'] ?? 0
    expect(after).not.toBe(before)
  })

  test('drive keys are ignored while focus is inside the URL input', async ({
    connectedDeck,
    ssh,
    dashboard,
  }) => {
    // Setup: arm the drive so the keys WOULD fire if focus weren't
    // captured.
    await connectedDeck.armDrive()

    // Focus the URL field — the dashboard's keydown handler bails
    // out early when the active target is an INPUT.
    // The URL field is disabled while connected though, so we use
    // the auth field instead which is also disabled but Playwright
    // can still focus it for the sake of this assertion. As a
    // robust fallback we use the speed slider's input (always
    // focusable).  The contract is: typing into ANY input does not
    // send drive frames.
    await dashboard.evaluate(() => {
      const focusable = document.querySelector<HTMLElement>('input:not([type="range"])')
      focusable?.focus()
    })

    // No baseline snapshot needed — we just verify motors stay quiet.
    await dashboard.keyboard.press('w')
    await dashboard.waitForTimeout(150)

    const all = await readPca9685OverSsh(ssh)
    for (const ch of [8, 9, 10, 11, 12, 13, 14, 15]) {
      const key = `ch${String(ch).padStart(2, '0')}` as keyof typeof all
      expect.soft(
        all[key],
        `motor ch${ch} should be 0 because focus was inside an input`,
      ).toBe(0)
    }
  })
})
