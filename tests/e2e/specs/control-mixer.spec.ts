/**
 * Control mixer scenarios.
 *
 * The control mixer comprises the drive grid, speed slider, and
 * camera tilt buttons. Together they exercise the four motion-axis
 * commands the firmware accepts (forward/backward/left/right plus
 * rotate-left/rotate-right), the camera-tilt up/down commands, and
 * the speed parameter (`wsB <0..100>`).
 *
 * Each scenario asserts both the user-visible behaviour (button
 * enable state, log entries) and the firmware's view of the world via
 * the simulator's `/state` endpoint.
 */

import { test, expect } from '../fixtures/dashboard'
import { getSimulatorState } from '../utils/sim-client'
import type { DriveDirection } from '../pages/control-deck'

const DRIVE_DIRECTIONS: DriveDirection[] = [
  'forward',
  'backward',
  'left',
  'right',
  'rotate-left',
  'rotate-right',
]

test.describe('Control mixer — drive grid', () => {
  for (const direction of DRIVE_DIRECTIONS) {
    test(`press-and-hold ${direction} writes the right motion command and stops on release`, async ({
      connectedDeck,
      request,
    }) => {
      await connectedDeck.armDrive()

      // Hold the button briefly and snapshot mid-press. We can't use
      // `getSimulatorState` mid-pointer-down with a single dispatch
      // because the pointer events are dispatched serially and the
      // helper releases right after — so we manually drive the press,
      // probe, then release.
      const button = connectedDeck.driveButton(direction)
      await button.dispatchEvent('pointerdown')

      const live = await getSimulatorState(request)
      expect(live.lastMotion).toBe(direction)

      await button.dispatchEvent('pointerup')
      const settled = await getSimulatorState(request)
      expect(settled.lastMotion).toBe('stopped')

      // Both the motion command and the stop frame should be in the log.
      await connectedDeck.expectLogContains(direction)
      // Strafe (left/right) buttons release with TS, others with DS.
      const expectedStop =
        direction === 'left' || direction === 'right' ? 'TS' : 'DS'
      await connectedDeck.expectLogContains(expectedStop)
    })
  }

  test('Stop drive button is always enabled and forces a quiescent state', async ({
    connectedDeck,
    request,
  }) => {
    // Even when un-armed, the operator must be able to send a hard
    // stop. Verify the button is enabled regardless of arming.
    await expect(connectedDeck.stopDriveButton).toBeEnabled()
    await connectedDeck.armDrive()

    // Dirty motion first so the stop button has something to undo.
    await connectedDeck.pressAndReleaseDrive('forward', 80)
    await connectedDeck.stopDriveButton.click()

    const state = await getSimulatorState(request)
    expect(state.lastMotion).toBe('stopped')
  })
})

test.describe('Control mixer — speed slider', () => {
  test('default speed is 50%', async ({ connectedDeck }) => {
    await expect(connectedDeck.speedLabel).toHaveText('Speed: 50%')
    await expect(connectedDeck.speedSlider).toHaveValue('50')
  })

  test('changing speed sends `wsB <pct>` to the firmware and updates the label', async ({
    connectedDeck,
    request,
  }) => {
    await connectedDeck.setSpeed(80)

    // Simulator records the parsed speed numerically.
    const state = await getSimulatorState(request)
    expect(state.speed).toBe(80)

    // Log contains the literal protocol frame.
    await connectedDeck.expectLogContains('wsB 80')
  })

  test('clamps to slider range and accepts boundary values', async ({
    connectedDeck,
    request,
  }) => {
    // The slider fires `wsB <pct>` over WebSocket asynchronously, so
    // we poll the simulator state instead of asserting synchronously.
    await connectedDeck.setSpeed(0)
    await expect
      .poll(async () => (await getSimulatorState(request)).speed, {
        timeout: 3_000,
      })
      .toBe(0)

    await connectedDeck.setSpeed(100)
    await expect
      .poll(async () => (await getSimulatorState(request)).speed, {
        timeout: 3_000,
      })
      .toBe(100)
  })
})

test.describe('Control mixer — camera tilt', () => {
  test('camera tilt buttons work without arming the drive', async ({
    connectedDeck,
    request,
  }) => {
    // Verify still disarmed (default state).
    await expect(connectedDeck.armButton).toHaveText(/Arm Drive/)

    await expect(connectedDeck.tiltUpButton).toBeEnabled()
    await expect(connectedDeck.tiltDownButton).toBeEnabled()

    await connectedDeck.tiltUpButton.dispatchEvent('pointerdown')
    expect((await getSimulatorState(request)).lastTilt).toBe('up')
    await connectedDeck.tiltUpButton.dispatchEvent('pointerup')
    expect((await getSimulatorState(request)).lastTilt).toBe('stopped')

    await connectedDeck.tiltDownButton.dispatchEvent('pointerdown')
    expect((await getSimulatorState(request)).lastTilt).toBe('down')
    await connectedDeck.tiltDownButton.dispatchEvent('pointerup')
    expect((await getSimulatorState(request)).lastTilt).toBe('stopped')

    await connectedDeck.expectLogContains('up')
    await connectedDeck.expectLogContains('down')
    await connectedDeck.expectLogContains('UDstop')
  })
})
