/**
 * Telemetry / System Info scenarios.
 *
 * The dashboard polls `get_info` every three seconds while connected
 * and renders the four resulting metrics in the System Info card.
 * Until the first response lands, all four values display as "N/A".
 *
 * The simulator generates fresh randomised values on every poll, so
 * we assert format and plausible range rather than specific numbers.
 */

import { test, expect } from '../fixtures/dashboard'

test.describe('System Info telemetry', () => {
  test('shows N/A until the first get_info response lands', async ({
    controlDeck,
  }) => {
    // Right at page load, before clicking Connect, every metric is N/A.
    for (const label of ['CPU Temp', 'CPU Usage', 'RAM Usage', 'Battery'] as const) {
      const { value } = controlDeck.systemInfoRow(label)
      await expect(value).toHaveText('N/A')
    }
  })

  test('populates the System Info card after the first get_info round-trip', async ({
    connectedDeck,
  }) => {
    // The Demo Pad's "Sensor Snapshot" card forces an immediate
    // get_info, so we don't have to wait for the 3 s polling cycle.
    await connectedDeck.demoButton('Sensor Snapshot').click()

    // Each row must end up with a numeric value plus the right unit.
    const expectations: Array<{ label: 'CPU Temp' | 'CPU Usage' | 'RAM Usage' | 'Battery'; pattern: RegExp }> = [
      { label: 'CPU Temp', pattern: /^\d+(\.\d+)?°C$/ },
      { label: 'CPU Usage', pattern: /^\d+(\.\d+)?%$/ },
      { label: 'RAM Usage', pattern: /^\d+(\.\d+)?%$/ },
      { label: 'Battery', pattern: /^\d+(\.\d+)?%$/ },
    ]
    for (const { label, pattern } of expectations) {
      const { value } = connectedDeck.systemInfoRow(label)
      await expect(value).toHaveText(pattern, { timeout: 4_000 })
    }
  })

  test('refreshes telemetry on the periodic poll', async ({
    connectedDeck,
  }) => {
    await connectedDeck.demoButton('Sensor Snapshot').click()

    const { value: tempValue } = connectedDeck.systemInfoRow('CPU Temp')
    const initial = await tempValue.textContent()

    // The simulator returns randomised values on every get_info, so
    // by the time the next poll lands (≤ 4 s) at least one of the four
    // metrics is overwhelmingly likely to change. We assert against
    // the CPU Temp row specifically because its formatting is unique
    // ("°C" suffix) and guaranteed by the simulator schema.
    await expect
      .poll(async () => tempValue.textContent(), {
        timeout: 6_000,
        intervals: [500, 1_000],
      })
      .not.toBe(initial)
  })
})
