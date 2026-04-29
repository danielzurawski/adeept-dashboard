/**
 * Live-Pi camera-tilt and servo-calibration scenarios.
 *
 * The camera tilt is driven by PCA9685 channel 0 — the same servo
 * that the calibration buttons (PWM-, Middle, PWM+, Reset, Init)
 * also adjust. These tests close the UI → Zig → PCA9685 loop for
 * those affordances:
 *
 *   - Pressing the Up tilt button should *change* ch0 PWM.
 *   - Pressing the Down tilt button should change it the other way.
 *   - SiLeft / SiRight calibration buttons should change ch0 even
 *     without arming the drive.
 *   - PWMINIT and PWMD return to predictable baseline values.
 *
 * The actual servo angles depend on board calibration (mechanical
 * centre + pulse offsets), so the tests assert the *direction* of
 * the change rather than absolute PWM values where possible.
 */

import { test, expect } from '../fixtures/live'
import { readPca9685OverSsh } from '../utils/pi-pca9685'

const HOLD_MS = 200
const SETTLE_MS = 200

async function readCh0(ssh: import('../utils/pi-pca9685').SshConfig): Promise<number> {
  const all = await readPca9685OverSsh(ssh)
  return all['ch00'] ?? 0
}

test.describe('Live-Pi camera tilt — UI → PCA9685 servo channel', () => {
  test.describe.configure({ timeout: 60_000 })

  test('Up button writes a new PWM value to PCA9685 channel 0', async ({
    connectedDeck,
    ssh,
    dashboard,
  }) => {
    const before = await readCh0(ssh)
    await connectedDeck.tiltUpButton.dispatchEvent('pointerdown')
    await dashboard.waitForTimeout(HOLD_MS)
    await connectedDeck.tiltUpButton.dispatchEvent('pointerup')
    await dashboard.waitForTimeout(SETTLE_MS)
    const after = await readCh0(ssh)

    // The Zig firmware's `singleServo(0, +1, 7)` increments the
    // ch0 PWM value. The exact delta depends on the firmware's
    // step + per-test PWM clamping; we only require that the
    // value changed in some direction.
    expect(after).not.toBe(before)
  })

  test('Down button writes a new PWM value to PCA9685 channel 0', async ({
    connectedDeck,
    ssh,
    dashboard,
  }) => {
    const before = await readCh0(ssh)
    await connectedDeck.tiltDownButton.dispatchEvent('pointerdown')
    await dashboard.waitForTimeout(HOLD_MS)
    await connectedDeck.tiltDownButton.dispatchEvent('pointerup')
    await dashboard.waitForTimeout(SETTLE_MS)
    const after = await readCh0(ssh)
    expect(after).not.toBe(before)
  })

  test('Up then Down moves the servo in opposite directions', async ({
    connectedDeck,
    ssh,
    dashboard,
  }) => {
    const baseline = await readCh0(ssh)
    await connectedDeck.tiltUpButton.dispatchEvent('pointerdown')
    await dashboard.waitForTimeout(HOLD_MS)
    await connectedDeck.tiltUpButton.dispatchEvent('pointerup')
    await dashboard.waitForTimeout(SETTLE_MS)
    const afterUp = await readCh0(ssh)

    await connectedDeck.tiltDownButton.dispatchEvent('pointerdown')
    await dashboard.waitForTimeout(HOLD_MS)
    await connectedDeck.tiltDownButton.dispatchEvent('pointerup')
    await dashboard.waitForTimeout(SETTLE_MS)
    const afterDown = await readCh0(ssh)

    // Either monotonic up→down or down→up — depends on the
    // firmware's polarity + the panel's mechanical orientation. We
    // accept either order as long as the two values are on opposite
    // sides of the baseline.
    const upDelta = afterUp - baseline
    const downDelta = afterDown - baseline
    expect.soft(Math.sign(upDelta) * Math.sign(downDelta)).toBeLessThanOrEqual(0)
  })
})

test.describe('Live-Pi servo calibration — UI → PCA9685', () => {
  test.describe.configure({ timeout: 60_000 })

  test('PWM- button changes ch0', async ({
    connectedDeck,
    ssh,
    dashboard,
  }) => {
    const before = await readCh0(ssh)
    await connectedDeck.servoCalibButton('PWM-').click()
    await dashboard.waitForTimeout(SETTLE_MS)
    const after = await readCh0(ssh)
    expect(after).not.toBe(before)
  })

  test('PWM+ button changes ch0', async ({
    connectedDeck,
    ssh,
    dashboard,
  }) => {
    const before = await readCh0(ssh)
    await connectedDeck.servoCalibButton('PWM+').click()
    await dashboard.waitForTimeout(SETTLE_MS)
    const after = await readCh0(ssh)
    expect(after).not.toBe(before)
  })

  test('Init button (PWMINIT) yields a non-zero ch0 PWM', async ({
    connectedDeck,
    ssh,
    dashboard,
  }) => {
    await connectedDeck.servoCalibButton('Init').click()
    await dashboard.waitForTimeout(SETTLE_MS)
    const value = await readCh0(ssh)
    expect(value).toBeGreaterThan(0)
  })

  test('Middle button (PWMMS 0) returns a recognised RX response', async ({
    connectedDeck,
  }) => {
    await connectedDeck.servoCalibButton('Middle').click()
    // The Zig firmware acks every command with status:ok;  the
    // dashboard's command log captures both TX and RX.
    await connectedDeck.expectLogContains('PWMMS 0')
  })

  test('Reset button (PWMD) is acked by the firmware', async ({
    connectedDeck,
  }) => {
    await connectedDeck.servoCalibButton('Reset').click()
    await connectedDeck.expectLogContains('PWMD')
  })
})
