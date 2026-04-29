/**
 * Demo Pad scenarios.
 *
 * The Demo Pad surfaces curated capability macros: short scripts of
 * protocol commands the user can fire with one click. The cards are
 * visible regardless of connection state but disabled when their
 * declared `backends` array doesn't include the active backend (the
 * simulator supports them all).
 *
 * The macros are sequenced via setTimeout chains, so the test waits
 * for the simulator to observe the *final* command of each sequence
 * before asserting.
 */

import { test, expect } from '../fixtures/dashboard'
import { getSimulatorState } from '../utils/sim-client'

test.describe('Demo Pad', () => {
  test('Police Lights toggles the lights state to "police"', async ({
    connectedDeck,
    request,
  }) => {
    await connectedDeck.demoButton('Police Lights').click()

    // The simulator records the lights command in `state.lights`.
    await expect
      .poll(async () => (await getSimulatorState(request)).lights, {
        timeout: 3_000,
      })
      .toBe('police')

    await connectedDeck.expectLogContains('police')
  })

  test('Baby Shark sends the buzzer tune command', async ({
    connectedDeck,
    request,
  }) => {
    await connectedDeck.demoButton('Baby Shark').click()

    await expect
      .poll(async () => (await getSimulatorState(request)).lastTune, {
        timeout: 3_000,
      })
      .toBe('baby_shark')

    await connectedDeck.expectLogContains('tune baby_shark')
  })

  test('LED Wink macro toggles all three GPIO LEDs in sequence', async ({
    connectedDeck,
    request,
  }) => {
    await connectedDeck.demoButton('LED Wink').click()

    // The macro sends Switch_1_on through Switch_3_on with delays,
    // then Switch_*_off. By the time the macro completes (~720 ms),
    // all three switches should be back to off.
    await expect
      .poll(
        async () => {
          const state = await getSimulatorState(request)
          return state.switches
        },
        { timeout: 4_000 },
      )
      .toMatchObject({ '1': false, '2': false, '3': false })

    // The log should contain at least one ON and one OFF for each port.
    for (const port of [1, 2, 3] as const) {
      await connectedDeck.expectLogContains(`Switch_${port}_on`)
      await connectedDeck.expectLogContains(`Switch_${port}_off`)
    }
  })

  test('Sensor Snapshot fires an immediate get_info request', async ({
    connectedDeck,
  }) => {
    await connectedDeck.demoButton('Sensor Snapshot').click()
    await connectedDeck.expectLogContains('get_info')
    // Eventually the System Info card populates with non-N/A values.
    const { value: cpuTempValue } = connectedDeck.systemInfoRow('CPU Temp')
    await expect(cpuTempValue).toHaveText(/\d+(\.\d+)?°C/, { timeout: 4_000 })
  })

  test('Tiny Forward Tap requires arming and exercises the macro flow', async ({
    connectedDeck,
    request,
  }) => {
    // While disarmed, the Tiny Forward Tap is disabled because its
    // declared `requiresArm` flag is true.
    await expect(connectedDeck.demoButton('Tiny Forward Tap')).toBeDisabled()
    await connectedDeck.armDrive()
    await expect(connectedDeck.demoButton('Tiny Forward Tap')).toBeEnabled()

    await connectedDeck.demoButton('Tiny Forward Tap').click()

    // The macro:
    //   wsB 25  → forward (350 ms)  → DS  →  wsB 50
    // We wait for it to finish — by the end, motion is stopped and
    // speed is back to 50.
    await expect
      .poll(async () => (await getSimulatorState(request)).lastMotion, {
        timeout: 4_000,
      })
      .toBe('stopped')
    await expect
      .poll(async () => (await getSimulatorState(request)).speed, {
        timeout: 4_000,
      })
      .toBe(50)

    // Log shows the four sequential commands in order. We don't
    // strictly assert order because the log is newest-first, but each
    // step must appear.
    await connectedDeck.expectLogContains('wsB 25')
    await connectedDeck.expectLogContains('forward')
    await connectedDeck.expectLogContains('DS')
    await connectedDeck.expectLogContains('wsB 50')
  })

  test('Happy Birthday sends the buzzer tune command', async ({
    connectedDeck,
    request,
  }) => {
    await connectedDeck.demoButton('Happy Birthday').click()

    await expect
      .poll(async () => (await getSimulatorState(request)).lastTune, {
        timeout: 3_000,
      })
      .toBe('happy_birthday')
    await connectedDeck.expectLogContains('tune happy_birthday')
  })

  test('Seven Notes sends the buzzer tune command', async ({
    connectedDeck,
    request,
  }) => {
    await connectedDeck.demoButton('Seven Notes').click()

    await expect
      .poll(async () => (await getSimulatorState(request)).lastTune, {
        timeout: 3_000,
      })
      .toBe('seven_notes')
    await connectedDeck.expectLogContains('tune seven_notes')
  })

  test('Beep Marker sends a short C5 tone', async ({
    connectedDeck,
  }) => {
    // The Beep Marker fires a `tone C5 160` frame. The simulator
    // records the entire `tone …` string in `lastTune`, so we assert
    // on the command-log entry directly to make the intent obvious.
    await connectedDeck.demoButton('Beep Marker').click()
    await connectedDeck.expectLogContains('tone C5 160')
  })

  test('Breathe Blue sets the lights effect to lights_breath_blue', async ({
    connectedDeck,
    request,
  }) => {
    await connectedDeck.demoButton('Breathe Blue').click()
    await expect
      .poll(async () => (await getSimulatorState(request)).lights, {
        timeout: 3_000,
      })
      .toBe('lights_breath_blue')
    await connectedDeck.expectLogContains('lights_breath_blue')
  })

  test('Rainbow Sweep sets the lights effect to lights_rainbow', async ({
    connectedDeck,
    request,
  }) => {
    await connectedDeck.demoButton('Rainbow Sweep').click()
    await expect
      .poll(async () => (await getSimulatorState(request)).lights, {
        timeout: 3_000,
      })
      .toBe('lights_rainbow')
    await connectedDeck.expectLogContains('lights_rainbow')
  })

  test('Camera Nod fires the up/UDstop/down/UDstop sequence', async ({
    connectedDeck,
    request,
  }) => {
    await connectedDeck.demoButton('Camera Nod').click()

    // The sequence finishes ~720 ms later with the tilt back to
    // "stopped".  We verify (a) the final simulator state and (b)
    // that all four protocol frames passed through the command log.
    await expect
      .poll(async () => (await getSimulatorState(request)).lastTilt, {
        timeout: 4_000,
      })
      .toBe('stopped')

    await connectedDeck.expectLogContains('up')
    await connectedDeck.expectLogContains('down')
    await connectedDeck.expectLogContains('UDstop')
  })

  test('Tiny Spin Tap requires arming and runs a rotate-left pulse', async ({
    connectedDeck,
    request,
  }) => {
    // Disarmed: locked.
    await expect(connectedDeck.demoButton('Tiny Spin Tap')).toBeDisabled()
    await connectedDeck.armDrive()
    await expect(connectedDeck.demoButton('Tiny Spin Tap')).toBeEnabled()

    await connectedDeck.demoButton('Tiny Spin Tap').click()

    await expect
      .poll(async () => (await getSimulatorState(request)).lastMotion, {
        timeout: 4_000,
      })
      .toBe('stopped')
    await expect
      .poll(async () => (await getSimulatorState(request)).speed, {
        timeout: 4_000,
      })
      .toBe(50)

    await connectedDeck.expectLogContains('wsB 25')
    await connectedDeck.expectLogContains('rotate-left')
    await connectedDeck.expectLogContains('DS')
    await connectedDeck.expectLogContains('wsB 50')
  })
})
