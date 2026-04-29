/**
 * Live-Pi drive scenarios.
 *
 * These tests close the loop the simulator suite intentionally
 * cannot:
 *
 *   1. Open the React dashboard in Chromium.
 *   2. Connect to the **real** Zig firmware on the Pi over WebSocket.
 *   3. Press a real drive button (or fire a real keyboard shortcut).
 *   4. Read PCA9685 channel duty cycles directly off the I²C bus
 *      via SSH and verify the H-bridge inputs are pulsing exactly
 *      the channels the firmware should drive for that intent.
 *   5. Release the button and verify the chip returns to all-zero.
 *
 * If any link in the chain breaks — a JS bug that emits the wrong WS
 * frame, a Zig dispatch typo, a PCA9685 init regression — *one* of
 * these tests will fail with a useful diff between the channel set
 * the firmware *should* drive and the channels actually pulsing.
 *
 * Safety notes:
 *
 *   - Each test holds the drive button only long enough to perform
 *     a single SSH-based PCA9685 probe (~1.5 s) plus a small buffer.
 *   - The fixture pre-flight verifies the chip is quiescent before
 *     each test starts, and post-flight quiesces the firmware again
 *     so a failed test cannot leave the wheels spinning.
 *   - Run with the bot on a stand. The wheels WILL turn.
 */

import { test, expect } from '../fixtures/live'
import { readMotorChannels, MOTOR_INTENT } from '../utils/pi-pca9685'
import type { DriveDirection } from '../pages/control-deck'

const HOLD_FOR_PROBE_MS = 200

/**
 * Maps the dashboard's drive button identifiers (used in the
 * page-object locators) to the firmware's intent vocabulary
 * (`MOTOR_INTENT` in `pi-pca9685.ts`).
 */
const DRIVE_TO_INTENT: Record<DriveDirection, keyof typeof MOTOR_INTENT> = {
  forward: 'forward',
  backward: 'backward',
  left: 'left',
  right: 'right',
  'rotate-left': 'rotate-left',
  'rotate-right': 'rotate-right',
}

