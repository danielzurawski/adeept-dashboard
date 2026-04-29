/**
 * Servo Calibration scenarios.
 *
 * The Control Mixer's right-hand panel exposes a small five-button
 * calibration grid for the camera-tilt servo on PCA9685 channel 0:
 *
 *   PWM-     → `SiLeft 0`        (decrement servo angle)
 *   Middle   → `PWMMS 0`         (move to mechanical centre)
 *   PWM+     → `SiRight 0`       (increment servo angle)
 *   Reset    → `PWMD`            (zero all servo offsets)
 *   Init     → `PWMINIT`         (re-run the boot servo init)
 *
 * These commands are surfaced verbatim in the Command Log and the
 * simulator records the most recent one in `state.lastServo`. Because
 * none of these arm any motors, they do not require the drive to be
 * armed.
 */

import { test, expect } from '../fixtures/dashboard'
import { getSimulatorState } from '../utils/sim-client'

test.describe('Servo Calibration', () => {
  const cases = [
    { label: 'PWM-', cmd: 'SiLeft 0' },
    { label: 'Middle', cmd: 'PWMMS 0' },
    { label: 'PWM+', cmd: 'SiRight 0' },
    { label: 'Reset', cmd: 'PWMD' },
    { label: 'Init', cmd: 'PWMINIT' },
  ] as const

  for (const c of cases) {
    test(`"${c.label}" emits "${c.cmd}" and the simulator records it`, async ({
      connectedDeck,
      request,
    }) => {
      await connectedDeck.servoCalibButton(c.label).click()

      await expect
        .poll(async () => (await getSimulatorState(request)).lastServo, {
          timeout: 3_000,
        })
        .toBe(c.cmd)

      await connectedDeck.expectLogContains(c.cmd)
    })
  }

  test('servo buttons remain enabled regardless of arm state', async ({
    connectedDeck,
  }) => {
    // While disarmed.
    for (const c of cases) {
      await expect(connectedDeck.servoCalibButton(c.label)).toBeEnabled()
    }
    await connectedDeck.armDrive()
    for (const c of cases) {
      await expect(connectedDeck.servoCalibButton(c.label)).toBeEnabled()
    }
  })
})
