/**
 * LED Ports scenarios.
 *
 * The dashboard exposes three discrete GPIO LEDs (mapped to GPIO pins
 * 9, 25 and 11 on the Adeept HAT V3.2 — the firmware translates the
 * `Switch_<n>_on` / `Switch_<n>_off` protocol commands into pin
 * writes). The dashboard tracks each toggle locally so the buttons
 * relabel between "Port N — OFF" and "Port N — ON".
 *
 * No arming is required, since blinking an LED can never cause the
 * robot to drive away.
 */

import { test, expect } from '../fixtures/dashboard'
import { getSimulatorState } from '../utils/sim-client'

test.describe('LED Ports', () => {
  for (const port of [1, 2, 3] as const) {
    test(`Port ${port} toggles between ON and OFF and emits Switch_${port}_(on|off)`, async ({
      connectedDeck,
      request,
    }) => {
      const button = connectedDeck.ledPortButton(port)
      await expect(button).toHaveText(new RegExp(`^Port ${port}\\s*— OFF$`))

      // Turn ON.
      await button.click()
      await expect(button).toHaveText(new RegExp(`^Port ${port}\\s*— ON$`))
      await expect
        .poll(
          async () => (await getSimulatorState(request)).switches[String(port) as '1' | '2' | '3'],
          { timeout: 2_000 },
        )
        .toBe(true)
      await connectedDeck.expectLogContains(`Switch_${port}_on`)

      // Turn OFF.
      await button.click()
      await expect(button).toHaveText(new RegExp(`^Port ${port}\\s*— OFF$`))
      await expect
        .poll(
          async () => (await getSimulatorState(request)).switches[String(port) as '1' | '2' | '3'],
          { timeout: 2_000 },
        )
        .toBe(false)
      await connectedDeck.expectLogContains(`Switch_${port}_off`)
    })
  }
})
