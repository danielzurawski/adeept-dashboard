/**
 * Drive-arming safety toggle scenarios.
 *
 * The drive grid (forward/backward/left/right/rotate-*) is the only
 * affordance that can move the robot's chassis on its own. To prevent
 * an accidental click from launching a robot off a desk, the grid is
 * gated behind a "Drive Armed" toggle. Disarming and the dedicated
 * "Stop All" button must both reset the firmware to a known-quiet
 * state by sending DS/TS/UDstop.
 */

import { test, expect } from '../fixtures/dashboard'
import { getSimulatorState } from '../utils/sim-client'

test.describe('Drive arming safety', () => {
  test('drive grid is disabled until the operator arms the drive', async ({
    connectedDeck,
  }) => {
    await expect(connectedDeck.armButton).toHaveText(/Arm Drive/)

    // Every motion button is disabled while disarmed. The Stop drive
    // button stays enabled at all times so the operator can always
    // cut the wheels.
    for (const dir of [
      'forward',
      'backward',
      'left',
      'right',
      'rotate-left',
      'rotate-right',
    ] as const) {
      await expect(connectedDeck.driveButton(dir)).toBeDisabled()
    }
    await expect(connectedDeck.stopDriveButton).toBeEnabled()

    await connectedDeck.armDrive()

    for (const dir of [
      'forward',
      'backward',
      'left',
      'right',
      'rotate-left',
      'rotate-right',
    ] as const) {
      await expect(connectedDeck.driveButton(dir)).toBeEnabled()
    }
  })

  test('disarming sends drive- and turn-stop frames to the firmware', async ({
    connectedDeck,
    request,
  }) => {
    await connectedDeck.armDrive()

    // Dirty the simulator's lastMotion so we can observe the disarm
    // bringing it back to "stopped".
    await connectedDeck.pressAndReleaseDrive('forward', 80)
    let state = await getSimulatorState(request)
    expect(state.lastMotion).toBe('stopped') // pointer-up sends DS

    await connectedDeck.disarmDrive()

    // After disarm, lastMotion is unconditionally "stopped" because
    // the disarm handler sends DS + TS regardless of state.
    state = await getSimulatorState(request)
    expect(state.lastMotion).toBe('stopped')

    // Log shows the explicit stops on disarm.
    await connectedDeck.expectLogContains(/^DS$|TX.*DS/)
    await connectedDeck.expectLogContains(/^TS$|TX.*TS/)
  })

  test('Stop All disarms drive and emits DS, TS, and UDstop', async ({
    connectedDeck,
    request,
  }) => {
    await connectedDeck.armDrive()

    // Pre-stage some motion + tilt + lights so we can confirm Stop All
    // forces them all back to neutral.
    await connectedDeck.pressAndReleaseDrive('forward', 50)
    await connectedDeck.pressAndReleaseTilt('up', 50)

    await connectedDeck.stopAllButton.click()

    // After Stop All:
    //   - Drive Armed flips back to Arm Drive.
    //   - Simulator's lastMotion and lastTilt are both "stopped".
    //   - Command log contains DS, TS, and UDstop.
    await expect(connectedDeck.armButton).toHaveText(/Arm Drive/)
    const state = await getSimulatorState(request)
    expect(state.lastMotion).toBe('stopped')
    expect(state.lastTilt).toBe('stopped')

    await connectedDeck.expectLogContains(/DS/)
    await connectedDeck.expectLogContains(/TS/)
    await connectedDeck.expectLogContains(/UDstop/)
  })
})
