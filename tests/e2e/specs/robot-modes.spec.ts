/**
 * Robot Modes scenarios.
 *
 * Robot Modes are higher-level toggles (find color, motion detect,
 * automatic obstacle avoidance, line tracking, keep distance, CV line
 * follow, live mapping) that translate into pairs of "on" / "off"
 * commands. Several modes also require the drive to be armed, because
 * they autonomously command the wheels.
 */

import { test, expect } from '../fixtures/dashboard'
import { getSimulatorState } from '../utils/sim-client'

test.describe('Robot Modes', () => {
  test('Live Mapping toggles between mapping and mappingOff', async ({
    connectedDeck,
    request,
  }) => {
    const button = connectedDeck.modeButton('Live Mapping')

    await button.click()
    await expect
      .poll(async () => (await getSimulatorState(request)).slam.mapping, {
        timeout: 3_000,
      })
      .toBe(true)

    await button.click()
    await expect
      .poll(async () => (await getSimulatorState(request)).slam.mapping, {
        timeout: 3_000,
      })
      .toBe(false)

    await connectedDeck.expectLogContains('mapping')
    await connectedDeck.expectLogContains('mappingOff')
  })

  test('Find Color toggles findColor / stopCV without arming', async ({
    connectedDeck,
    request,
  }) => {
    const button = connectedDeck.modeButton('Find Color')

    await button.click()
    await expect
      .poll(async () => (await getSimulatorState(request)).lastFunction, {
        timeout: 3_000,
      })
      .toBe('findColor')

    await button.click()
    await expect
      .poll(async () => (await getSimulatorState(request)).lastFunction, {
        timeout: 3_000,
      })
      .toBe('stopCV')
  })

  test('autonomous modes that command the wheels require Drive Armed', async ({
    connectedDeck,
  }) => {
    // While disarmed, autonomous-drive modes are disabled.
    for (const mode of [
      'Auto Obstacle',
      'Track Line',
      'Keep Distance',
      'CV Line Follow',
    ]) {
      await expect(connectedDeck.modeButton(mode)).toBeDisabled()
    }

    await connectedDeck.armDrive()

    for (const mode of [
      'Auto Obstacle',
      'Track Line',
      'Keep Distance',
      'CV Line Follow',
    ]) {
      await expect(connectedDeck.modeButton(mode)).toBeEnabled()
    }
  })

  test('Auto Obstacle on/off cycles through `automatic` and `automaticOff`', async ({
    connectedDeck,
    request,
  }) => {
    await connectedDeck.armDrive()
    const button = connectedDeck.modeButton('Auto Obstacle')

    await button.click()
    await expect
      .poll(async () => (await getSimulatorState(request)).lastFunction, {
        timeout: 3_000,
      })
      .toBe('automatic')

    await button.click()
    await expect
      .poll(async () => (await getSimulatorState(request)).lastFunction, {
        timeout: 3_000,
      })
      .toBe('automaticOff')
  })

  test('Motion Detect toggles motionGet / stopCV without arming', async ({
    connectedDeck,
    request,
  }) => {
    const button = connectedDeck.modeButton('Motion Detect')

    await button.click()
    await expect
      .poll(async () => (await getSimulatorState(request)).lastFunction, {
        timeout: 3_000,
      })
      .toBe('motionGet')

    await button.click()
    await expect
      .poll(async () => (await getSimulatorState(request)).lastFunction, {
        timeout: 3_000,
      })
      .toBe('stopCV')
  })

  test('Track Line on/off cycles through `trackLine` and `trackLineOff`', async ({
    connectedDeck,
    request,
  }) => {
    await connectedDeck.armDrive()
    const button = connectedDeck.modeButton('Track Line')

    await button.click()
    await expect
      .poll(async () => (await getSimulatorState(request)).lastFunction, {
        timeout: 3_000,
      })
      .toBe('trackLine')

    await button.click()
    await expect
      .poll(async () => (await getSimulatorState(request)).lastFunction, {
        timeout: 3_000,
      })
      .toBe('trackLineOff')
  })

  test('Keep Distance on/off cycles through `keepDistance` and `keepDistanceOff`', async ({
    connectedDeck,
    request,
  }) => {
    await connectedDeck.armDrive()
    const button = connectedDeck.modeButton('Keep Distance')

    await button.click()
    await expect
      .poll(async () => (await getSimulatorState(request)).lastFunction, {
        timeout: 3_000,
      })
      .toBe('keepDistance')

    await button.click()
    await expect
      .poll(async () => (await getSimulatorState(request)).lastFunction, {
        timeout: 3_000,
      })
      .toBe('keepDistanceOff')
  })

  test('CV Line Follow toggles `CVFL` / `stopCV` (requires arming)', async ({
    connectedDeck,
    request,
  }) => {
    await connectedDeck.armDrive()
    const button = connectedDeck.modeButton('CV Line Follow')

    await button.click()
    await expect
      .poll(async () => (await getSimulatorState(request)).lastFunction, {
        timeout: 3_000,
      })
      .toBe('CVFL')

    await button.click()
    await expect
      .poll(async () => (await getSimulatorState(request)).lastFunction, {
        timeout: 3_000,
      })
      .toBe('stopCV')
  })
})