test.describe('Live-Pi drive — UI to PWM round-trip', () => {
  test.describe.configure({ timeout: 60_000 })

  for (const direction of [
    'forward',
    'backward',
    'left',
    'right',
    'rotate-left',
    'rotate-right',
  ] as const) {
    test(`pressing ${direction} drives the expected H-bridge channels`, async ({
      connectedDeck,
      ssh,
      dashboard,
    }) => {
      // Arm drive — the dashboard refuses motor commands until the
      // operator explicitly arms the drive train. This is the same
      // safety gate a human user passes through.
      await connectedDeck.armDrive()

      const intent = MOTOR_INTENT[DRIVE_TO_INTENT[direction]]

      // Press-and-hold the drive button without releasing yet, so the
      // PCA9685 stays pulsing while we read it.
      const button = connectedDeck.driveButton(direction)
      await button.dispatchEvent('pointerdown')

      // Give the WS frame time to land and the Zig dispatcher time
      // to write all 8 motor registers.  The dispatcher is mutex'd
      // and writes 4 channels (4 bytes each), so 100 ms is generous.
      await dashboard.waitForTimeout(HOLD_FOR_PROBE_MS)

      const motorsActive = await readMotorChannels(ssh)

      // Every channel the firmware *should* be driving must be > 0.
      for (const ch of intent.active) {
        expect.soft(motorsActive[ch], `expected ch${ch} active for ${direction}`).toBeGreaterThan(0)
      }
      // Every channel the firmware *should not* drive must be 0.
      for (const ch of intent.idle) {
        expect.soft(motorsActive[ch], `expected ch${ch} idle for ${direction}`).toBe(0)
      }

      // Release the button — pointerup fires `DS` (drive stop).
      await button.dispatchEvent('pointerup')
      await dashboard.waitForTimeout(150)

      const motorsIdle = await readMotorChannels(ssh)
      for (const ch of [8, 9, 10, 11, 12, 13, 14, 15]) {
        expect.soft(
          motorsIdle[ch],
          `expected ch${ch} idle after pointerup (${direction})`,
        ).toBe(0)
      }
    })
  }

  test('Stop All button forces PCA9685 motor channels to zero', async ({
    connectedDeck,
    ssh,
    dashboard,
  }) => {
    await connectedDeck.armDrive()

    // Dirty motion first.
    const fwd = connectedDeck.driveButton('forward')
    await fwd.dispatchEvent('pointerdown')
    await dashboard.waitForTimeout(HOLD_FOR_PROBE_MS)
    const motorsMoving = await readMotorChannels(ssh)
    expect.soft(motorsMoving[15], 'forward should drive ch15').toBeGreaterThan(0)
    await fwd.dispatchEvent('pointerup')

    // Stop All hits the firmware with DS regardless of arm state.
    await connectedDeck.stopAllButton.click()
    await dashboard.waitForTimeout(150)

    const motorsAfter = await readMotorChannels(ssh)
    for (const ch of [8, 9, 10, 11, 12, 13, 14, 15]) {
      expect.soft(
        motorsAfter[ch],
        `expected ch${ch} idle after Stop All`,
      ).toBe(0)
    }
  })

  test('changing the speed slider changes the PWM duty cycle', async ({
    connectedDeck,
    ssh,
    dashboard,
  }) => {
    await connectedDeck.armDrive()
    const fwd = connectedDeck.driveButton('forward')

    await connectedDeck.setSpeed(50)
    await fwd.dispatchEvent('pointerdown')
    await dashboard.waitForTimeout(HOLD_FOR_PROBE_MS)
    const at50 = await readMotorChannels(ssh)
    await fwd.dispatchEvent('pointerup')
    await dashboard.waitForTimeout(150)

    await connectedDeck.setSpeed(100)
    await fwd.dispatchEvent('pointerdown')
    await dashboard.waitForTimeout(HOLD_FOR_PROBE_MS)
    const at100 = await readMotorChannels(ssh)
    await fwd.dispatchEvent('pointerup')
    await dashboard.waitForTimeout(150)

    // ch15 is the M1 forward channel. At 100% it should be roughly
    // 2× the duty cycle observed at 50%.  Allow generous tolerance —
    // the read sees whatever PWM was on the wire at the moment of
    // the SSH read and is not phase-aligned with the firmware
    // write.
    expect(at100[15]).toBeGreaterThan(at50[15])
    expect(at50[15]).toBeGreaterThan(0)
    expect(at100[15]).toBeGreaterThan(0)
  })
})

test.describe('Live-Pi drive — keyboard shortcuts', () => {
  test('W keystroke produces forward H-bridge pattern', async ({
    connectedDeck,
    ssh,
    dashboard,
  }) => {
    await connectedDeck.armDrive()

    // Focus the body so the global keydown listener picks it up.
    await dashboard.locator('body').focus()
    await dashboard.keyboard.down('w')
    await dashboard.waitForTimeout(HOLD_FOR_PROBE_MS)

    const motors = await readMotorChannels(ssh)
    for (const ch of MOTOR_INTENT.forward.active) {
      expect.soft(motors[ch], `W: expected ch${ch} active`).toBeGreaterThan(0)
    }
    for (const ch of MOTOR_INTENT.forward.idle) {
      expect.soft(motors[ch], `W: expected ch${ch} idle`).toBe(0)
    }

    await dashboard.keyboard.up('w')
    await dashboard.waitForTimeout(150)

    const motorsAfter = await readMotorChannels(ssh)
    for (const ch of [8, 9, 10, 11, 12, 13, 14, 15]) {
      expect.soft(
        motorsAfter[ch],
        `W keyup: expected ch${ch} idle`,
      ).toBe(0)
    }
  })
})
